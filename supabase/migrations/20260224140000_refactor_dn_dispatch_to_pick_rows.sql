-- ============================================================================
-- Migration: Refactor DN Dispatch To Use Pick Rows
-- Version: 20260224140000
-- Description: Updates post_delivery_note_dispatch to consume
--              delivery_note_item_picks (actual picked location+batch rows)
--              and batch-aware inventory layers.
-- Date: 2026-02-24
-- ============================================================================

BEGIN;

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
  v_now TIMESTAMP;
  v_posting_date DATE;
  v_posting_time TIME;
  v_line JSONB;
  v_item_id UUID;
  v_dispatch_qty NUMERIC;
  v_remaining_pick_qty NUMERIC;
  v_remaining_dispatch_qty NUMERIC;
  v_take_qty NUMERIC;
  v_current_stock NUMERIC;
  v_next_stock NUMERIC;
  v_has_dispatch_line BOOLEAN := FALSE;
  v_line_fulfilling_warehouse_id UUID;
  v_line_default_location_id UUID;
  v_reserved_stock NUMERIC;
  v_pick_row RECORD;
  v_item_batch_row item_batch%ROWTYPE;
  v_item_location_batch_row item_location_batch%ROWTYPE;
  v_item_location_row item_location%ROWTYPE;
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

    v_remaining_pick_qty := GREATEST(
      0,
      COALESCE(v_dn_item.picked_qty, 0) - COALESCE(v_dn_item.dispatched_qty, 0)
    );
    IF v_dispatch_qty < 0 OR v_dispatch_qty > v_remaining_pick_qty THEN
      RAISE EXCEPTION 'Invalid dispatch quantity for delivery note item %', v_item_id;
    END IF;

    IF v_dispatch_qty = 0 THEN
      CONTINUE;
    END IF;

    v_line_fulfilling_warehouse_id := COALESCE(v_dn_item.fulfilling_warehouse_id, v_dn.fulfilling_warehouse_id);
    IF v_line_fulfilling_warehouse_id IS NULL THEN
      RAISE EXCEPTION 'Missing fulfilling warehouse for delivery note item %', v_item_id;
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
      v_line_fulfilling_warehouse_id,
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

    INSERT INTO stock_transactions (
      company_id,
      business_unit_id,
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
      'out',
      v_posting_date,
      v_line_fulfilling_warehouse_id,
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
      AND warehouse_id = v_line_fulfilling_warehouse_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock for item %', v_dn_item.item_id;
    END IF;

    v_current_stock := COALESCE(v_warehouse_stock.current_stock, 0);
    IF v_current_stock < v_dispatch_qty THEN
      RAISE EXCEPTION 'Insufficient stock for item %', v_dn_item.item_id;
    END IF;

    v_reserved_stock := COALESCE(v_warehouse_stock.reserved_stock, 0);
    IF v_reserved_stock < v_dispatch_qty THEN
      RAISE EXCEPTION 'Insufficient reserved stock for item % on delivery note dispatch', v_dn_item.item_id;
    END IF;

    v_remaining_dispatch_qty := v_dispatch_qty;

    FOR v_pick_row IN
      SELECT *
      FROM delivery_note_item_picks
      WHERE company_id = p_company_id
        AND dn_id = p_dn_id
        AND delivery_note_item_id = v_dn_item.id
        AND deleted_at IS NULL
        AND COALESCE(picked_qty, 0) > COALESCE(dispatched_qty, 0)
      ORDER BY created_at ASC, id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining_dispatch_qty <= 0;

      v_take_qty := LEAST(
        v_remaining_dispatch_qty,
        GREATEST(0, COALESCE(v_pick_row.picked_qty, 0) - COALESCE(v_pick_row.dispatched_qty, 0))
      );
      IF v_take_qty <= 0 THEN
        CONTINUE;
      END IF;

      SELECT *
      INTO v_item_batch_row
      FROM item_batch
      WHERE company_id = p_company_id
        AND item_id = v_dn_item.item_id
        AND warehouse_id = COALESCE(v_pick_row.source_warehouse_id, v_line_fulfilling_warehouse_id)
        AND batch_code = v_pick_row.picked_batch_code
        AND received_at = v_pick_row.picked_batch_received_at
        AND deleted_at IS NULL
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Picked batch not found for delivery note item % (batch %, receipt %)',
          v_dn_item.id, v_pick_row.picked_batch_code, v_pick_row.picked_batch_received_at;
      END IF;

      IF COALESCE(v_item_batch_row.qty_on_hand, 0) < v_take_qty THEN
        RAISE EXCEPTION 'Insufficient item_batch stock for delivery note item %', v_dn_item.id;
      END IF;

      SELECT *
      INTO v_item_location_batch_row
      FROM item_location_batch
      WHERE company_id = p_company_id
        AND item_id = v_dn_item.item_id
        AND warehouse_id = COALESCE(v_pick_row.source_warehouse_id, v_line_fulfilling_warehouse_id)
        AND location_id = v_pick_row.picked_location_id
        AND item_batch_id = v_item_batch_row.id
        AND deleted_at IS NULL
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Picked item_location_batch row not found for delivery note item %', v_dn_item.id;
      END IF;

      IF COALESCE(v_item_location_batch_row.qty_on_hand, 0) < v_take_qty THEN
        RAISE EXCEPTION 'Insufficient item_location_batch stock for delivery note item %', v_dn_item.id;
      END IF;

      SELECT *
      INTO v_item_location_row
      FROM item_location
      WHERE company_id = p_company_id
        AND item_id = v_dn_item.item_id
        AND warehouse_id = COALESCE(v_pick_row.source_warehouse_id, v_line_fulfilling_warehouse_id)
        AND location_id = v_pick_row.picked_location_id
        AND deleted_at IS NULL
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Picked item_location row not found for delivery note item %', v_dn_item.id;
      END IF;

      IF COALESCE(v_item_location_row.qty_on_hand, 0) < v_take_qty THEN
        RAISE EXCEPTION 'Insufficient item_location stock for delivery note item %', v_dn_item.id;
      END IF;

      UPDATE item_location_batch
      SET
        qty_on_hand = qty_on_hand - v_take_qty,
        updated_by = p_user_id,
        updated_at = v_now
      WHERE id = v_item_location_batch_row.id;

      UPDATE item_batch
      SET
        qty_on_hand = qty_on_hand - v_take_qty,
        updated_by = p_user_id,
        updated_at = v_now
      WHERE id = v_item_batch_row.id;

      UPDATE item_location
      SET
        qty_on_hand = qty_on_hand - v_take_qty,
        updated_by = p_user_id,
        updated_at = v_now
      WHERE id = v_item_location_row.id;

      UPDATE delivery_note_item_picks
      SET
        dispatched_qty = COALESCE(dispatched_qty, 0) + v_take_qty,
        updated_by = p_user_id,
        updated_at = v_now
      WHERE id = v_pick_row.id;

      v_remaining_dispatch_qty := v_remaining_dispatch_qty - v_take_qty;
    END LOOP;

    IF v_remaining_dispatch_qty > 0 THEN
      RAISE EXCEPTION 'Insufficient picked rows to dispatch delivery note item %', v_dn_item.id;
    END IF;

    v_next_stock := v_current_stock - v_dispatch_qty;

    UPDATE item_warehouse
    SET
      current_stock = v_next_stock,
      reserved_stock = GREATEST(0, COALESCE(reserved_stock, 0) - v_dispatch_qty),
      updated_by = p_user_id,
      updated_at = v_now
    WHERE id = v_warehouse_stock.id;

    INSERT INTO stock_transaction_items (
      company_id,
      transaction_id,
      item_id,
      quantity,
      uom_id,
      qty_before,
      qty_after,
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
      v_current_stock,
      v_next_stock,
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
    driver_signature = COALESCE(NULLIF(BTRIM(p_driver_signature), ''), driver_signature),
    notes = COALESCE(NULLIF(BTRIM(p_notes), ''), notes),
    updated_by = p_user_id,
    updated_at = v_now
  WHERE id = p_dn_id
    AND company_id = p_company_id;
END;
$$;

COMMIT;
