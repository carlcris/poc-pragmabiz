BEGIN;

-- Match the batch identity length used by item_batches.
ALTER TABLE public.stock_transaction_items ALTER COLUMN batch_no TYPE VARCHAR(150);

-- Immediate rack/warehouse moves within one business unit. Existing reservation
-- owners stay at their sources; only available, already-placed stock can move.
CREATE OR REPLACE FUNCTION public.move_stock_transactionally(
  p_business_unit_id UUID,
  p_item_id UUID,
  p_source_warehouse_id UUID,
  p_destination_warehouse_id UUID,
  p_from_location_id UUID,
  p_to_location_id UUID,
  p_quantity NUMERIC,
  p_transaction_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  v_uom_id UUID;
  v_unit_cost NUMERIC;
  v_source_stock RECORD;
  v_destination_stock_id UUID;
  v_destination_balance NUMERIC;
  v_destination_batch_id UUID;
  v_destination_batch_location_id UUID;
  v_source RECORD;
  v_remaining NUMERIC := p_quantity;
  v_take NUMERIC;
  v_balance NUMERIC;
  v_next_balance NUMERIC;
  v_transaction_id UUID := gen_random_uuid();
  v_destination_transaction_id UUID;
  v_transaction_code TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'STOCK_MOVE_UNAUTHORIZED';
  END IF;

  SELECT actor.company_id INTO v_company_id
  FROM public.users actor
  WHERE actor.id = v_user_id AND actor.is_active IS TRUE AND actor.deleted_at IS NULL;

  IF v_company_id IS NULL OR p_business_unit_id IS NULL
     OR p_business_unit_id IS DISTINCT FROM public.get_current_business_unit_id() THEN
    RAISE EXCEPTION 'STOCK_MOVE_CONTEXT_INVALID';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_business_unit_access access_row
    JOIN public.business_units business_unit ON business_unit.id = access_row.business_unit_id
    WHERE access_row.user_id = v_user_id
      AND access_row.business_unit_id = p_business_unit_id
      AND business_unit.company_id = v_company_id
      AND business_unit.is_active IS TRUE
  ) OR NOT public.user_has_permission(v_user_id, 'stock_transactions', 'create', p_business_unit_id)
    OR NOT public.user_has_permission(v_user_id, 'transfer_between_locations', 'create', p_business_unit_id) THEN
    RAISE EXCEPTION 'STOCK_MOVE_FORBIDDEN';
  END IF;

  IF p_item_id IS NULL OR p_source_warehouse_id IS NULL OR p_destination_warehouse_id IS NULL
     OR p_from_location_id IS NULL OR p_to_location_id IS NULL
     OR p_from_location_id = p_to_location_id OR p_transaction_date IS NULL
     OR p_quantity IS NULL OR p_quantity::TEXT IN ('NaN', 'Infinity', '-Infinity')
     OR p_quantity <= 0 OR p_quantity > 1000000000 OR p_quantity <> ROUND(p_quantity, 2) THEN
    RAISE EXCEPTION 'STOCK_MOVE_DETAILS_INVALID';
  END IF;

  PERFORM warehouse.id FROM public.warehouses warehouse
  WHERE warehouse.id = p_source_warehouse_id AND warehouse.company_id = v_company_id
    AND warehouse.business_unit_id = p_business_unit_id
    AND warehouse.is_active IS TRUE AND warehouse.deleted_at IS NULL
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_MOVE_WAREHOUSE_INVALID'; END IF;

  PERFORM warehouse.id FROM public.warehouses warehouse
  WHERE warehouse.id = p_destination_warehouse_id AND warehouse.company_id = v_company_id
    AND warehouse.business_unit_id = p_business_unit_id
    AND warehouse.is_active IS TRUE AND warehouse.deleted_at IS NULL
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_MOVE_WAREHOUSE_INVALID'; END IF;

  PERFORM location.id FROM public.warehouse_locations location
  WHERE location.id = p_from_location_id AND location.company_id = v_company_id
    AND location.warehouse_id = p_source_warehouse_id
    AND location.is_active IS TRUE AND location.is_storable IS TRUE AND location.deleted_at IS NULL
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_MOVE_LOCATION_INVALID'; END IF;

  PERFORM location.id FROM public.warehouse_locations location
  WHERE location.id = p_to_location_id AND location.company_id = v_company_id
    AND location.warehouse_id = p_destination_warehouse_id
    AND location.is_active IS TRUE AND location.is_storable IS TRUE AND location.deleted_at IS NULL
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_MOVE_LOCATION_INVALID'; END IF;

  SELECT item.uom_id, COALESCE(item.purchase_price, 0) INTO v_uom_id, v_unit_cost
  FROM public.items item
  WHERE item.id = p_item_id AND item.company_id = v_company_id
    AND item.is_stock_item IS TRUE AND item.is_active IS TRUE AND item.deleted_at IS NULL
  FOR SHARE;
  IF NOT FOUND OR v_uom_id IS NULL THEN RAISE EXCEPTION 'STOCK_MOVE_ITEM_UNAVAILABLE'; END IF;

  -- Lock the stock rows in warehouse order so opposite-direction moves serialize.
  PERFORM stock.id FROM public.item_warehouse stock
  WHERE stock.company_id = v_company_id AND stock.item_id = p_item_id
    AND stock.warehouse_id IN (p_source_warehouse_id, p_destination_warehouse_id)
  ORDER BY stock.warehouse_id
  FOR UPDATE;

  SELECT stock.id, stock.current_stock, stock.available_stock INTO v_source_stock
  FROM public.item_warehouse stock
  WHERE stock.company_id = v_company_id AND stock.item_id = p_item_id
    AND stock.warehouse_id = p_source_warehouse_id
    AND stock.is_active IS TRUE AND stock.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND OR COALESCE(v_source_stock.available_stock, 0) < p_quantity THEN
    RAISE EXCEPTION 'STOCK_MOVE_INSUFFICIENT_STOCK';
  END IF;
  v_balance := v_source_stock.current_stock;

  IF p_source_warehouse_id <> p_destination_warehouse_id THEN
    INSERT INTO public.item_warehouse (
      company_id, item_id, warehouse_id, current_stock, reserved_stock, putaway_qty,
      default_location_id, created_by, updated_by
    ) VALUES (
      v_company_id, p_item_id, p_destination_warehouse_id, 0, 0, 0,
      p_to_location_id, v_user_id, v_user_id
    ) ON CONFLICT (company_id, item_id, warehouse_id) DO NOTHING;

    SELECT stock.id, COALESCE(stock.current_stock, 0) INTO v_destination_stock_id, v_destination_balance
    FROM public.item_warehouse stock
    WHERE stock.company_id = v_company_id AND stock.item_id = p_item_id
      AND stock.warehouse_id = p_destination_warehouse_id
      AND stock.is_active IS TRUE AND stock.deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_MOVE_DESTINATION_UNAVAILABLE'; END IF;
  END IF;

  INSERT INTO public.stock_transactions (
    id, company_id, business_unit_id, transaction_type, transaction_date,
    warehouse_id, to_warehouse_id, from_location_id, to_location_id,
    reference_type, reference_id,
    status, created_by, updated_by
  ) VALUES (
    v_transaction_id, v_company_id, p_business_unit_id,
    CASE WHEN p_source_warehouse_id = p_destination_warehouse_id THEN 'transfer' ELSE 'out' END,
    p_transaction_date,
    p_source_warehouse_id, p_destination_warehouse_id, p_from_location_id, p_to_location_id,
    'stock_move', v_transaction_id,
    'draft', v_user_id, v_user_id
  ) RETURNING id, transaction_code INTO v_transaction_id, v_transaction_code;

  -- Warehouse reports consume one warehouse per stock transaction. A paired
  -- receipt gives the destination its own audit and ledger balance, linked to
  -- the same move. Rack moves need only the unchanged-warehouse transfer entry.
  IF p_source_warehouse_id <> p_destination_warehouse_id THEN
    INSERT INTO public.stock_transactions (
      company_id, business_unit_id, transaction_type, transaction_date,
      warehouse_id, to_location_id, reference_type, reference_id, reference_code,
      status, created_by, updated_by
    ) VALUES (
      v_company_id, p_business_unit_id, 'in', p_transaction_date,
      p_destination_warehouse_id, p_to_location_id, 'stock_move', v_transaction_id, v_transaction_code,
      'draft', v_user_id, v_user_id
    ) RETURNING id INTO v_destination_transaction_id;
  END IF;

  FOR v_source IN
    SELECT stock.id AS location_stock_id, stock.item_batch_id,
      stock.qty_available, batch.qty_available AS batch_available,
      batch.batch_code, batch.received_at
    FROM public.item_batch_locations stock
    JOIN public.item_batches batch ON batch.id = stock.item_batch_id
      AND batch.company_id = stock.company_id AND batch.item_id = stock.item_id
      AND batch.warehouse_id = stock.warehouse_id AND batch.deleted_at IS NULL
    WHERE stock.company_id = v_company_id AND stock.item_id = p_item_id
      AND stock.warehouse_id = p_source_warehouse_id AND stock.location_id = p_from_location_id
      AND stock.deleted_at IS NULL AND stock.qty_available > 0
    ORDER BY batch.received_at, batch.id, stock.id
    FOR UPDATE OF stock, batch
  LOOP
    v_take := LEAST(v_remaining, v_source.qty_available);
    IF v_source.batch_available < v_take THEN RAISE EXCEPTION 'STOCK_MOVE_INSUFFICIENT_STOCK'; END IF;

    UPDATE public.item_batch_locations SET qty_on_hand = qty_on_hand - v_take, updated_by = v_user_id
    WHERE id = v_source.location_stock_id;

    IF p_source_warehouse_id = p_destination_warehouse_id THEN
      v_destination_batch_id := v_source.item_batch_id;
      v_next_balance := v_balance;
    ELSE
      UPDATE public.item_batches SET qty_on_hand = qty_on_hand - v_take, updated_by = v_user_id
      WHERE id = v_source.item_batch_id;

      INSERT INTO public.item_batches AS destination (
        company_id, item_id, warehouse_id, batch_code, received_at,
        qty_on_hand, qty_reserved, created_by, updated_by
      ) VALUES (
        v_company_id, p_item_id, p_destination_warehouse_id, v_source.batch_code, v_source.received_at,
        v_take, 0, v_user_id, v_user_id
      ) ON CONFLICT (company_id, item_id, warehouse_id, batch_code) DO UPDATE
      SET qty_on_hand = destination.qty_on_hand + EXCLUDED.qty_on_hand, updated_by = v_user_id
      WHERE destination.deleted_at IS NULL AND destination.received_at = EXCLUDED.received_at
      RETURNING id INTO v_destination_batch_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_MOVE_BATCH_CONFLICT'; END IF;
      v_next_balance := v_balance - v_take;
    END IF;

    INSERT INTO public.item_batch_locations AS destination (
      company_id, item_id, warehouse_id, location_id, item_batch_id,
      qty_on_hand, qty_reserved, created_by, updated_by
    ) VALUES (
      v_company_id, p_item_id, p_destination_warehouse_id, p_to_location_id, v_destination_batch_id,
      v_take, 0, v_user_id, v_user_id
    ) ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE
    SET qty_on_hand = destination.qty_on_hand + EXCLUDED.qty_on_hand, updated_by = v_user_id
    WHERE destination.deleted_at IS NULL
    RETURNING id INTO v_destination_batch_location_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_MOVE_DESTINATION_UNAVAILABLE'; END IF;

    -- Each consumed batch remains identifiable in the movement history.
    INSERT INTO public.stock_transaction_items (
      company_id, transaction_id, item_id, quantity, uom_id, unit_cost, total_cost, batch_no,
      qty_before, qty_after, valuation_rate, stock_value_before, stock_value_after,
      posting_date, posting_time, created_by, updated_by
    ) VALUES (
      v_company_id, v_transaction_id, p_item_id, v_take, v_uom_id, v_unit_cost, v_take * v_unit_cost,
      v_source.batch_code, v_balance, v_next_balance, v_unit_cost,
      v_balance * v_unit_cost, v_next_balance * v_unit_cost,
      p_transaction_date, clock_timestamp()::TIME, v_user_id, v_user_id
    );
    IF v_destination_transaction_id IS NOT NULL THEN
      INSERT INTO public.stock_transaction_items (
        company_id, transaction_id, item_id, quantity, uom_id, unit_cost, total_cost, batch_no,
        qty_before, qty_after, valuation_rate, stock_value_before, stock_value_after,
        posting_date, posting_time, created_by, updated_by
      ) VALUES (
        v_company_id, v_destination_transaction_id, p_item_id, v_take, v_uom_id, v_unit_cost, v_take * v_unit_cost,
        v_source.batch_code, v_destination_balance, v_destination_balance + v_take, v_unit_cost,
        v_destination_balance * v_unit_cost, (v_destination_balance + v_take) * v_unit_cost,
        p_transaction_date, clock_timestamp()::TIME, v_user_id, v_user_id
      );
      v_destination_balance := v_destination_balance + v_take;
    END IF;
    v_balance := v_next_balance;
    v_remaining := v_remaining - v_take;
    EXIT WHEN v_remaining = 0;
  END LOOP;

  IF v_remaining > 0 THEN RAISE EXCEPTION 'STOCK_MOVE_INSUFFICIENT_STOCK'; END IF;

  IF p_source_warehouse_id <> p_destination_warehouse_id THEN
    UPDATE public.item_warehouse SET
      current_stock = current_stock + CASE WHEN id = v_source_stock.id THEN -p_quantity ELSE p_quantity END,
      updated_by = v_user_id
    WHERE id IN (v_source_stock.id, v_destination_stock_id);
  END IF;

  UPDATE public.stock_transactions SET status = 'posted', updated_by = v_user_id
  WHERE id IN (v_transaction_id, v_destination_transaction_id);
  RETURN jsonb_build_object('id', v_transaction_id, 'transactionCode', v_transaction_code,
    'message', 'Stock transaction created successfully');
END;
$$;

REVOKE ALL ON FUNCTION public.move_stock_transactionally(UUID, UUID, UUID, UUID, UUID, UUID, NUMERIC, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_stock_transactionally(UUID, UUID, UUID, UUID, UUID, UUID, NUMERIC, DATE) TO authenticated;

COMMIT;
