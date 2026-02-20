-- ============================================================================
-- Migration: Delivery Note Multi-Route Support
-- Version: 20260216140000
-- Description: Enables delivery notes to carry line-level source/destination
--              so one DN can include lines from multiple stock-request routes.
-- Date: 2026-02-16
-- ============================================================================

ALTER TABLE delivery_note_items
  ADD COLUMN IF NOT EXISTS source_entity_id UUID REFERENCES warehouses(id),
  ADD COLUMN IF NOT EXISTS destination_entity_id UUID REFERENCES warehouses(id);

UPDATE delivery_note_items dni
SET
  source_entity_id = sr.source_warehouse_id,
  destination_entity_id = sr.destination_warehouse_id
FROM stock_requests sr
WHERE sr.id = dni.sr_id
  AND (dni.source_entity_id IS NULL OR dni.destination_entity_id IS NULL);

UPDATE delivery_note_items dni
SET
  source_entity_id = COALESCE(dni.source_entity_id, dn.source_entity_id),
  destination_entity_id = COALESCE(dni.destination_entity_id, dn.destination_entity_id)
FROM delivery_notes dn
WHERE dn.id = dni.dn_id
  AND (dni.source_entity_id IS NULL OR dni.destination_entity_id IS NULL);

ALTER TABLE delivery_note_items
  ALTER COLUMN source_entity_id SET NOT NULL,
  ALTER COLUMN destination_entity_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_note_items_source_destination_check'
  ) THEN
    ALTER TABLE delivery_note_items
      ADD CONSTRAINT delivery_note_items_source_destination_check
      CHECK (source_entity_id <> destination_entity_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_dni_company_route
  ON delivery_note_items(company_id, source_entity_id, destination_entity_id);

COMMENT ON COLUMN delivery_note_items.source_entity_id IS
  'Line-level source warehouse. Supports mixed-route delivery notes.';
COMMENT ON COLUMN delivery_note_items.destination_entity_id IS
  'Line-level destination warehouse. Supports mixed-route delivery notes.';

CREATE OR REPLACE FUNCTION public.post_delivery_note_dispatch(
  p_company_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_business_unit_id UUID,
  p_dispatch_date DATE,
  p_notes TEXT,
  p_driver_name TEXT,
  p_driver_signature TEXT,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_dn delivery_notes%ROWTYPE;
  v_dn_item delivery_note_items%ROWTYPE;
  v_warehouse_stock item_warehouse%ROWTYPE;
  v_tx_id UUID;
  v_tx_code TEXT;
  v_now TIMESTAMP;
  v_posting_date DATE;
  v_posting_time TIME;
  v_line JSONB;
  v_item_id UUID;
  v_dispatch_qty NUMERIC;
  v_remaining_pick_qty NUMERIC;
  v_remaining_fifo_qty NUMERIC;
  v_available_qty NUMERIC;
  v_take_qty NUMERIC;
  v_current_stock NUMERIC;
  v_next_stock NUMERIC;
  v_has_dispatch_line BOOLEAN := FALSE;
  v_location_total NUMERIC;
  v_missing_location_qty NUMERIC;
  v_line_location RECORD;
  v_line_source_entity_id UUID;
  v_line_default_location_id UUID;
BEGIN
  IF COALESCE(BTRIM(p_driver_signature), '') = '' THEN
    RAISE EXCEPTION 'Driver signature is required for dispatch';
  END IF;

  SELECT *
  INTO v_dn
  FROM delivery_notes
  WHERE id = p_dn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note not found';
  END IF;

  IF v_dn.status <> 'dispatch_ready' THEN
    RAISE EXCEPTION 'Only dispatch_ready delivery notes can be dispatched';
  END IF;

  IF p_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required';
  END IF;

  v_now := NOW();
  v_posting_date := COALESCE(p_dispatch_date, v_now::DATE);
  v_posting_time := v_now::TIME;

  FOR v_line IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_item_id := NULLIF(v_line->>'deliveryNoteItemId', '')::UUID;
    IF v_item_id IS NULL THEN
      CONTINUE;
    END IF;

    v_dispatch_qty := COALESCE((v_line->>'dispatchQty')::NUMERIC, 0);

    SELECT *
    INTO v_dn_item
    FROM delivery_note_items
    WHERE id = v_item_id
      AND company_id = p_company_id
      AND dn_id = p_dn_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid delivery note item %', v_item_id;
    END IF;

    v_remaining_pick_qty := GREATEST(0, COALESCE(v_dn_item.picked_qty, 0) - COALESCE(v_dn_item.dispatched_qty, 0));
    IF v_dispatch_qty < 0 OR v_dispatch_qty > v_remaining_pick_qty THEN
      RAISE EXCEPTION 'Invalid dispatch quantity for delivery note item %', v_item_id;
    END IF;

    IF v_dispatch_qty = 0 THEN
      CONTINUE;
    END IF;

    v_line_source_entity_id := COALESCE(v_dn_item.source_entity_id, v_dn.source_entity_id);
    IF v_line_source_entity_id IS NULL THEN
      RAISE EXCEPTION 'Missing source warehouse for delivery note item %', v_item_id;
    END IF;

    INSERT INTO warehouse_locations (
      company_id,
      warehouse_id,
      code,
      name,
      location_type,
      is_pickable,
      is_storable,
      is_active,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_line_source_entity_id,
      'MAIN',
      'Main',
      'bin',
      TRUE,
      TRUE,
      TRUE,
      p_user_id,
      p_user_id
    )
    ON CONFLICT (company_id, warehouse_id, code) DO UPDATE
    SET updated_by = EXCLUDED.updated_by
    RETURNING id INTO v_line_default_location_id;

    v_tx_code := 'ST-' || TO_CHAR(v_now, 'YYYYMMDDHH24MISSMS') || SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 4);

    INSERT INTO stock_transactions (
      company_id,
      business_unit_id,
      transaction_code,
      transaction_type,
      transaction_date,
      warehouse_id,
      from_location_id,
      reference_type,
      reference_id,
      reference_code,
      status,
      notes,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      p_business_unit_id,
      v_tx_code,
      'out',
      v_posting_date,
      v_line_source_entity_id,
      v_line_default_location_id,
      'delivery_note',
      v_dn.id,
      v_dn.dn_no,
      'posted',
      COALESCE(NULLIF(BTRIM(p_notes), ''), 'Delivery note ' || v_dn.dn_no || ' dispatched'),
      p_user_id,
      p_user_id
    )
    RETURNING id INTO v_tx_id;

    v_has_dispatch_line := TRUE;

    SELECT *
    INTO v_warehouse_stock
    FROM item_warehouse
    WHERE company_id = p_company_id
      AND item_id = v_dn_item.item_id
      AND warehouse_id = v_line_source_entity_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock for item %', v_dn_item.item_id;
    END IF;

    v_current_stock := COALESCE(v_warehouse_stock.current_stock, 0);
    IF v_current_stock < v_dispatch_qty THEN
      RAISE EXCEPTION 'Insufficient stock for item %', v_dn_item.item_id;
    END IF;

    IF v_warehouse_stock.default_location_id IS NULL THEN
      UPDATE item_warehouse
      SET
        default_location_id = v_line_default_location_id,
        updated_by = p_user_id,
        updated_at = v_now
      WHERE id = v_warehouse_stock.id;

      v_warehouse_stock.default_location_id := v_line_default_location_id;
    END IF;

    SELECT COALESCE(SUM(COALESCE(qty_on_hand, 0)), 0)
    INTO v_location_total
    FROM item_location
    WHERE company_id = p_company_id
      AND item_id = v_dn_item.item_id
      AND warehouse_id = v_line_source_entity_id
      AND deleted_at IS NULL;

    IF v_location_total < v_current_stock THEN
      v_missing_location_qty := v_current_stock - v_location_total;
      INSERT INTO item_location (
        company_id,
        item_id,
        warehouse_id,
        location_id,
        qty_on_hand,
        qty_reserved,
        created_by,
        updated_by
      )
      VALUES (
        p_company_id,
        v_dn_item.item_id,
        v_line_source_entity_id,
        COALESCE(v_warehouse_stock.default_location_id, v_line_default_location_id),
        v_missing_location_qty,
        0,
        p_user_id,
        p_user_id
      )
      ON CONFLICT (company_id, item_id, warehouse_id, location_id) DO UPDATE
      SET
        qty_on_hand = item_location.qty_on_hand + EXCLUDED.qty_on_hand,
        updated_by = EXCLUDED.updated_by,
        updated_at = v_now;
    END IF;

    v_remaining_fifo_qty := v_dispatch_qty;
    FOR v_line_location IN
      SELECT id, qty_on_hand, qty_reserved
      FROM item_location
      WHERE company_id = p_company_id
        AND item_id = v_dn_item.item_id
        AND warehouse_id = v_line_source_entity_id
        AND deleted_at IS NULL
      ORDER BY created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining_fifo_qty <= 0;

      v_available_qty := GREATEST(0, COALESCE(v_line_location.qty_on_hand, 0) - COALESCE(v_line_location.qty_reserved, 0));
      IF v_available_qty <= 0 THEN
        CONTINUE;
      END IF;

      v_take_qty := LEAST(v_available_qty, v_remaining_fifo_qty);
      UPDATE item_location
      SET
        qty_on_hand = qty_on_hand - v_take_qty,
        updated_by = p_user_id,
        updated_at = v_now
      WHERE id = v_line_location.id;

      v_remaining_fifo_qty := v_remaining_fifo_qty - v_take_qty;
    END LOOP;

    IF v_remaining_fifo_qty > 0 THEN
      RAISE EXCEPTION 'Insufficient stock across locations for FIFO consumption';
    END IF;

    v_next_stock := v_current_stock - v_dispatch_qty;

    UPDATE item_warehouse
    SET
      current_stock = v_next_stock,
      updated_by = p_user_id,
      updated_at = v_now
    WHERE id = v_warehouse_stock.id;

    INSERT INTO stock_transaction_items (
      company_id,
      transaction_id,
      item_id,
      quantity,
      uom_id,
      unit_cost,
      total_cost,
      qty_before,
      qty_after,
      valuation_rate,
      stock_value_before,
      stock_value_after,
      posting_date,
      posting_time,
      notes,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_tx_id,
      v_dn_item.item_id,
      v_dispatch_qty,
      v_dn_item.uom_id,
      0,
      0,
      v_current_stock,
      v_next_stock,
      0,
      0,
      0,
      v_posting_date,
      v_posting_time,
      COALESCE(NULLIF(BTRIM(p_notes), ''), 'Delivery note ' || v_dn.dn_no || ' dispatched'),
      p_user_id,
      p_user_id
    );

    UPDATE delivery_note_items
    SET
      dispatched_qty = COALESCE(dispatched_qty, 0) + v_dispatch_qty,
      updated_at = v_now
    WHERE id = v_dn_item.id;

    UPDATE stock_request_items
    SET
      dispatch_qty = COALESCE(dispatch_qty, 0) + v_dispatch_qty,
      updated_at = v_now
    WHERE id = v_dn_item.sr_item_id;
  END LOOP;

  IF NOT v_has_dispatch_line THEN
    RAISE EXCEPTION 'No picked quantities available for dispatch';
  END IF;

  UPDATE delivery_notes
  SET
    status = 'dispatched',
    dispatched_at = v_now,
    driver_name = COALESCE(NULLIF(BTRIM(p_driver_name), ''), driver_name),
    driver_signature = BTRIM(p_driver_signature),
    notes = COALESCE(NULLIF(BTRIM(p_notes), ''), notes),
    updated_by = p_user_id,
    updated_at = v_now
  WHERE id = p_dn_id
    AND company_id = p_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_delivery_note_receive(
  p_company_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_business_unit_id UUID,
  p_received_date DATE,
  p_notes TEXT,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_dn delivery_notes%ROWTYPE;
  v_dn_item delivery_note_items%ROWTYPE;
  v_warehouse_stock item_warehouse%ROWTYPE;
  v_tx_id UUID;
  v_tx_code TEXT;
  v_now TIMESTAMP;
  v_posting_date DATE;
  v_posting_time TIME;
  v_line JSONB;
  v_item_id UUID;
  v_received_qty NUMERIC;
  v_max_receivable_qty NUMERIC;
  v_current_stock NUMERIC;
  v_next_stock NUMERIC;
  v_has_receive_line BOOLEAN := FALSE;
  v_target_location_id UUID;
  v_line_destination_entity_id UUID;
  v_line_default_location_id UUID;
BEGIN
  SELECT *
  INTO v_dn
  FROM delivery_notes
  WHERE id = p_dn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note not found';
  END IF;

  IF v_dn.status <> 'dispatched' THEN
    RAISE EXCEPTION 'Only dispatched delivery notes can be received';
  END IF;

  IF p_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required';
  END IF;

  v_now := NOW();
  v_posting_date := COALESCE(p_received_date, v_now::DATE);
  v_posting_time := v_now::TIME;

  FOR v_line IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_item_id := NULLIF(v_line->>'deliveryNoteItemId', '')::UUID;
    IF v_item_id IS NULL THEN
      CONTINUE;
    END IF;

    v_received_qty := COALESCE((v_line->>'receivedQty')::NUMERIC, 0);

    SELECT *
    INTO v_dn_item
    FROM delivery_note_items
    WHERE id = v_item_id
      AND company_id = p_company_id
      AND dn_id = p_dn_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid delivery note item %', v_item_id;
    END IF;

    v_max_receivable_qty := COALESCE(v_dn_item.dispatched_qty, 0);
    IF v_received_qty < 0 OR v_received_qty > v_max_receivable_qty THEN
      RAISE EXCEPTION 'Received quantity must be between 0 and %', v_max_receivable_qty;
    END IF;

    IF v_received_qty = 0 THEN
      CONTINUE;
    END IF;

    v_line_destination_entity_id := COALESCE(v_dn_item.destination_entity_id, v_dn.destination_entity_id);
    IF v_line_destination_entity_id IS NULL THEN
      RAISE EXCEPTION 'Missing destination warehouse for delivery note item %', v_item_id;
    END IF;

    INSERT INTO warehouse_locations (
      company_id,
      warehouse_id,
      code,
      name,
      location_type,
      is_pickable,
      is_storable,
      is_active,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_line_destination_entity_id,
      'MAIN',
      'Main',
      'bin',
      TRUE,
      TRUE,
      TRUE,
      p_user_id,
      p_user_id
    )
    ON CONFLICT (company_id, warehouse_id, code) DO UPDATE
    SET updated_by = EXCLUDED.updated_by
    RETURNING id INTO v_line_default_location_id;

    v_target_location_id := COALESCE(NULLIF(v_line->>'locationId', '')::UUID, v_line_default_location_id);

    v_tx_code := 'ST-' || TO_CHAR(v_now, 'YYYYMMDDHH24MISSMS') || SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 4);

    INSERT INTO stock_transactions (
      company_id,
      business_unit_id,
      transaction_code,
      transaction_type,
      transaction_date,
      warehouse_id,
      to_location_id,
      reference_type,
      reference_id,
      reference_code,
      status,
      notes,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      p_business_unit_id,
      v_tx_code,
      'in',
      v_posting_date,
      v_line_destination_entity_id,
      v_target_location_id,
      'delivery_note',
      v_dn.id,
      v_dn.dn_no,
      'posted',
      COALESCE(NULLIF(BTRIM(p_notes), ''), 'Delivery note ' || v_dn.dn_no || ' received'),
      p_user_id,
      p_user_id
    )
    RETURNING id INTO v_tx_id;

    v_has_receive_line := TRUE;

    SELECT *
    INTO v_warehouse_stock
    FROM item_warehouse
    WHERE company_id = p_company_id
      AND item_id = v_dn_item.item_id
      AND warehouse_id = v_line_destination_entity_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND THEN
      v_current_stock := COALESCE(v_warehouse_stock.current_stock, 0);
      v_next_stock := v_current_stock + v_received_qty;

      IF v_warehouse_stock.default_location_id IS NULL THEN
        UPDATE item_warehouse
        SET
          default_location_id = v_line_default_location_id,
          current_stock = v_next_stock,
          updated_by = p_user_id,
          updated_at = v_now
        WHERE id = v_warehouse_stock.id;
      ELSE
        UPDATE item_warehouse
        SET
          current_stock = v_next_stock,
          updated_by = p_user_id,
          updated_at = v_now
        WHERE id = v_warehouse_stock.id;
      END IF;
    ELSE
      v_current_stock := 0;
      v_next_stock := v_received_qty;

      INSERT INTO item_warehouse (
        company_id,
        item_id,
        warehouse_id,
        current_stock,
        default_location_id,
        created_by,
        updated_by
      )
      VALUES (
        p_company_id,
        v_dn_item.item_id,
        v_line_destination_entity_id,
        v_next_stock,
        v_line_default_location_id,
        p_user_id,
        p_user_id
      );
    END IF;

    INSERT INTO item_location (
      company_id,
      item_id,
      warehouse_id,
      location_id,
      qty_on_hand,
      qty_reserved,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_dn_item.item_id,
      v_line_destination_entity_id,
      v_target_location_id,
      v_received_qty,
      0,
      p_user_id,
      p_user_id
    )
    ON CONFLICT (company_id, item_id, warehouse_id, location_id) DO UPDATE
    SET
      qty_on_hand = item_location.qty_on_hand + EXCLUDED.qty_on_hand,
      updated_by = EXCLUDED.updated_by,
      updated_at = v_now;

    INSERT INTO stock_transaction_items (
      company_id,
      transaction_id,
      item_id,
      quantity,
      uom_id,
      unit_cost,
      total_cost,
      qty_before,
      qty_after,
      valuation_rate,
      stock_value_before,
      stock_value_after,
      posting_date,
      posting_time,
      notes,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_tx_id,
      v_dn_item.item_id,
      v_received_qty,
      v_dn_item.uom_id,
      0,
      0,
      v_current_stock,
      v_next_stock,
      0,
      0,
      0,
      v_posting_date,
      v_posting_time,
      COALESCE(NULLIF(BTRIM(p_notes), ''), 'Delivery note ' || v_dn.dn_no || ' received'),
      p_user_id,
      p_user_id
    );

    UPDATE stock_request_items
    SET
      received_qty = COALESCE(received_qty, 0) + v_received_qty,
      updated_at = v_now
    WHERE id = v_dn_item.sr_item_id;
  END LOOP;

  IF NOT v_has_receive_line THEN
    RAISE EXCEPTION 'No dispatched quantities available to receive';
  END IF;

  UPDATE delivery_notes
  SET
    status = 'received',
    received_at = v_now,
    notes = COALESCE(NULLIF(BTRIM(p_notes), ''), notes),
    updated_by = p_user_id,
    updated_at = v_now
  WHERE id = p_dn_id
    AND company_id = p_company_id;
END;
$$;
