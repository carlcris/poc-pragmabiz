-- Run as postgres against a migrated local database. Fixture changes roll back.
BEGIN;

REVOKE SELECT ON public.document_code_sequences FROM authenticated, PUBLIC;

CREATE TEMP TABLE padding_test_documents (
  company_id UUID NOT NULL,
  code TEXT,
  force_failure BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  UNIQUE (company_id, code)
);
CREATE TRIGGER assign_test_document_code
BEFORE INSERT ON padding_test_documents
FOR EACH ROW EXECUTE FUNCTION public.apply_generated_document_code('code', '__PADDING_TEST', '9');

CREATE FUNCTION pg_temp.fail_padding_test_document()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.force_failure THEN
    RAISE EXCEPTION 'TEST_FORCED_FAILURE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER fail_test_document
AFTER INSERT ON padding_test_documents
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_padding_test_document();
GRANT SELECT, INSERT ON padding_test_documents TO authenticated;

DO $$
DECLARE
  v_company UUID;
  v_other_company UUID := gen_random_uuid();
  v_warehouse UUID;
  v_business_unit UUID;
  v_user UUID;
  v_parent UUID;
  v_parent_code TEXT := '__PAD_' || left(gen_random_uuid()::TEXT, 8);
  v_code TEXT;
  v_initial_code TEXT;
  v_row_count INTEGER;
  v_global_number BIGINT := 710000000000000000;
  v_dense_start BIGINT := 710000000000100000;
  v_dense_count INTEGER := 100000;
