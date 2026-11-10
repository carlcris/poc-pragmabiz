-- Run on a coordinated, seeded local DB after applying migrations:
-- docker exec -i supabase_db_backend psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/stock-move.sql
-- Fixtures, fault injection, permissions, and all stock changes are rolled back.
BEGIN;

CREATE TEMP TABLE stock_move_test_context ON COMMIT DROP AS
SELECT actor.id AS actor_id, actor.company_id, access_row.business_unit_id,
  item.id AS item_id, gen_random_uuid() AS source_warehouse_id,
  gen_random_uuid() AS destination_warehouse_id, gen_random_uuid() AS foreign_warehouse_id,
  gen_random_uuid() AS source_location_id, gen_random_uuid() AS destination_location_id,
  gen_random_uuid() AS other_location_id, gen_random_uuid() AS foreign_location_id,
  gen_random_uuid() AS old_batch_id, gen_random_uuid() AS new_batch_id,
  RPAD('MOVE-OLD-', 150, 'X') AS old_batch_code, 'MOVE-NEW'::TEXT AS new_batch_code
FROM public.users actor
JOIN public.user_business_unit_access access_row ON access_row.user_id = actor.id
JOIN public.items item ON item.company_id = actor.company_id
  AND item.is_active IS TRUE AND item.is_stock_item IS TRUE AND item.deleted_at IS NULL
WHERE actor.is_active IS TRUE AND actor.deleted_at IS NULL
  AND public.user_has_permission(actor.id, 'stock_transactions', 'create', access_row.business_unit_id)
  AND public.user_has_permission(actor.id, 'transfer_between_locations', 'create', access_row.business_unit_id)
ORDER BY actor.id, access_row.business_unit_id, item.id
LIMIT 1;

CREATE TEMP TABLE stock_move_denied_actor ON COMMIT DROP AS
SELECT actor.id FROM public.users actor JOIN stock_move_test_context context
  ON context.company_id = actor.company_id
WHERE actor.is_active IS TRUE AND actor.deleted_at IS NULL
  AND NOT public.user_has_permission(actor.id, 'transfer_between_locations', 'create', context.business_unit_id)
ORDER BY actor.id LIMIT 1;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM stock_move_test_context) OR NOT EXISTS (SELECT 1 FROM stock_move_denied_actor) THEN
    RAISE EXCEPTION 'Test needs an authorized stock mover, an unauthorized user, and an active stock item';
  END IF;
END $$;

INSERT INTO public.warehouses (id, company_id, business_unit_id, warehouse_code, warehouse_name,
  is_active, created_by, updated_by)
SELECT warehouse.id, context.company_id, context.business_unit_id,
  'MOVE-' || LEFT(warehouse.id::TEXT, 8), 'Move test warehouse', TRUE, context.actor_id, context.actor_id
FROM stock_move_test_context context
CROSS JOIN LATERAL (VALUES (context.source_warehouse_id), (context.destination_warehouse_id)) warehouse(id);

INSERT INTO public.warehouses (id, company_id, business_unit_id, warehouse_code, warehouse_name,
  is_active, created_by, updated_by)
SELECT context.foreign_warehouse_id, context.company_id, business_unit.id,
  'MOVE-FOREIGN-' || LEFT(context.foreign_warehouse_id::TEXT, 8), 'Other BU move test', TRUE,
  context.actor_id, context.actor_id
FROM stock_move_test_context context JOIN public.business_units business_unit
  ON business_unit.company_id = context.company_id AND business_unit.id <> context.business_unit_id
  AND business_unit.is_active IS TRUE LIMIT 1;

INSERT INTO public.warehouse_locations (id, company_id, warehouse_id, code, location_type,
  is_active, is_storable, is_pickable, created_by, updated_by)
SELECT location.id, context.company_id, location.warehouse_id, location.code, 'rack',
  TRUE, TRUE, TRUE, context.actor_id, context.actor_id
FROM stock_move_test_context context CROSS JOIN LATERAL (VALUES
  (context.source_location_id, context.source_warehouse_id, 'FROM'),
  (context.other_location_id, context.source_warehouse_id, 'OTHER'),
  (context.destination_location_id, context.destination_warehouse_id, 'TO'),
  (context.foreign_location_id, context.foreign_warehouse_id, 'FOREIGN')
) location(id, warehouse_id, code);

