-- Run with psql -v ON_ERROR_STOP=1. All fixtures and changes roll back.
BEGIN;
CREATE FUNCTION pg_temp.fail_batch_test_row() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code = '__BATCH-12' THEN RAISE EXCEPTION 'TEST_FORCED_ROW_FAILURE'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fail_batch_test_row BEFORE INSERT ON public.warehouse_locations
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_batch_test_row();

DO $$
DECLARE
  v_company UUID; v_warehouse UUID; v_bu UUID; v_user UUID; v_zone UUID; v_closed UUID;
  v_row RECORD; v_count INTEGER; v_result RECORD;
BEGIN
  SELECT w.company_id, w.id, w.business_unit_id INTO v_company, v_warehouse, v_bu
  FROM public.warehouses w WHERE w.deleted_at IS NULL AND w.is_active LIMIT 1;
  SELECT u.id INTO v_user FROM public.users u
  WHERE u.company_id = v_company AND u.is_active
    AND public.user_has_permission(u.id, 'manage_locations', 'create', v_bu)
    AND EXISTS (SELECT 1 FROM public.user_business_unit_access a WHERE a.user_id = u.id AND a.business_unit_id = v_bu)
  LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'TEST_REQUIRES_AUTHORIZED_SEED_USER'; END IF;

  INSERT INTO public.warehouse_locations(company_id, warehouse_id, code, location_type, is_storable)
    VALUES(v_company, v_warehouse, '__BATCH_ZONE', 'zone', false) RETURNING id INTO v_zone;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, code, location_type, is_storable, is_active)
    VALUES(v_company, v_warehouse, '__BATCH_CLOSED', 'zone', false, false) RETURNING id INTO v_closed;

  -- Padding never truncates, names are unpadded, and an empty name prefix yields no name.
  SELECT string_agg(code || '|' || COALESCE(name, '-'), ',' ORDER BY sequence_number) INTO v_row
  FROM public.expand_warehouse_location_batch('__B-', 9, 11, 2, 'Bin ');
  IF v_row.string_agg <> '__B-09|Bin 9,__B-10|Bin 10,__B-11|Bin 11' THEN RAISE EXCEPTION 'EXPAND_FAILED: %', v_row; END IF;
  SELECT string_agg(code || '|' || COALESCE(name, '-'), ',' ORDER BY sequence_number) INTO v_row
  FROM public.expand_warehouse_location_batch('C', 99, 100, 1, '  ');
  IF v_row.string_agg <> 'C99|-,C100|-' THEN RAISE EXCEPTION 'EXPAND_WIDTH_FAILED: %', v_row; END IF;
  BEGIN
    PERFORM 1 FROM public.expand_warehouse_location_batch('X', 1, 101, 1, NULL);
    RAISE EXCEPTION 'OVERSIZED_BATCH_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_BATCH_INVALID' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', v_user::TEXT, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user, 'role', 'authenticated')::TEXT, true);
  SET LOCAL ROLE authenticated;

  SELECT * INTO v_row FROM public.preview_warehouse_locations_batch(p_business_unit_id => v_bu, p_warehouse_id => v_warehouse, p_code_prefix => '__BATCH-', p_from => 1, p_to => 5, p_digits => 2, p_parent_id => v_zone, p_name_prefix => 'Bin ') LIMIT 1;
  IF v_row.location_path <> '__BATCH_ZONE / __BATCH-01 - Bin 1' OR v_row.already_exists THEN
    RAISE EXCEPTION 'PREVIEW_FAILED: %', row_to_json(v_row);
  END IF;

  SELECT * INTO v_result FROM public.create_warehouse_locations_batch(
      p_business_unit_id => v_bu, p_warehouse_id => v_warehouse, p_code_prefix => '__BATCH-', p_from => 1,
      p_to => 5, p_digits => 2, p_location_type => 'bin', p_is_storable => true, p_is_pickable => true,
      p_is_active => true, p_skip_existing => false, p_parent_id => v_zone, p_name_prefix => 'Bin ',
      p_max_capacity => 25);
  IF v_result.created_count <> 5 OR v_result.skipped_count <> 0 THEN RAISE EXCEPTION 'CREATE_FAILED: %', row_to_json(v_result); END IF;
  SELECT COUNT(*) INTO v_count FROM public.warehouse_locations
  WHERE parent_id = v_zone AND code LIKE '\_\_BATCH-%' AND location_type = 'bin' AND is_storable AND is_pickable
    AND max_capacity = 25 AND created_by = v_user AND location_path LIKE '__BATCH_ZONE / __BATCH-%';
  IF v_count <> 5 THEN RAISE EXCEPTION 'CREATED_ROWS_FAILED: %', v_count; END IF;
  IF NOT (SELECT already_exists FROM public.preview_warehouse_locations_batch(p_business_unit_id => v_bu, p_warehouse_id => v_warehouse, p_code_prefix => '__BATCH-', p_from => 1, p_to => 1, p_digits => 2, p_parent_id => v_zone, p_name_prefix => NULL)) THEN
    RAISE EXCEPTION 'PREVIEW_EXISTING_FAILED';
  END IF;

  -- Overlapping codes block the batch unless skipping is requested.
  BEGIN
    PERFORM public.create_warehouse_locations_batch(
      p_business_unit_id => v_bu, p_warehouse_id => v_warehouse, p_code_prefix => '__BATCH-', p_from => 4,
      p_to => 8, p_digits => 2, p_location_type => 'bin', p_is_storable => true, p_is_pickable => true,
      p_is_active => true, p_skip_existing => false, p_parent_id => v_zone, p_name_prefix => 'Bin ',
      p_max_capacity => NULL);
    RAISE EXCEPTION 'CONFLICT_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_CODE_EXISTS' THEN RAISE; END IF;
  END;
  SELECT * INTO v_result FROM public.create_warehouse_locations_batch(
      p_business_unit_id => v_bu, p_warehouse_id => v_warehouse, p_code_prefix => '__BATCH-', p_from => 4,
      p_to => 8, p_digits => 2, p_location_type => 'bin', p_is_storable => true, p_is_pickable => true,
      p_is_active => true, p_skip_existing => true, p_parent_id => v_zone, p_name_prefix => 'Bin ',
      p_max_capacity => NULL);
  IF v_result.created_count <> 3 OR v_result.skipped_count <> 2 THEN RAISE EXCEPTION 'SKIP_FAILED: %', row_to_json(v_result); END IF;
  BEGIN
    PERFORM public.create_warehouse_locations_batch(
      p_business_unit_id => v_bu, p_warehouse_id => v_warehouse, p_code_prefix => '__BATCH-', p_from => 1,
      p_to => 3, p_digits => 2, p_location_type => 'bin', p_is_storable => true, p_is_pickable => true,
      p_is_active => true, p_skip_existing => true, p_parent_id => v_zone, p_name_prefix => NULL,
      p_max_capacity => NULL);
    RAISE EXCEPTION 'EMPTY_BATCH_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_BATCH_EMPTY' THEN RAISE; END IF;
  END;

  -- A failure on the third inserted row must leave none of the batch behind.
  BEGIN
    PERFORM public.create_warehouse_locations_batch(
      p_business_unit_id => v_bu, p_warehouse_id => v_warehouse, p_code_prefix => '__BATCH-', p_from => 10,
      p_to => 14, p_digits => 2, p_location_type => 'bin', p_is_storable => true, p_is_pickable => true,
      p_is_active => true, p_skip_existing => false, p_parent_id => v_zone, p_name_prefix => NULL,
      p_max_capacity => NULL);
    RAISE EXCEPTION 'FORCED_FAILURE_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'TEST_FORCED_ROW_FAILURE' THEN RAISE; END IF;
  END;
  SELECT COUNT(*) INTO v_count FROM public.warehouse_locations
  WHERE warehouse_id = v_warehouse AND code IN ('__BATCH-10', '__BATCH-11');
  IF v_count <> 0 THEN RAISE EXCEPTION 'PARTIAL_BATCH_COMMITTED: %', v_count; END IF;

  BEGIN
    PERFORM public.create_warehouse_locations_batch(
      p_business_unit_id => v_bu, p_warehouse_id => v_warehouse, p_code_prefix => '__BATCH-C', p_from => 1,
      p_to => 2, p_digits => 1, p_location_type => 'bin', p_is_storable => true, p_is_pickable => true,
      p_is_active => true, p_skip_existing => false, p_parent_id => v_closed, p_name_prefix => NULL,
      p_max_capacity => NULL);
    RAISE EXCEPTION 'INACTIVE_PARENT_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_PARENT_INVALID' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.create_warehouse_locations_batch(
      p_business_unit_id => v_bu, p_warehouse_id => v_warehouse, p_code_prefix => '__BATCH-P', p_from => 1,
      p_to => 2, p_digits => 1, p_location_type => 'bin', p_is_storable => false, p_is_pickable => true,
      p_is_active => true, p_skip_existing => false, p_parent_id => v_zone, p_name_prefix => NULL,
      p_max_capacity => NULL);
    RAISE EXCEPTION 'PICKABLE_WITHOUT_STORAGE_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_BATCH_INVALID' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.create_warehouse_locations_batch(
      p_business_unit_id => v_bu, p_warehouse_id => v_warehouse, p_code_prefix => '__BATCH-Q', p_from => 1,
      p_to => 2, p_digits => 1, p_location_type => 'bin', p_is_storable => false, p_is_pickable => false,
      p_is_active => true, p_skip_existing => false, p_parent_id => v_zone, p_name_prefix => NULL,
      p_max_capacity => 10);
    RAISE EXCEPTION 'CAPACITY_WITHOUT_STORAGE_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'CAPACITY_REQUIRES_STORABLE_LOCATION' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::TEXT, true);
  PERFORM set_config('request.jwt.claims', '{}'::TEXT, true);
  BEGIN
    PERFORM public.create_warehouse_locations_batch(
      p_business_unit_id => v_bu, p_warehouse_id => v_warehouse, p_code_prefix => '__BATCH-U', p_from => 1,
      p_to => 2, p_digits => 1, p_location_type => 'bin', p_is_storable => true, p_is_pickable => true,
      p_is_active => true, p_skip_existing => false, p_parent_id => v_zone, p_name_prefix => NULL,
      p_max_capacity => NULL);
    RAISE EXCEPTION 'UNAUTHORIZED_BATCH_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_WAREHOUSE_INVALID' THEN RAISE; END IF;
  END;
  RESET ROLE;
  RAISE NOTICE 'PASS: batch expansion, preview, create, conflicts, skip, forced mid-insert rollback, parent/flag validation, unauthorized rejection';
END $$;
ROLLBACK;