BEGIN
  SELECT warehouse.company_id, warehouse.id, warehouse.business_unit_id, actor.id
  INTO v_company, v_warehouse, v_business_unit, v_user
  FROM public.warehouses warehouse
  JOIN public.users actor ON actor.company_id = warehouse.company_id
  WHERE warehouse.deleted_at IS NULL AND warehouse.is_active
    AND actor.deleted_at IS NULL AND actor.is_active
    AND public.user_has_permission(actor.id, 'company_settings', 'edit', NULL)
    AND public.user_has_permission(actor.id, 'manage_locations', 'create', warehouse.business_unit_id)
    AND EXISTS (
      SELECT 1 FROM public.user_business_unit_access access
      WHERE access.user_id = actor.id AND access.business_unit_id = warehouse.business_unit_id
    )
  LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTHORIZED_FIXTURE_REQUIRED'; END IF;

  INSERT INTO public.companies(id, code, name)
  VALUES (v_other_company, 'PAD-' || left(v_other_company::TEXT, 12), 'Padding test other company');
  IF NOT EXISTS (
    SELECT 1 FROM public.companies company
    WHERE company.id = v_other_company AND company.document_code_digits = 9
      AND company.warehouse_location_code_digits = 2
  ) THEN RAISE EXCEPTION 'PADDING_DEFAULTS_FAILED'; END IF;

  UPDATE public.companies
  SET document_code_digits = 9, warehouse_location_code_digits = 2
  WHERE id = v_company;
  DELETE FROM public.document_code_sequences
  WHERE company_id IN (v_company, v_other_company)
    AND code_prefix IN ('__PADDING_TEST', '__PADDING_EXPLICIT_WIDTH');

  INSERT INTO padding_test_documents(company_id) VALUES (v_company) RETURNING code INTO v_initial_code;
  IF v_initial_code <> '__PADDING_TEST-000000001' THEN
    RAISE EXCEPTION 'DOCUMENT_DEFAULT_PADDING_FAILED';
  END IF;
  INSERT INTO padding_test_documents(company_id) VALUES (v_other_company) RETURNING code INTO v_code;
  IF v_code <> v_initial_code THEN RAISE EXCEPTION 'COMPANY_SEQUENCE_ISOLATION_FAILED'; END IF;

  INSERT INTO public.warehouse_locations(company_id, warehouse_id, code, location_type)
  VALUES (v_company, v_warehouse, v_parent_code, 'zone') RETURNING id INTO v_parent;

  PERFORM set_config('request.jwt.claim.sub', v_user::TEXT, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_user, 'role', 'authenticated', 'current_business_unit_id', v_business_unit
  )::TEXT, true);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.warehouse_locations(company_id, warehouse_id, parent_id, location_type)
  VALUES (v_company, v_warehouse, v_parent, 'rack') RETURNING code INTO v_code;
  IF v_code <> v_parent_code || '-R01' THEN RAISE EXCEPTION 'LOCATION_DEFAULT_PADDING_FAILED'; END IF;

  UPDATE public.companies
  SET document_code_digits = 3, warehouse_location_code_digits = 4
  WHERE id = v_company;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count <> 1 THEN RAISE EXCEPTION 'AUTHORIZED_SETTING_SAVE_FAILED'; END IF;

  UPDATE public.companies SET document_code_digits = 6 WHERE id = v_other_company;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count <> 0 THEN RAISE EXCEPTION 'CROSS_COMPANY_SETTING_UPDATE_ACCEPTED'; END IF;

  INSERT INTO padding_test_documents(company_id) VALUES (v_company) RETURNING code INTO v_code;
  IF v_code <> '__PADDING_TEST-002' THEN RAISE EXCEPTION 'DOCUMENT_SETTING_IGNORED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM padding_test_documents WHERE code = v_initial_code) THEN
    RAISE EXCEPTION 'HISTORICAL_DOCUMENT_CHANGED';
  END IF;

  INSERT INTO public.warehouse_locations(company_id, warehouse_id, parent_id, location_type)
  VALUES (v_company, v_warehouse, v_parent, 'rack') RETURNING code INTO v_code;
  IF v_code <> v_parent_code || '-R0002' THEN RAISE EXCEPTION 'LOCATION_SETTING_IGNORED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.warehouse_locations
    WHERE parent_id = v_parent AND code = v_parent_code || '-R01'
  ) THEN RAISE EXCEPTION 'HISTORICAL_LOCATION_CHANGED'; END IF;

  BEGIN
    INSERT INTO padding_test_documents(company_id, force_failure) VALUES (v_company, true);
    RAISE EXCEPTION 'FORCED_DOCUMENT_FAILURE_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'TEST_FORCED_FAILURE' THEN RAISE; END IF;
  END;
  INSERT INTO padding_test_documents(company_id) VALUES (v_company) RETURNING code INTO v_code;
  IF v_code <> '__PADDING_TEST-003'
    OR EXISTS (SELECT 1 FROM padding_test_documents WHERE force_failure) THEN
    RAISE EXCEPTION 'DOCUMENT_ALLOCATION_ROLLBACK_FAILED';
  END IF;

  RESET ROLE;
  -- Trusted imports can occupy codes ahead of the allocator, including deleted history.
  ALTER TABLE padding_test_documents DISABLE TRIGGER assign_test_document_code;
  INSERT INTO padding_test_documents(company_id, code, deleted_at)
  VALUES (v_company, '__PADDING_TEST-004', NULL),
         (v_company, '__PADDING_TEST-005', now()),
         (v_other_company, '__PADDING_TEST-006', NULL);
  ALTER TABLE padding_test_documents ENABLE TRIGGER assign_test_document_code;
  SET LOCAL ROLE authenticated;
  INSERT INTO padding_test_documents(company_id) VALUES (v_company) RETURNING code INTO v_code;
  IF v_code <> '__PADDING_TEST-006' THEN
    RAISE EXCEPTION 'RESERVED_COMPANY_CODES_NOT_SKIPPED: %', v_code;
  END IF;

  RESET ROLE;
  ALTER TABLE padding_test_documents DISABLE TRIGGER assign_test_document_code;
  INSERT INTO padding_test_documents(company_id, code)
  VALUES (v_company, '__PADDING_TEST-007'), (v_company, '__PADDING_TEST-008');
  ALTER TABLE padding_test_documents ENABLE TRIGGER assign_test_document_code;
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO padding_test_documents(company_id, force_failure) VALUES (v_company, true);
    RAISE EXCEPTION 'FORCED_SKIP_FAILURE_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'TEST_FORCED_FAILURE' THEN RAISE; END IF;
  END;
  RESET ROLE;
  IF NOT EXISTS (
    SELECT 1 FROM public.document_code_sequences
    WHERE company_id = v_company AND code_prefix = '__PADDING_TEST' AND last_number = 6
  ) THEN RAISE EXCEPTION 'SKIPPED_ALLOCATION_COUNTER_NOT_ROLLED_BACK'; END IF;
  SET LOCAL ROLE authenticated;
  INSERT INTO padding_test_documents(company_id) VALUES (v_company) RETURNING code INTO v_code;
  IF v_code <> '__PADDING_TEST-009'
    OR EXISTS (SELECT 1 FROM padding_test_documents WHERE force_failure) THEN
    RAISE EXCEPTION 'SKIPPED_ALLOCATION_ROLLBACK_FAILED';
  END IF;

  BEGIN
    UPDATE public.companies SET document_code_digits = 0 WHERE id = v_company;
    RAISE EXCEPTION 'INVALID_DOCUMENT_PADDING_ACCEPTED';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.companies SET warehouse_location_code_digits = 7 WHERE id = v_company;
    RAISE EXCEPTION 'INVALID_LOCATION_PADDING_ACCEPTED';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  RESET ROLE;
  -- POS has both company and global unique constraints. A different company's
  -- occupied candidate must be skipped even when its row is hidden by RLS.
  INSERT INTO public.document_code_sequences(company_id, code_prefix, last_number)
  VALUES (v_other_company, 'POS', v_global_number), (v_company, 'POS', v_global_number)
  ON CONFLICT (company_id, code_prefix) DO UPDATE SET last_number = EXCLUDED.last_number;
  INSERT INTO public.pos_transactions(
    company_id, business_unit_id, subtotal, total_amount, amount_paid, cashier_id, cashier_name
  ) VALUES (v_other_company, NULL, 0, 0, 0, v_user, 'Padding test import')
  RETURNING transaction_code INTO v_code;
  IF v_code <> 'POS-' || (v_global_number + 1)::TEXT THEN
    RAISE EXCEPTION 'GLOBAL_CODE_FIXTURE_FAILED';
  END IF;
  SET LOCAL ROLE authenticated;
  IF EXISTS (
    SELECT 1 FROM public.pos_transactions
    WHERE company_id = v_other_company AND transaction_code = v_code
  ) THEN RAISE EXCEPTION 'CROSS_COMPANY_CODE_FIXTURE_VISIBLE'; END IF;
  INSERT INTO public.pos_transactions(
    company_id, business_unit_id, subtotal, total_amount, amount_paid, cashier_id, cashier_name
  ) VALUES (v_company, v_business_unit, 0, 0, 0, v_user, 'Padding test cashier')
  RETURNING transaction_code INTO v_code;
  IF v_code <> 'POS-' || (v_global_number + 2)::TEXT THEN
    RAISE EXCEPTION 'GLOBAL_CROSS_COMPANY_CODE_NOT_SKIPPED: %', v_code;
  END IF;

  RESET ROLE;
  -- Imported history can fill a long range in another company's global POS series.
  -- A later sparse reservation must not cause allocation to skip the first gap.
  ALTER TABLE public.pos_transactions DISABLE TRIGGER trigger_generate_pos_transaction_code;
  INSERT INTO public.pos_transactions(
    company_id, transaction_code, subtotal, total_amount, amount_paid, cashier_id, cashier_name
  )
  SELECT v_other_company, 'POS-' || (v_dense_start + ordinal)::TEXT,
    0, 0, 0, v_user, 'Padding dense import'
  FROM generate_series(0, v_dense_count - 1) ordinal;
  INSERT INTO public.pos_transactions(
    company_id, transaction_code, subtotal, total_amount, amount_paid, cashier_id, cashier_name
  ) VALUES (
    v_other_company, 'POS-' || (v_dense_start + v_dense_count + 1000)::TEXT,
    0, 0, 0, v_user, 'Padding sparse import'
  );
  ALTER TABLE public.pos_transactions ENABLE TRIGGER trigger_generate_pos_transaction_code;
  UPDATE public.document_code_sequences SET last_number = v_dense_start - 1
  WHERE company_id = v_company AND code_prefix = 'POS';
  SET LOCAL ROLE authenticated;
  INSERT INTO public.pos_transactions(
    company_id, business_unit_id, subtotal, total_amount, amount_paid, cashier_id, cashier_name
  ) VALUES (v_company, v_business_unit, 0, 0, 0, v_user, 'Padding dense range cashier')
  RETURNING transaction_code INTO v_code;
  IF v_code <> 'POS-' || (v_dense_start + v_dense_count)::TEXT THEN
    RAISE EXCEPTION 'DENSE_GLOBAL_RANGE_GAP_FAILED: %', v_code;
  END IF;
  RESET ROLE;
  IF NOT EXISTS (
    SELECT 1 FROM public.document_code_sequences
    WHERE company_id = v_company AND code_prefix = 'POS'
      AND last_number = v_dense_start + v_dense_count
  ) THEN RAISE EXCEPTION 'DENSE_GLOBAL_RANGE_COUNTER_FAILED'; END IF;

  INSERT INTO padding_test_documents(company_id) VALUES (v_other_company) RETURNING code INTO v_code;
  IF v_code <> '__PADDING_TEST-000000002' THEN RAISE EXCEPTION 'COMPANY_PADDING_ISOLATION_FAILED'; END IF;

  UPDATE public.companies SET document_code_digits = 2 WHERE id = v_company;
  UPDATE public.document_code_sequences SET last_number = 98
  WHERE company_id = v_company AND code_prefix = '__PADDING_TEST';
  ALTER TABLE padding_test_documents DISABLE TRIGGER assign_test_document_code;
  INSERT INTO padding_test_documents(company_id, code)
  VALUES (v_company, '__PADDING_TEST-99'), (v_company, '__PADDING_TEST-100'),
         (v_company, '__PADDING_TEST-00101'), (v_company, '__PADDING_TEST-101X'),
         (v_company, '__PADDING_TEST-102');
  ALTER TABLE padding_test_documents ENABLE TRIGGER assign_test_document_code;
  SET LOCAL ROLE authenticated;
  INSERT INTO padding_test_documents(company_id) VALUES (v_company) RETURNING code INTO v_code;
  IF v_code <> '__PADDING_TEST-101' THEN
    RAISE EXCEPTION 'WIDTH_BOUNDARY_OR_NONCANONICAL_RESERVATION_FAILED: %', v_code;
  END IF;
  RESET ROLE;

  UPDATE public.document_code_sequences SET last_number = 999
  WHERE company_id = v_company AND code_prefix = '__PADDING_TEST';
  SET LOCAL ROLE authenticated;
  INSERT INTO padding_test_documents(company_id) VALUES (v_company) RETURNING code INTO v_code;
  IF v_code <> '__PADDING_TEST-1000' THEN RAISE EXCEPTION 'DOCUMENT_OVERFLOW_TRUNCATED'; END IF;

  UPDATE public.companies SET document_code_digits = 1 WHERE id = v_company;
  INSERT INTO padding_test_documents(company_id) VALUES (v_company) RETURNING code INTO v_code;
  IF v_code <> '__PADDING_TEST-1001' THEN RAISE EXCEPTION 'MINIMUM_DOCUMENT_WIDTH_FAILED'; END IF;
  UPDATE public.companies SET document_code_digits = 18 WHERE id = v_company;
  INSERT INTO padding_test_documents(company_id) VALUES (v_company) RETURNING code INTO v_code;
  IF v_code <> '__PADDING_TEST-000000000000001002' THEN
    RAISE EXCEPTION 'MAXIMUM_DOCUMENT_WIDTH_FAILED';
  END IF;

  RESET ROLE;
  ALTER TABLE padding_test_documents DISABLE TRIGGER assign_test_document_code;
  INSERT INTO padding_test_documents(company_id, code)
  VALUES (v_company, '__PADDING_TEST-9223372036854775807');
  ALTER TABLE padding_test_documents ENABLE TRIGGER assign_test_document_code;
  UPDATE public.document_code_sequences SET last_number = 9223372036854775806
  WHERE company_id = v_company AND code_prefix = '__PADDING_TEST';
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO padding_test_documents(company_id) VALUES (v_company);
    RAISE EXCEPTION 'EXHAUSTED_DOCUMENT_SEQUENCE_ACCEPTED';
  EXCEPTION WHEN numeric_value_out_of_range THEN NULL;
  END;
  RESET ROLE;
  IF NOT EXISTS (
    SELECT 1 FROM public.document_code_sequences
    WHERE company_id = v_company AND code_prefix = '__PADDING_TEST'
      AND last_number = 9223372036854775806
  ) THEN RAISE EXCEPTION 'EXHAUSTED_DOCUMENT_COUNTER_NOT_ROLLED_BACK'; END IF;
  SET LOCAL ROLE authenticated;
  IF public.generate_document_code(v_company, '__PADDING_EXPLICIT_WIDTH', 2)
    <> '__PADDING_EXPLICIT_WIDTH-01' THEN
    RAISE EXCEPTION 'EXPLICIT_ALLOCATOR_WIDTH_CHANGED';
  END IF;

  UPDATE public.companies SET warehouse_location_code_digits = 1 WHERE id = v_company;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, parent_id, location_type)
  VALUES (v_company, v_warehouse, v_parent, 'rack') RETURNING code INTO v_code;
  IF v_code <> v_parent_code || '-R3' THEN RAISE EXCEPTION 'UNPADDED_LOCATION_FAILED'; END IF;

  UPDATE public.companies SET warehouse_location_code_digits = 6 WHERE id = v_company;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, parent_id, location_type)
  VALUES (v_company, v_warehouse, v_parent, 'rack') RETURNING code INTO v_code;
  IF v_code <> v_parent_code || '-R000004' THEN RAISE EXCEPTION 'MAXIMUM_LOCATION_WIDTH_FAILED'; END IF;

  RESET ROLE;
  UPDATE public.document_code_sequences SET last_number = 999999
  WHERE company_id = v_company
    AND code_prefix = 'warehouse-location:' || v_warehouse::TEXT || ':' || v_parent_code || '-R';
  SET LOCAL ROLE authenticated;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, parent_id, location_type)
  VALUES (v_company, v_warehouse, v_parent, 'rack') RETURNING code INTO v_code;
  IF v_code <> v_parent_code || '-R1000000' THEN RAISE EXCEPTION 'LOCATION_OVERFLOW_TRUNCATED'; END IF;

  RESET ROLE;
END;
$$;

ROLLBACK;