INSERT INTO public.item_warehouse (company_id, item_id, warehouse_id, current_stock, reserved_stock,
  putaway_qty, default_location_id, created_by, updated_by)
SELECT company_id, item_id, source_warehouse_id, 20, 2, 3, source_location_id, actor_id, actor_id
FROM stock_move_test_context;

INSERT INTO public.item_batches (id, company_id, item_id, warehouse_id, batch_code, received_at,
  expiration_date, qty_on_hand, qty_reserved, created_by, updated_by)
SELECT batch.id, context.company_id, context.item_id, context.source_warehouse_id, batch.code,
  batch.received_at, CASE WHEN batch.id = context.old_batch_id THEN DATE '2027-02-10' ELSE NULL END, batch.quantity, batch.reserved, context.actor_id, context.actor_id
FROM stock_move_test_context context CROSS JOIN LATERAL (VALUES
  (context.old_batch_id, context.old_batch_code, NOW() - INTERVAL '10 days', 10, 2),
  (context.new_batch_id, context.new_batch_code, NOW() - INTERVAL '1 day', 7, 0)
) batch(id, code, received_at, quantity, reserved);

INSERT INTO public.item_batch_locations (company_id, item_id, warehouse_id, location_id, item_batch_id,
  qty_on_hand, qty_reserved, created_by, updated_by)
SELECT context.company_id, context.item_id, context.source_warehouse_id, context.source_location_id,
  batch.id, batch.qty_on_hand, batch.qty_reserved, context.actor_id, context.actor_id
FROM stock_move_test_context context JOIN public.item_batches batch
  ON batch.id IN (context.old_batch_id, context.new_batch_id);

GRANT SELECT ON stock_move_test_context, stock_move_denied_actor TO authenticated;

CREATE FUNCTION pg_temp.stock_move_snapshot() RETURNS JSONB LANGUAGE SQL AS $$
  SELECT jsonb_build_object(
    'warehouses', (SELECT jsonb_agg(jsonb_build_array(stock.id, stock.current_stock,
      stock.reserved_stock, stock.putaway_qty, stock.default_location_id) ORDER BY stock.id)
      FROM public.item_warehouse stock JOIN stock_move_test_context context ON stock.item_id = context.item_id
      AND stock.warehouse_id IN (context.source_warehouse_id, context.destination_warehouse_id)),
    'batches', (SELECT jsonb_agg(jsonb_build_array(batch.id, batch.batch_code, batch.received_at, batch.expiration_date,
      batch.qty_on_hand, batch.qty_reserved) ORDER BY batch.id)
      FROM public.item_batches batch JOIN stock_move_test_context context ON batch.item_id = context.item_id
      AND batch.warehouse_id IN (context.source_warehouse_id, context.destination_warehouse_id)),
    'locations', (SELECT jsonb_agg(jsonb_build_array(stock.id, stock.item_batch_id, stock.location_id,
      stock.qty_on_hand, stock.qty_reserved, stock.batch_location_sku) ORDER BY stock.id)
      FROM public.item_batch_locations stock JOIN stock_move_test_context context ON stock.item_id = context.item_id
      AND stock.warehouse_id IN (context.source_warehouse_id, context.destination_warehouse_id)),
    'transactions', (SELECT jsonb_agg(jsonb_build_array(transaction.id, transaction.status) ORDER BY transaction.id)
      FROM public.stock_transactions transaction JOIN stock_move_test_context context
      ON transaction.warehouse_id IN (context.source_warehouse_id, context.destination_warehouse_id)),
    'lines', (SELECT jsonb_agg(jsonb_build_array(line.id, line.quantity, line.batch_no,
      line.qty_before, line.qty_after) ORDER BY line.id) FROM public.stock_transaction_items line
      JOIN public.stock_transactions transaction ON transaction.id = line.transaction_id
      JOIN stock_move_test_context context
      ON transaction.warehouse_id IN (context.source_warehouse_id, context.destination_warehouse_id))
  );
$$;

