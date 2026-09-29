-- Run only against a coordinated disposable, seeded DB after applying migrations:
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/production-material-request-lifecycle.sql
-- All fixtures, fault-injection triggers, and stock changes are rolled back.
BEGIN;

CREATE TEMP TABLE material_request_test_context ON COMMIT DROP AS
SELECT actor.id AS actor_id, actor.company_id, access_row.business_unit_id,
       warehouse.id AS warehouse_id, customer.id AS customer_id
FROM public.users actor
JOIN public.user_business_unit_access access_row ON access_row.user_id = actor.id
JOIN public.warehouses warehouse ON warehouse.company_id = actor.company_id
  AND warehouse.business_unit_id = access_row.business_unit_id
  AND warehouse.is_active IS TRUE AND warehouse.deleted_at IS NULL
JOIN public.customers customer ON customer.company_id = actor.company_id
  AND customer.deleted_at IS NULL
WHERE actor.is_active IS TRUE AND actor.deleted_at IS NULL
  AND public.user_has_permission(actor.id, 'stock_requests', 'create', access_row.business_unit_id)
  AND public.user_has_permission(actor.id, 'stock_requests', 'edit', access_row.business_unit_id)
  AND (public.user_has_permission(actor.id, 'manufacturing', 'edit', access_row.business_unit_id)
    OR public.user_has_permission(actor.id, 'stock_transformations', 'edit', access_row.business_unit_id))
LIMIT 1;

CREATE TEMP TABLE material_request_test_items ON COMMIT DROP AS
SELECT item.id, item.uom_id
FROM public.items item
JOIN material_request_test_context context ON context.company_id = item.company_id
WHERE item.is_stock_item IS TRUE AND item.is_active IS TRUE AND item.deleted_at IS NULL
ORDER BY item.id
LIMIT 2;

CREATE FUNCTION pg_temp.make_material_request_test_job(p_issued NUMERIC DEFAULT 0)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_context RECORD;
  v_job_id UUID;
  v_order_id UUID;
BEGIN
  SELECT actor_id, company_id, business_unit_id, customer_id INTO STRICT v_context
  FROM material_request_test_context;
  INSERT INTO public.frame_job_orders (
    company_id, business_unit_id, customer_id, status, created_by, updated_by
  ) VALUES (
    v_context.company_id, v_context.business_unit_id, v_context.customer_id, 'queued',
    v_context.actor_id, v_context.actor_id
  ) RETURNING id INTO v_job_id;
  INSERT INTO public.frame_job_order_items (
    company_id, job_order_id, item_id, required_quantity, issued_quantity, uom_id,
    created_by, updated_by
  ) SELECT v_context.company_id, v_job_id, item.id, 10, p_issued, item.uom_id,
      v_context.actor_id, v_context.actor_id FROM material_request_test_items item;
  INSERT INTO public.manufacturing_orders (
    company_id, business_unit_id, source_type, source_id, frame_job_order_id,
    customer_id, status, created_by, updated_by
  ) VALUES (
    v_context.company_id, v_context.business_unit_id, 'frame_job_order', v_job_id, v_job_id,
    v_context.customer_id, 'ready', v_context.actor_id, v_context.actor_id
  ) RETURNING id INTO v_order_id;
  INSERT INTO public.manufacturing_operations (
    company_id, manufacturing_order_id, operation_code, operation_name, sequence_no,
    status, created_by, updated_by
  ) VALUES
    (v_context.company_id, v_order_id, 'CUT', 'Cut', 1, 'pending', v_context.actor_id, v_context.actor_id),
    (v_context.company_id, v_order_id, 'READY', 'Ready', 2, 'pending', v_context.actor_id, v_context.actor_id);
  RETURN v_job_id;
END;
$$;

CREATE FUNCTION pg_temp.fail_material_request_completion() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.custom_fields ->> 'testFailCompletion' = 'true' THEN
    RAISE EXCEPTION 'TEST_COMPLETION_FAILURE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_fail_material_request_completion
  BEFORE UPDATE ON public.frame_job_orders FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION pg_temp.fail_material_request_completion();

