-- Run with psql -v ON_ERROR_STOP=1. All fixtures and changes roll back.
BEGIN;
CREATE FUNCTION pg_temp.fail_copy_test_row() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code = '__CP-C-S1-02' THEN RAISE EXCEPTION 'TEST_FORCED_ROW_FAILURE'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fail_copy_test_row BEFORE INSERT ON public.warehouse_locations
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_copy_test_row();

DO $$
DECLARE
  v_company UUID; v_warehouse UUID; v_bu UUID; v_user UUID;
  v_rack UUID; v_shelf UUID; v_big UUID; v_new_root UUID;
  v_row RECORD; v_count INTEGER;
BEGIN
  SELECT w.company_id, w.id, w.business_unit_id INTO v_company, v_warehouse, v_bu
  FROM public.warehouses w WHERE w.deleted_at IS NULL AND w.is_active LIMIT 1;
  SELECT u.id INTO v_user FROM public.users u
  WHERE u.company_id = v_company AND u.is_active
    AND public.user_has_permission(u.id, 'manage_locations', 'create', v_bu)
    AND EXISTS (SELECT 1 FROM public.user_business_unit_access a WHERE a.user_id = u.id AND a.business_unit_id = v_bu)
  LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'TEST_REQUIRES_AUTHORIZED_SEED_USER'; END IF;

  INSERT INTO public.warehouse_locations(company_id, warehouse_id, code, name, location_type, is_storable)
    VALUES(v_company, v_warehouse, '__CP-A', 'Rack A', 'rack', false) RETURNING id INTO v_rack;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, parent_id, code, location_type, is_storable)
    VALUES(v_company, v_warehouse, v_rack, '__CP-A-S1', 'shelf', false) RETURNING id INTO v_shelf;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, parent_id, code, location_type)
    VALUES(v_company, v_warehouse, v_rack, '__CP-A-S2', 'shelf');
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, parent_id, code, name, location_type, max_capacity)
    VALUES(v_company, v_warehouse, v_shelf, '__CP-A-S1-01', 'Bin 1', 'bin', 40),
          (v_company, v_warehouse, v_shelf, '__CP-A-S1-02', 'Bin 2', 'bin', 40);
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, code, location_type, is_storable)
    VALUES(v_company, v_warehouse, '__CP-BIG', 'zone', false) RETURNING id INTO v_big;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, parent_id, code, location_type)
    SELECT v_company, v_warehouse, v_big, '__CP-BIG-' || n, 'bin' FROM generate_series(1, 200) n;

  PERFORM set_config('request.jwt.claim.sub', v_user::TEXT, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user, 'role', 'authenticated')::TEXT, true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) AS planned, COUNT(*) FILTER (WHERE already_exists) AS conflicts INTO v_row
  FROM public.plan_warehouse_location_copy(v_bu, v_rack, '__CP-A', '__CP-B', NULL, 'Rack A', 'Rack B');
  IF v_row.planned <> 5 OR v_row.conflicts <> 0 THEN RAISE EXCEPTION 'PLAN_SIZE_FAILED: %', row_to_json(v_row); END IF;
  SELECT location_path INTO v_row FROM public.plan_warehouse_location_copy(v_bu, v_rack, '__CP-A', '__CP-B', NULL, 'Rack A', 'Rack B')
  WHERE code = '__CP-B-S1-01';
  IF v_row.location_path <> '__CP-B - Rack B / __CP-B-S1 / __CP-B-S1-01 - Bin 1' THEN RAISE EXCEPTION 'PLAN_PATH_FAILED: %', v_row.location_path; END IF;

  SELECT * INTO v_row FROM public.copy_warehouse_location_structure(v_bu, v_rack, '__CP-A', '__CP-B', NULL, 'Rack A', 'Rack B');
  IF v_row.created_count <> 5 THEN RAISE EXCEPTION 'COPY_COUNT_FAILED: %', row_to_json(v_row); END IF;
  v_new_root := v_row.root_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.warehouse_locations l
    WHERE l.id = v_new_root AND l.parent_id IS NULL AND l.code = '__CP-B' AND l.name = 'Rack B'
      AND l.location_type = 'rack' AND NOT l.is_storable AND l.created_by = v_user
  ) THEN RAISE EXCEPTION 'COPY_ROOT_FAILED'; END IF;
  SELECT COUNT(*) INTO v_count FROM public.warehouse_locations l
  WHERE l.path_ids @> ARRAY[v_new_root] AND l.code = '__CP-B-S1-01' AND l.max_capacity = 40
    AND l.location_path = '__CP-B - Rack B / __CP-B-S1 / __CP-B-S1-01 - Bin 1'
    AND l.parent_id = (SELECT s.id FROM public.warehouse_locations s WHERE s.code = '__CP-B-S1' AND s.parent_id = v_new_root);
  IF v_count <> 1 THEN RAISE EXCEPTION 'COPY_CHILD_LINKS_FAILED'; END IF;
  SELECT COUNT(*) INTO v_count FROM public.warehouse_locations l WHERE l.path_ids @> ARRAY[v_rack];
  IF v_count <> 5 THEN RAISE EXCEPTION 'SOURCE_CHANGED: %', v_count; END IF;

  -- A copy into its own branch, conflicting codes, and codes that collapse together are rejected.
  BEGIN
    PERFORM public.plan_warehouse_location_copy(v_bu, v_rack, '__CP-A', '__CP-X', v_shelf);
    RAISE EXCEPTION 'COPY_INTO_SELF_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_HIERARCHY_CYCLE' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.copy_warehouse_location_structure(v_bu, v_rack, '__CP-A', '__CP-B');
    RAISE EXCEPTION 'CONFLICT_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_CODE_EXISTS' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.plan_warehouse_location_copy(v_bu, v_rack, 'S1', 'S2');
    RAISE EXCEPTION 'DUPLICATE_CODES_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_COPY_INVALID' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.plan_warehouse_location_copy(v_bu, v_big, '__CP-BIG', '__CP-HUGE');
    RAISE EXCEPTION 'OVERSIZED_COPY_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_COPY_TOO_LARGE' THEN RAISE; END IF;
  END;

  -- A failure on a third-level row must leave none of the earlier levels behind.
  BEGIN
    PERFORM public.copy_warehouse_location_structure(v_bu, v_rack, '__CP-A', '__CP-C');
    RAISE EXCEPTION 'FORCED_FAILURE_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'TEST_FORCED_ROW_FAILURE' THEN RAISE; END IF;
  END;
  SELECT COUNT(*) INTO v_count FROM public.warehouse_locations WHERE code LIKE '\_\_CP-C%';
  IF v_count <> 0 THEN RAISE EXCEPTION 'PARTIAL_COPY_COMMITTED: %', v_count; END IF;

  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::TEXT, true);
  PERFORM set_config('request.jwt.claims', '{}'::TEXT, true);
  BEGIN
    PERFORM public.copy_warehouse_location_structure(v_bu, v_rack, '__CP-A', '__CP-U');
    RAISE EXCEPTION 'UNAUTHORIZED_COPY_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_WAREHOUSE_INVALID' THEN RAISE; END IF;
  END;
  RESET ROLE;
  RAISE NOTICE 'PASS: copy plan addresses, copied links and settings, self/conflict/duplicate/size rejection, forced mid-copy rollback, unauthorized rejection';
END $$;
ROLLBACK;