CREATE FUNCTION pg_temp.fail_stock_move_after_batch_write() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_quantity NUMERIC;
BEGIN
  IF current_setting('test.fail_stock_move', TRUE) = 'yes' THEN
    SELECT SUM(stock.qty_on_hand) INTO v_quantity FROM public.item_batch_locations stock
    JOIN stock_move_test_context context ON stock.item_id = context.item_id
      AND stock.location_id = context.source_location_id;
    IF v_quantity >= current_setting('test.source_quantity_before')::NUMERIC THEN
      RAISE EXCEPTION 'TEST_FAILURE_DID_NOT_FOLLOW_BATCH_WRITE';
    END IF;
    RAISE EXCEPTION 'TEST_FAILURE_AFTER_BATCH_WRITE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_fail_stock_move AFTER INSERT ON public.stock_transaction_items
  FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_stock_move_after_batch_write();

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_context RECORD;
  v_denied_actor UUID;
  v_result JSONB;
  v_before JSONB;
  v_transaction_id UUID;
  v_receipt_id UUID;
  v_summary RECORD;
  v_source_quantity NUMERIC;
  v_expiration_case RECORD;
BEGIN
  SELECT actor_id, company_id, business_unit_id, item_id, source_warehouse_id,
    destination_warehouse_id, foreign_warehouse_id, source_location_id, destination_location_id,
    other_location_id, foreign_location_id, old_batch_id, new_batch_id, old_batch_code
  INTO STRICT v_context FROM stock_move_test_context;
  SELECT id INTO STRICT v_denied_actor FROM stock_move_denied_actor;
  IF current_user <> 'authenticated' THEN RAISE EXCEPTION 'Tests must run with RLS applied'; END IF;
  IF has_function_privilege('anon', 'public.move_stock_transactionally(uuid,uuid,uuid,uuid,uuid,uuid,numeric,date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous role can execute stock move';
  END IF;

  PERFORM set_config('request.jwt.claims', '{}', TRUE);
  BEGIN
    PERFORM public.move_stock_transactionally(v_context.business_unit_id, v_context.item_id,
      v_context.source_warehouse_id, v_context.destination_warehouse_id,
      v_context.source_location_id, v_context.destination_location_id, 1);
    RAISE EXCEPTION 'TEST_EXPECTED_AUTHENTICATION_REJECTION';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'STOCK_MOVE_UNAUTHORIZED' THEN RAISE; END IF; END;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_denied_actor,
    'role', 'authenticated', 'current_business_unit_id', v_context.business_unit_id)::TEXT, TRUE);
  BEGIN
    PERFORM public.move_stock_transactionally(v_context.business_unit_id, v_context.item_id,
      v_context.source_warehouse_id, v_context.destination_warehouse_id,
      v_context.source_location_id, v_context.destination_location_id, 1);
    RAISE EXCEPTION 'TEST_EXPECTED_FORBIDDEN';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'STOCK_MOVE_FORBIDDEN' THEN RAISE; END IF; END;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_context.actor_id,
    'role', 'authenticated', 'current_business_unit_id', v_context.business_unit_id)::TEXT, TRUE);
  v_before := pg_temp.stock_move_snapshot();

  BEGIN
    PERFORM public.move_stock_transactionally(gen_random_uuid(), v_context.item_id,
      v_context.source_warehouse_id, v_context.destination_warehouse_id,
      v_context.source_location_id, v_context.destination_location_id, 1);
    RAISE EXCEPTION 'TEST_EXPECTED_CONTEXT_REJECTION';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'STOCK_MOVE_CONTEXT_INVALID' THEN RAISE; END IF; END;

  BEGIN
    PERFORM public.move_stock_transactionally(v_context.business_unit_id, v_context.item_id,
      v_context.source_warehouse_id, v_context.destination_warehouse_id,
      v_context.source_location_id, v_context.destination_location_id, 0.001);
    RAISE EXCEPTION 'TEST_EXPECTED_PRECISION_REJECTION';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'STOCK_MOVE_DETAILS_INVALID' THEN RAISE; END IF; END;

  BEGIN
    PERFORM public.move_stock_transactionally(v_context.business_unit_id, v_context.item_id,
      v_context.source_warehouse_id, v_context.destination_warehouse_id,
      v_context.destination_location_id, v_context.source_location_id, 1);
    RAISE EXCEPTION 'TEST_EXPECTED_WRONG_RACK_REJECTION';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'STOCK_MOVE_LOCATION_INVALID' THEN RAISE; END IF; END;

  UPDATE public.warehouse_locations SET is_storable = FALSE WHERE id = v_context.destination_location_id;
  BEGIN
    PERFORM public.move_stock_transactionally(v_context.business_unit_id, v_context.item_id,
      v_context.source_warehouse_id, v_context.destination_warehouse_id,
      v_context.source_location_id, v_context.destination_location_id, 1);
    RAISE EXCEPTION 'TEST_EXPECTED_NONSTORABLE_REJECTION';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'STOCK_MOVE_LOCATION_INVALID' THEN RAISE; END IF; END;
  UPDATE public.warehouse_locations SET is_storable = TRUE WHERE id = v_context.destination_location_id;

  BEGIN
    PERFORM public.move_stock_transactionally(v_context.business_unit_id, v_context.item_id,
      v_context.source_warehouse_id, v_context.foreign_warehouse_id,
      v_context.source_location_id, v_context.foreign_location_id, 1);
    RAISE EXCEPTION 'TEST_EXPECTED_CROSS_BU_REJECTION';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'STOCK_MOVE_WAREHOUSE_INVALID' THEN RAISE; END IF; END;

  BEGIN
    PERFORM public.move_stock_transactionally(v_context.business_unit_id, v_context.item_id,
      v_context.source_warehouse_id, v_context.destination_warehouse_id,
      v_context.source_location_id, v_context.destination_location_id, 16);
    RAISE EXCEPTION 'TEST_EXPECTED_RESERVED_PUTAWAY_REJECTION';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'STOCK_MOVE_INSUFFICIENT_STOCK' THEN RAISE; END IF; END;

  -- Aggregate stock is enough, but this rack is empty: failure after header creation rolls back.
  BEGIN
    PERFORM public.move_stock_transactionally(v_context.business_unit_id, v_context.item_id,
      v_context.source_warehouse_id, v_context.destination_warehouse_id,
      v_context.other_location_id, v_context.destination_location_id, 1);
    RAISE EXCEPTION 'TEST_EXPECTED_EMPTY_RACK_REJECTION';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'STOCK_MOVE_INSUFFICIENT_STOCK' THEN RAISE; END IF; END;
  IF v_before IS DISTINCT FROM pg_temp.stock_move_snapshot() THEN RAISE EXCEPTION 'Rejected move left partial writes'; END IF;

  -- Regression: 1 box of 144 cannot move from a rack with 58 base units,
  -- even when another rack makes the warehouse total large enough.
  BEGIN
    UPDATE public.item_warehouse SET current_stock = 205
    WHERE item_id = v_context.item_id AND warehouse_id = v_context.source_warehouse_id;
    UPDATE public.item_batches SET qty_on_hand = 200, qty_reserved = 0 WHERE id = v_context.old_batch_id;
    UPDATE public.item_batches SET qty_on_hand = 0, qty_reserved = 0 WHERE id = v_context.new_batch_id;
    UPDATE public.item_batch_locations SET qty_on_hand = 58, qty_reserved = 0
    WHERE item_batch_id = v_context.old_batch_id AND location_id = v_context.source_location_id;
    UPDATE public.item_batch_locations SET qty_on_hand = 0, qty_reserved = 0
    WHERE item_batch_id = v_context.new_batch_id AND location_id = v_context.source_location_id;
    INSERT INTO public.item_batch_locations (
      company_id, item_id, warehouse_id, location_id, item_batch_id,
      qty_on_hand, qty_reserved, created_by, updated_by
    ) VALUES (
      v_context.company_id, v_context.item_id, v_context.source_warehouse_id,
      v_context.other_location_id, v_context.old_batch_id, 142, 0,
      v_context.actor_id, v_context.actor_id
    );
    v_before := pg_temp.stock_move_snapshot();
    BEGIN
      PERFORM public.move_stock_transactionally(v_context.business_unit_id, v_context.item_id,
        v_context.source_warehouse_id, v_context.destination_warehouse_id,
        v_context.source_location_id, v_context.destination_location_id, 144);
      RAISE EXCEPTION 'TEST_EXPECTED_144_FROM_58_REJECTION';
    EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'STOCK_MOVE_INSUFFICIENT_STOCK' THEN RAISE; END IF; END;
    IF v_before IS DISTINCT FROM pg_temp.stock_move_snapshot() THEN
      RAISE EXCEPTION 'Oversized warehouse move left partial writes';
    END IF;
    BEGIN
      PERFORM public.move_stock_transactionally(v_context.business_unit_id, v_context.item_id,
        v_context.source_warehouse_id, v_context.source_warehouse_id,
        v_context.source_location_id, v_context.other_location_id, 144);
      RAISE EXCEPTION 'TEST_EXPECTED_144_FROM_58_RACK_REJECTION';
    EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'STOCK_MOVE_INSUFFICIENT_STOCK' THEN RAISE; END IF; END;
    IF v_before IS DISTINCT FROM pg_temp.stock_move_snapshot() THEN
      RAISE EXCEPTION 'Oversized rack move left partial writes';
    END IF;
    -- Restore the original fixtures for the remaining success/rollback checks.
    RAISE EXCEPTION USING ERRCODE = 'ZX058', MESSAGE = 'Restore oversized move fixtures';
  EXCEPTION WHEN SQLSTATE 'ZX058' THEN NULL;
  END;
  v_before := pg_temp.stock_move_snapshot();

  v_result := public.move_stock_transactionally(v_context.business_unit_id, v_context.item_id,
    v_context.source_warehouse_id, v_context.destination_warehouse_id,
    v_context.source_location_id, v_context.destination_location_id, 9);
  v_transaction_id := (v_result ->> 'id')::UUID;
  SELECT id INTO STRICT v_receipt_id FROM public.stock_transactions
  WHERE reference_type = 'stock_move' AND reference_id = v_transaction_id AND transaction_type = 'in';
  IF COALESCE(v_result ->> 'transactionCode', '') !~ '^ST-[0-9]{9}$'
    OR (SELECT status FROM public.stock_transactions WHERE id = v_transaction_id) IS DISTINCT FROM 'posted'
    OR (SELECT transaction_type FROM public.stock_transactions WHERE id = v_transaction_id) IS DISTINCT FROM 'out'
    OR (SELECT status FROM public.stock_transactions WHERE id = v_receipt_id) IS DISTINCT FROM 'posted'
    OR (SELECT reference_code FROM public.stock_transactions WHERE id = v_receipt_id) IS DISTINCT FROM v_result ->> 'transactionCode'
    OR (SELECT SUM(quantity) FROM public.stock_transaction_items WHERE transaction_id = v_receipt_id) IS DISTINCT FROM 9
    OR (SELECT SUM(quantity) FROM public.stock_transaction_items WHERE transaction_id = v_transaction_id) IS DISTINCT FROM 9
    OR (SELECT quantity FROM public.stock_transaction_items WHERE transaction_id = v_transaction_id AND batch_no = v_context.old_batch_code) IS DISTINCT FROM 8
    OR (SELECT current_stock FROM public.item_warehouse WHERE warehouse_id = v_context.source_warehouse_id AND item_id = v_context.item_id) IS DISTINCT FROM 11
    OR (SELECT current_stock FROM public.item_warehouse WHERE warehouse_id = v_context.destination_warehouse_id AND item_id = v_context.item_id) IS DISTINCT FROM 9
    OR (SELECT qty_on_hand FROM public.item_batches WHERE id = v_context.old_batch_id) IS DISTINCT FROM 2
    OR (SELECT qty_on_hand FROM public.item_batches WHERE id = v_context.new_batch_id) IS DISTINCT FROM 6
    OR EXISTS (SELECT 1 FROM public.item_batches destination JOIN public.item_batches source
      ON source.batch_code = destination.batch_code AND source.warehouse_id = v_context.source_warehouse_id
      WHERE destination.warehouse_id = v_context.destination_warehouse_id AND  (destination.received_at IS DISTINCT FROM source.received_at
        OR destination.expiration_date IS DISTINCT FROM source.expiration_date))
    OR EXISTS (SELECT 1 FROM public.item_batch_locations WHERE warehouse_id = v_context.destination_warehouse_id AND batch_location_sku IS NULL) THEN
    RAISE EXCEPTION 'Warehouse move failed FIFO, identity, stock, SKU, or movement audit verification';
  END IF;

  SELECT total_in, total_out, closing_balance INTO v_summary FROM public.get_stock_ledger_summary(
    v_context.company_id, v_context.business_unit_id, v_context.item_id, v_context.source_warehouse_id
  );
  IF v_summary.total_in <> 0 OR v_summary.total_out <> 9 OR v_summary.closing_balance <> 11 THEN
    RAISE EXCEPTION 'Source ledger does not reflect outbound stock move';
  END IF;
  SELECT total_in, total_out, closing_balance INTO v_summary FROM public.get_stock_ledger_summary(
    v_context.company_id, v_context.business_unit_id, v_context.item_id, v_context.destination_warehouse_id
  );
  IF v_summary.total_in <> 9 OR v_summary.total_out <> 0 OR v_summary.closing_balance <> 9 THEN
    RAISE EXCEPTION 'Destination ledger does not reflect inbound stock move';
  END IF;

  v_result := public.move_stock_transactionally(v_context.business_unit_id, v_context.item_id,
    v_context.source_warehouse_id, v_context.source_warehouse_id,
    v_context.source_location_id, v_context.other_location_id, 1);
  IF (SELECT current_stock FROM public.item_warehouse WHERE warehouse_id = v_context.source_warehouse_id AND item_id = v_context.item_id) IS DISTINCT FROM 11
    OR (SELECT transaction_type FROM public.stock_transactions WHERE id = (v_result ->> 'id')::UUID) IS DISTINCT FROM 'transfer'
    OR (SELECT qty_on_hand FROM public.item_batches WHERE id = v_context.new_batch_id) IS DISTINCT FROM 6
    OR (SELECT SUM(qty_on_hand) FROM public.item_batch_locations WHERE location_id = v_context.other_location_id) IS DISTINCT FROM 1
    OR EXISTS (SELECT 1 FROM public.stock_transaction_items WHERE transaction_id = (v_result ->> 'id')::UUID AND qty_before <> qty_after) THEN
    RAISE EXCEPTION 'Same-warehouse move changed aggregate inventory';
  END IF;

  v_before := pg_temp.stock_move_snapshot();
  SELECT SUM(qty_on_hand) INTO v_source_quantity FROM public.item_batch_locations WHERE location_id = v_context.source_location_id;
  PERFORM set_config('test.source_quantity_before', v_source_quantity::TEXT, TRUE);
  PERFORM set_config('test.fail_stock_move', 'yes', TRUE);
  BEGIN
    PERFORM public.move_stock_transactionally(v_context.business_unit_id, v_context.item_id,
      v_context.source_warehouse_id, v_context.destination_warehouse_id,
      v_context.source_location_id, v_context.destination_location_id, 1);
    RAISE EXCEPTION 'TEST_EXPECTED_LATE_FAILURE';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'TEST_FAILURE_AFTER_BATCH_WRITE' THEN RAISE; END IF; END;
  PERFORM set_config('test.fail_stock_move', 'no', TRUE);
  IF v_before IS DISTINCT FROM pg_temp.stock_move_snapshot() THEN RAISE EXCEPTION 'Late failure left partial stock or audit writes'; END IF;

  -- Expiration is part of merge identity: dates must match, including unset values.
  FOR v_expiration_case IN
    SELECT dates.source_date, dates.destination_date
    FROM (VALUES (DATE '2027-02-10', DATE '2027-03-10'),
      (DATE '2027-02-10', NULL::DATE), (NULL::DATE, DATE '2027-02-10')) dates(source_date,destination_date)
  LOOP
    BEGIN
      UPDATE public.item_batches SET expiration_date=v_expiration_case.source_date
      WHERE id=v_context.new_batch_id;
      UPDATE public.item_batches SET expiration_date=v_expiration_case.destination_date
      WHERE warehouse_id=v_context.destination_warehouse_id AND batch_code='MOVE-NEW';
      v_before := pg_temp.stock_move_snapshot();
      BEGIN
        PERFORM public.move_stock_transactionally(v_context.business_unit_id,v_context.item_id,
          v_context.source_warehouse_id,v_context.destination_warehouse_id,
          v_context.source_location_id,v_context.destination_location_id,1);
        RAISE EXCEPTION 'TEST_EXPECTED_EXPIRATION_CONFLICT';
      EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'STOCK_MOVE_BATCH_CONFLICT' THEN RAISE; END IF; END;
      IF v_before IS DISTINCT FROM pg_temp.stock_move_snapshot() THEN
        RAISE EXCEPTION 'Expiration conflict left partial stock, date, or audit writes'; END IF;
      RAISE EXCEPTION USING ERRCODE='ZX059', MESSAGE='Restore expiration fixtures';
    EXCEPTION WHEN SQLSTATE 'ZX059' THEN NULL;
    END;
  END LOOP;
  -- Matching non-null and null expirations both allow merges without changing dates.
  FOR v_expiration_case IN SELECT dates.expiration FROM (VALUES (DATE '2027-02-10'),(NULL::DATE)) dates(expiration)
  LOOP
    BEGIN
      UPDATE public.item_batches SET expiration_date=v_expiration_case.expiration
      WHERE id=v_context.new_batch_id OR (warehouse_id=v_context.destination_warehouse_id AND batch_code='MOVE-NEW');
      PERFORM public.move_stock_transactionally(v_context.business_unit_id,v_context.item_id,
        v_context.source_warehouse_id,v_context.destination_warehouse_id,
        v_context.source_location_id,v_context.destination_location_id,1);
      IF EXISTS(SELECT 1 FROM public.item_batches WHERE batch_code='MOVE-NEW'
        AND warehouse_id IN(v_context.source_warehouse_id,v_context.destination_warehouse_id)
        AND expiration_date IS DISTINCT FROM v_expiration_case.expiration) THEN
        RAISE EXCEPTION 'Matching merge changed expiration'; END IF;
      RAISE EXCEPTION USING ERRCODE='ZX059', MESSAGE='Restore expiration fixtures';
    EXCEPTION WHEN SQLSTATE 'ZX059' THEN NULL;
    END;
  END LOOP;

  UPDATE public.item_batches SET received_at = received_at + INTERVAL '1 hour'
  WHERE warehouse_id = v_context.destination_warehouse_id AND batch_code = 'MOVE-NEW';
  v_before := pg_temp.stock_move_snapshot();
  BEGIN
    PERFORM public.move_stock_transactionally(v_context.business_unit_id, v_context.item_id,
      v_context.source_warehouse_id, v_context.destination_warehouse_id,
      v_context.source_location_id, v_context.destination_location_id, 1);
    RAISE EXCEPTION 'TEST_EXPECTED_BATCH_CONFLICT';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'STOCK_MOVE_BATCH_CONFLICT' THEN RAISE; END IF; END;
  IF v_before IS DISTINCT FROM pg_temp.stock_move_snapshot() THEN RAISE EXCEPTION 'Batch conflict left partial writes'; END IF;
  UPDATE public.item_batches SET received_at = received_at - INTERVAL '1 hour'
  WHERE warehouse_id = v_context.destination_warehouse_id AND batch_code = 'MOVE-NEW';

  -- Return stock into an existing batch while keeping the reservation at its original source.
  PERFORM public.move_stock_transactionally(v_context.business_unit_id, v_context.item_id,
    v_context.destination_warehouse_id, v_context.source_warehouse_id,
    v_context.destination_location_id, v_context.source_location_id, 3);
  IF (SELECT SUM(current_stock) FROM public.item_warehouse WHERE item_id = v_context.item_id
        AND warehouse_id IN (v_context.source_warehouse_id, v_context.destination_warehouse_id)) IS DISTINCT FROM 20
    OR (SELECT reserved_stock FROM public.item_warehouse WHERE item_id = v_context.item_id AND warehouse_id = v_context.source_warehouse_id) IS DISTINCT FROM 2
    OR (SELECT putaway_qty FROM public.item_warehouse WHERE item_id = v_context.item_id AND warehouse_id = v_context.source_warehouse_id) IS DISTINCT FROM 3
    OR (SELECT qty_reserved FROM public.item_batches WHERE id = v_context.old_batch_id) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Move changed total stock, reservations, or staged quantity';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.item_warehouse stock JOIN stock_move_test_context context
      ON stock.item_id = context.item_id
      AND stock.warehouse_id IN (context.source_warehouse_id, context.destination_warehouse_id)
    WHERE stock.current_stock IS DISTINCT FROM stock.putaway_qty + (
      SELECT COALESCE(SUM(batch.qty_on_hand), 0) FROM public.item_batches batch
      WHERE batch.item_id = stock.item_id AND batch.warehouse_id = stock.warehouse_id AND batch.deleted_at IS NULL
    ) OR stock.current_stock IS DISTINCT FROM stock.putaway_qty + (
      SELECT COALESCE(SUM(location.qty_on_hand), 0) FROM public.item_batch_locations location
      WHERE location.item_id = stock.item_id AND location.warehouse_id = stock.warehouse_id AND location.deleted_at IS NULL
    )
  ) THEN RAISE EXCEPTION 'Warehouse, batch, and rack totals do not reconcile'; END IF;
  RAISE NOTICE 'Authenticated stock moves passed: FIFO, both warehouse ledgers, same warehouse, existing batch merge, cross-BU/permission rejection, reservation protection, and rollback after writes';
END $$;
RESET ROLE;
ROLLBACK;