CREATE FUNCTION pg_temp.fail_material_request_issue() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('test.fail_issue_request', true) = NEW.id::TEXT THEN
    RAISE EXCEPTION 'TEST_ISSUE_FAILURE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_fail_material_request_issue
  BEFORE UPDATE ON public.production_material_requests FOR EACH ROW
  WHEN (NEW.status = 'issued')
  EXECUTE FUNCTION pg_temp.fail_material_request_issue();

DO $$
DECLARE
  v_context RECORD;
  v_job UUID;
  v_sibling UUID;
  v_order UUID;
  v_request UUID;
  v_item UUID;
  v_stock NUMERIC;
  v_reserved NUMERIC;
  v_count BIGINT;
BEGIN
  SELECT actor_id, company_id, business_unit_id, warehouse_id INTO STRICT v_context
  FROM material_request_test_context;
  IF (SELECT COUNT(*) FROM material_request_test_items) <> 2 THEN
    RAISE EXCEPTION 'Test requires two active stock items in the seeded company';
  END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_context.actor_id, 'role', 'authenticated',
    'current_business_unit_id', v_context.business_unit_id
  )::TEXT, true);
  IF has_function_privilege('authenticated',
    'public.close_unissued_production_material_request(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Internal reservation release must not be publicly callable';
  END IF;

  INSERT INTO public.item_warehouse (
    company_id, warehouse_id, item_id, current_stock, reserved_stock, created_by, updated_by
  ) SELECT v_context.company_id, v_context.warehouse_id, item.id, 10000, 0,
      v_context.actor_id, v_context.actor_id FROM material_request_test_items item
  ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE
  SET current_stock = COALESCE(item_warehouse.reserved_stock, 0) + 10000,
      is_active = true, deleted_at = NULL;
  SELECT SUM(stock.current_stock), SUM(COALESCE(stock.reserved_stock, 0))
  INTO v_stock, v_reserved FROM public.item_warehouse stock
  JOIN material_request_test_items item ON item.id = stock.item_id
  WHERE stock.warehouse_id = v_context.warehouse_id;

  -- No request: start, both complete_step calls, and direct completion all work.
  v_sibling := pg_temp.make_material_request_test_job();
  BEGIN
    PERFORM public.finalize_frame_job_order_completion_transaction(v_sibling);
    RAISE EXCEPTION 'TEST_EXPECTED_PRODUCTION_INCOMPLETE';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Production must be completed before the job order can be completed' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claims', '{}', true);
  BEGIN
    PERFORM public.finalize_frame_job_order_completion_transaction(v_sibling);
    RAISE EXCEPTION 'TEST_EXPECTED_AUTHENTICATION_REQUIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Authentication required' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_context.actor_id, 'role', 'authenticated',
    'current_business_unit_id', v_context.business_unit_id
  )::TEXT, true);
  v_job := pg_temp.make_material_request_test_job();
  SELECT id INTO v_order FROM public.manufacturing_orders WHERE frame_job_order_id = v_job;
  PERFORM public.apply_manufacturing_floor_action_transaction(v_order, 'start');
  PERFORM public.apply_manufacturing_floor_action_transaction(v_order, 'complete_step');
  PERFORM public.apply_manufacturing_floor_action_transaction(v_order, 'complete_step');
  PERFORM public.complete_frame_job_order_transaction(v_job);
  IF (SELECT status FROM public.frame_job_orders WHERE id = v_job) <> 'completed'
    OR EXISTS (SELECT 1 FROM public.frame_job_order_items WHERE job_order_id = v_job AND issued_quantity <> 0)
    OR EXISTS (SELECT 1 FROM public.stock_transactions WHERE reference_id = v_job)
    OR (SELECT status FROM public.frame_job_orders WHERE id = v_sibling) <> 'queued' THEN
    RAISE EXCEPTION 'Residual completion changed issue history, inventory, or another job';
  END IF;

  -- Inactive demand must reject the entire request, not capture only one item.
  v_job := pg_temp.make_material_request_test_job();
  SELECT id INTO v_item FROM material_request_test_items ORDER BY id LIMIT 1;
  UPDATE public.items SET is_active = false WHERE id = v_item;
  BEGIN
    PERFORM public.create_production_material_request_transaction(v_job, v_context.warehouse_id);
    RAISE EXCEPTION 'TEST_EXPECTED_UNAVAILABLE_MATERIAL';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'PRODUCTION_MATERIAL_REQUEST_MATERIAL_UNAVAILABLE' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.production_material_requests WHERE frame_job_order_id = v_job) THEN
    RAISE EXCEPTION 'Unavailable demand left a partial request';
  END IF;
  UPDATE public.items SET is_active = true WHERE id = v_item;

  -- Draft request is closed on completion without reserving or consuming stock.
  v_request := public.create_production_material_request_transaction(v_job, v_context.warehouse_id);
  -- Fail on the second item after approval would have reserved the first.
  SELECT id INTO v_item FROM material_request_test_items ORDER BY id DESC LIMIT 1;
  UPDATE public.item_warehouse SET current_stock = COALESCE(reserved_stock, 0)
  WHERE warehouse_id = v_context.warehouse_id AND item_id = v_item;
  BEGIN
    PERFORM public.approve_production_material_request_transaction(v_job);
    RAISE EXCEPTION 'TEST_EXPECTED_INSUFFICIENT_STOCK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'PRODUCTION_MATERIAL_REQUEST_INSUFFICIENT_STOCK' THEN RAISE; END IF;
  END;
  IF (SELECT status FROM public.production_material_requests WHERE id = v_request) <> 'draft'
    OR EXISTS (SELECT 1 FROM public.inventory_reservations WHERE production_material_request_id = v_request)
    OR (SELECT SUM(stock.reserved_stock) FROM public.item_warehouse stock
      JOIN material_request_test_items item ON item.id = stock.item_id
      WHERE stock.warehouse_id = v_context.warehouse_id) <> v_reserved THEN
    RAISE EXCEPTION 'Approval failure left a partial reservation';
  END IF;
  UPDATE public.item_warehouse SET current_stock = COALESCE(reserved_stock, 0) + 10000
  WHERE warehouse_id = v_context.warehouse_id AND item_id = v_item;
  SELECT id INTO v_order FROM public.manufacturing_orders WHERE frame_job_order_id = v_job;
  PERFORM public.apply_manufacturing_floor_action_transaction(v_order, 'complete');
  IF (SELECT status FROM public.production_material_requests WHERE id = v_request) <> 'cancelled' THEN
    RAISE EXCEPTION 'Completion left its draft request open';
  END IF;

  -- Partial prior issue + approved remaining demand: force failure after release
  -- would have happened, proving request, reservations, operations and MO rollback.
  v_job := pg_temp.make_material_request_test_job(3);
  v_request := public.create_production_material_request_transaction(v_job, v_context.warehouse_id);
  PERFORM public.approve_production_material_request_transaction(v_job);
  SELECT id INTO v_order FROM public.manufacturing_orders WHERE frame_job_order_id = v_job;
  UPDATE public.frame_job_orders SET custom_fields = '{"testFailCompletion":true}' WHERE id = v_job;
  BEGIN
    PERFORM public.apply_manufacturing_floor_action_transaction(v_order, 'complete');
    RAISE EXCEPTION 'TEST_EXPECTED_COMPLETION_FAILURE';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'TEST_COMPLETION_FAILURE' THEN RAISE; END IF;
  END;
  IF (SELECT status FROM public.manufacturing_orders WHERE id = v_order) <> 'ready'
    OR (SELECT status FROM public.frame_job_orders WHERE id = v_job) <> 'queued'
    OR (SELECT status FROM public.production_material_requests WHERE id = v_request) <> 'approved'
    OR EXISTS (SELECT 1 FROM public.manufacturing_operations
      WHERE manufacturing_order_id = v_order AND status <> 'pending')
    OR (SELECT COUNT(*) FROM public.inventory_reservations
      WHERE production_material_request_id = v_request AND status = 'active') <> 2
    OR (SELECT SUM(stock.reserved_stock) FROM public.item_warehouse stock
      JOIN material_request_test_items item ON item.id = stock.item_id
      WHERE stock.warehouse_id = v_context.warehouse_id) <> v_reserved + 14 THEN
    RAISE EXCEPTION 'Completion failure did not roll back all writes';
  END IF;
  UPDATE public.frame_job_orders SET custom_fields = '{}' WHERE id = v_job;
  PERFORM public.apply_manufacturing_floor_action_transaction(v_order, 'start');
  PERFORM public.apply_manufacturing_floor_action_transaction(v_order, 'hold');
  PERFORM public.apply_manufacturing_floor_action_transaction(v_order, 'complete');
  IF (SELECT status FROM public.production_material_requests WHERE id = v_request) <> 'cancelled'
    OR (SELECT COUNT(*) FROM public.inventory_reservations
      WHERE production_material_request_id = v_request AND status = 'released') <> 2
    OR EXISTS (SELECT 1 FROM public.frame_job_order_items WHERE job_order_id = v_job AND issued_quantity <> 3)
    OR EXISTS (SELECT 1 FROM public.stock_transactions WHERE reference_id = v_job)
    OR (SELECT SUM(stock.current_stock) FROM public.item_warehouse stock
      JOIN material_request_test_items item ON item.id = stock.item_id
      WHERE stock.warehouse_id = v_context.warehouse_id) <> v_stock
    OR (SELECT SUM(stock.reserved_stock) FROM public.item_warehouse stock
      JOIN material_request_test_items item ON item.id = stock.item_id
      WHERE stock.warehouse_id = v_context.warehouse_id) <> v_reserved THEN
    RAISE EXCEPTION 'Residual completion consumed stock, fabricated issue, or leaked reservations';
  END IF;
  BEGIN
    PERFORM public.issue_production_material_request_transaction(v_job);
    RAISE EXCEPTION 'TEST_EXPECTED_CLOSED_JOB';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'PRODUCTION_MATERIAL_REQUEST_JOB_CLOSED' THEN RAISE; END IF;
  END;

  -- Issue still owns actual deductions. Inject failure after those writes.
  v_job := pg_temp.make_material_request_test_job();
  v_request := public.create_production_material_request_transaction(v_job, v_context.warehouse_id);
  PERFORM public.approve_production_material_request_transaction(v_job);
  PERFORM set_config('test.fail_issue_request', v_request::TEXT, true);
  BEGIN
    PERFORM public.issue_production_material_request_transaction(v_job);
    RAISE EXCEPTION 'TEST_EXPECTED_ISSUE_FAILURE';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'TEST_ISSUE_FAILURE' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.stock_transactions WHERE reference_id = v_job)
    OR EXISTS (SELECT 1 FROM public.frame_job_order_items WHERE job_order_id = v_job AND issued_quantity <> 0)
    OR (SELECT COUNT(*) FROM public.inventory_reservations
      WHERE production_material_request_id = v_request AND status = 'active') <> 2
    OR (SELECT SUM(stock.current_stock) FROM public.item_warehouse stock
      JOIN material_request_test_items item ON item.id = stock.item_id
      WHERE stock.warehouse_id = v_context.warehouse_id) <> v_stock THEN
    RAISE EXCEPTION 'Issue failure left partial inventory writes';
  END IF;
  PERFORM set_config('test.fail_issue_request', '', true);
  PERFORM public.issue_production_material_request_transaction(v_job);
  SELECT id INTO v_order FROM public.manufacturing_orders WHERE frame_job_order_id = v_job;
  PERFORM public.apply_manufacturing_floor_action_transaction(v_order, 'complete');
  PERFORM public.complete_frame_job_order_transaction(v_job);
  SELECT COUNT(*) INTO v_count FROM public.stock_transactions WHERE reference_id = v_job;
  IF v_count <> 1
    OR (SELECT status FROM public.production_material_requests WHERE id = v_request) <> 'issued'
    OR (SELECT SUM(stock.current_stock) FROM public.item_warehouse stock
      JOIN material_request_test_items item ON item.id = stock.item_id
      WHERE stock.warehouse_id = v_context.warehouse_id) <> v_stock - 20
    OR (SELECT SUM(stock.reserved_stock) FROM public.item_warehouse stock
      JOIN material_request_test_items item ON item.id = stock.item_id
      WHERE stock.warehouse_id = v_context.warehouse_id) <> v_reserved THEN
    RAISE EXCEPTION 'Completion duplicated consumption or changed issued request history';
  END IF;
END;
$$;

ROLLBACK;
