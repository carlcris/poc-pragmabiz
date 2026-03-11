-- ============================================================================
-- Migration: Add Delivery Note Post-Dispatch Adjustment RPCs
-- Version: 20260308173000
-- Description: Adds transactional helpers for post-dispatch DN line
--              adjustments, partial line reservation, and incremental
--              pick-list workflow support.
-- Date: 2026-03-08
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS ux_pick_lists_active_per_dn;

CREATE UNIQUE INDEX IF NOT EXISTS ux_pick_lists_active_per_dn
  ON pick_lists(dn_id)
  WHERE status IN ('pending', 'in_progress', 'paused') AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.cancel_pick_list_reset_progress(
  p_company_id UUID,
  p_user_id UUID,
  p_pick_list_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pick_list pick_lists%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_has_dispatched BOOLEAN := FALSE;
BEGIN
  SELECT *
  INTO v_pick_list
  FROM pick_lists
  WHERE id = p_pick_list_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pick list not found';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pick_list_items pli
    JOIN delivery_note_items dni
      ON dni.id = pli.dn_item_id
     AND dni.company_id = pli.company_id
    WHERE pli.company_id = p_company_id
      AND pli.pick_list_id = p_pick_list_id
      AND COALESCE(dni.dispatched_qty, 0) > 0
  )
  INTO v_has_dispatched;

  IF v_has_dispatched THEN
    RAISE EXCEPTION 'Cannot cancel pick list after dispatch has started for its lines';
  END IF;

  UPDATE pick_list_items
  SET
    picked_qty = 0,
    short_qty = allocated_qty,
    updated_at = v_now
  WHERE company_id = p_company_id
    AND pick_list_id = p_pick_list_id;

  UPDATE delivery_note_item_picks
  SET
    deleted_at = v_now,
    updated_at = v_now,
    updated_by = p_user_id
  WHERE company_id = p_company_id
    AND pick_list_id = p_pick_list_id
    AND deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_delivery_note_inventory_lines(
  p_company_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_line_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dn delivery_notes%ROWTYPE;
  v_dni delivery_note_items%ROWTYPE;
  v_wh item_warehouse%ROWTYPE;
  v_available NUMERIC;
  v_suggested_pick_location_id UUID;
  v_suggested_pick_batch_code TEXT;
  v_suggested_pick_batch_received_at TIMESTAMP;
BEGIN
  IF COALESCE(array_length(p_line_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one delivery note line id is required';
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

  IF v_dn.status IN ('received', 'voided') THEN
    RAISE EXCEPTION 'Cannot reserve delivery note lines for received or voided delivery notes';
  END IF;

  FOR v_dni IN
    SELECT *
    FROM delivery_note_items
    WHERE company_id = p_company_id
      AND dn_id = p_dn_id
      AND id = ANY(p_line_ids)
    ORDER BY created_at ASC, id ASC
    FOR UPDATE
  LOOP
    IF COALESCE(v_dni.is_voided, FALSE) THEN
      RAISE EXCEPTION 'Cannot reserve inventory for voided delivery note line %', v_dni.id;
    END IF;

    SELECT *
    INTO v_wh
    FROM item_warehouse
    WHERE company_id = p_company_id
      AND item_id = v_dni.item_id
      AND warehouse_id = v_dni.fulfilling_warehouse_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock for item % in warehouse %',
        v_dni.item_id, v_dni.fulfilling_warehouse_id;
    END IF;

    v_available := GREATEST(0, COALESCE(v_wh.current_stock, 0) - COALESCE(v_wh.reserved_stock, 0));
    IF v_available < COALESCE(v_dni.allocated_qty, 0) THEN
      RAISE EXCEPTION 'Insufficient available stock for item % in warehouse %. Available %, requested %',
        v_dni.item_id, v_dni.fulfilling_warehouse_id, v_available, COALESCE(v_dni.allocated_qty, 0);
    END IF;

    UPDATE item_warehouse
    SET
      reserved_stock = COALESCE(reserved_stock, 0) + COALESCE(v_dni.allocated_qty, 0),
      updated_by = p_user_id,
      updated_at = NOW()
    WHERE id = v_wh.id;

    v_suggested_pick_location_id := NULL;
    v_suggested_pick_batch_code := NULL;
    v_suggested_pick_batch_received_at := NULL;

    SELECT
      ilb.location_id,
      ib.batch_code,
      ib.received_at
    INTO
      v_suggested_pick_location_id,
      v_suggested_pick_batch_code,
      v_suggested_pick_batch_received_at
    FROM item_location_batch ilb
    JOIN item_batch ib
      ON ib.id = ilb.item_batch_id
     AND ib.company_id = ilb.company_id
     AND ib.deleted_at IS NULL
    WHERE ilb.company_id = p_company_id
      AND ilb.item_id = v_dni.item_id
      AND ilb.warehouse_id = v_dni.fulfilling_warehouse_id
      AND ilb.deleted_at IS NULL
      AND GREATEST(0, COALESCE(ilb.qty_on_hand, 0) - COALESCE(ilb.qty_reserved, 0)) > 0
    ORDER BY ib.received_at ASC, ilb.created_at ASC, ilb.id ASC
    LIMIT 1;

    UPDATE delivery_note_items
    SET
      suggested_pick_location_id = COALESCE(v_suggested_pick_location_id, suggested_pick_location_id),
      suggested_pick_batch_code = COALESCE(v_suggested_pick_batch_code, suggested_pick_batch_code),
      suggested_pick_batch_received_at = COALESCE(v_suggested_pick_batch_received_at, suggested_pick_batch_received_at),
      updated_at = NOW()
    WHERE id = v_dni.id
      AND company_id = p_company_id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_dispatched_delivery_note_item(
  p_company_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_delivery_note_item_id UUID,
  p_new_dispatched_qty NUMERIC,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dn delivery_notes%ROWTYPE;
  v_dni delivery_note_items%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_reason TEXT := NULLIF(BTRIM(p_reason), '');
  v_current_dispatched NUMERIC;
  v_delta NUMERIC;
  v_pick_row RECORD;
  v_take_qty NUMERIC;
  v_remaining_reversal NUMERIC;
  v_item_batch_row item_batch%ROWTYPE;
  v_item_location_batch_row item_location_batch%ROWTYPE;
  v_item_location_row item_location%ROWTYPE;
  v_warehouse_stock item_warehouse%ROWTYPE;
  v_tx_id UUID;
  v_current_stock NUMERIC;
  v_next_stock NUMERIC;
  v_new_allocated NUMERIC;
  v_new_picked NUMERIC;
  v_new_short NUMERIC;
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
    RAISE EXCEPTION 'Only dispatched delivery notes can be adjusted';
  END IF;

  SELECT *
  INTO v_dni
  FROM delivery_note_items
  WHERE id = p_delivery_note_item_id
    AND company_id = p_company_id
    AND dn_id = p_dn_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note item not found';
  END IF;

  IF COALESCE(v_dni.is_voided, FALSE) THEN
    RAISE EXCEPTION 'Voided delivery note lines cannot be adjusted';
  END IF;

  IF p_new_dispatched_qty IS NULL THEN
    RAISE EXCEPTION 'New dispatched quantity is required';
  END IF;

  v_current_dispatched := COALESCE(v_dni.dispatched_qty, 0);
  IF p_new_dispatched_qty < 0 OR p_new_dispatched_qty > v_current_dispatched THEN
    RAISE EXCEPTION 'New dispatched quantity must be between 0 and %', v_current_dispatched;
  END IF;

  v_delta := v_current_dispatched - p_new_dispatched_qty;
  IF v_delta <= 0 THEN
    RAISE EXCEPTION 'Adjustment delta must be greater than zero';
  END IF;

  SELECT *
  INTO v_warehouse_stock
  FROM item_warehouse
  WHERE company_id = p_company_id
    AND item_id = v_dni.item_id
    AND warehouse_id = v_dni.fulfilling_warehouse_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse stock not found for item %', v_dni.item_id;
  END IF;

  v_current_stock := COALESCE(v_warehouse_stock.current_stock, 0);
  v_next_stock := v_current_stock + v_delta;

  v_remaining_reversal := v_delta;

  FOR v_pick_row IN
    SELECT *
    FROM delivery_note_item_picks
    WHERE company_id = p_company_id
      AND dn_id = p_dn_id
      AND delivery_note_item_id = p_delivery_note_item_id
      AND deleted_at IS NULL
      AND COALESCE(dispatched_qty, 0) > COALESCE(reversed_qty, 0)
    ORDER BY created_at DESC, id DESC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining_reversal <= 0;

    v_take_qty := LEAST(
      v_remaining_reversal,
      GREATEST(0, COALESCE(v_pick_row.dispatched_qty, 0) - COALESCE(v_pick_row.reversed_qty, 0))
    );

    IF v_take_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT *
    INTO v_item_batch_row
    FROM item_batch
    WHERE company_id = p_company_id
      AND item_id = v_dni.item_id
      AND warehouse_id = COALESCE(v_pick_row.source_warehouse_id, v_dni.fulfilling_warehouse_id)
      AND batch_code = v_pick_row.picked_batch_code
      AND received_at = v_pick_row.picked_batch_received_at
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item batch not found for reversal';
    END IF;

    SELECT *
    INTO v_item_location_batch_row
    FROM item_location_batch
    WHERE company_id = p_company_id
      AND item_id = v_dni.item_id
      AND warehouse_id = COALESCE(v_pick_row.source_warehouse_id, v_dni.fulfilling_warehouse_id)
      AND location_id = v_pick_row.picked_location_id
      AND item_batch_id = v_item_batch_row.id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item location batch not found for reversal';
    END IF;

    SELECT *
    INTO v_item_location_row
    FROM item_location
    WHERE company_id = p_company_id
      AND item_id = v_dni.item_id
      AND warehouse_id = COALESCE(v_pick_row.source_warehouse_id, v_dni.fulfilling_warehouse_id)
      AND location_id = v_pick_row.picked_location_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item location not found for reversal';
    END IF;

    UPDATE item_location_batch
    SET
      qty_on_hand = COALESCE(qty_on_hand, 0) + v_take_qty,
      updated_by = p_user_id,
      updated_at = v_now
    WHERE id = v_item_location_batch_row.id;

    UPDATE item_batch
    SET
      qty_on_hand = COALESCE(qty_on_hand, 0) + v_take_qty,
      updated_by = p_user_id,
      updated_at = v_now
    WHERE id = v_item_batch_row.id;

    UPDATE item_location
    SET
      qty_on_hand = COALESCE(qty_on_hand, 0) + v_take_qty,
      updated_by = p_user_id,
      updated_at = v_now
    WHERE id = v_item_location_row.id;

    UPDATE delivery_note_item_picks
    SET
      reversed_qty = COALESCE(reversed_qty, 0) + v_take_qty,
      updated_by = p_user_id,
      updated_at = v_now
    WHERE id = v_pick_row.id;

    v_remaining_reversal := v_remaining_reversal - v_take_qty;
  END LOOP;

  IF v_remaining_reversal > 0 THEN
    RAISE EXCEPTION 'Insufficient dispatched pick rows to reverse delivery note item %', p_delivery_note_item_id;
  END IF;

  INSERT INTO stock_transactions (
    company_id,
    business_unit_id,
    transaction_type,
    transaction_date,
    warehouse_id,
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
    v_dn.business_unit_id,
    'adjustment',
    v_now::DATE,
    v_dni.fulfilling_warehouse_id,
    'delivery_note_adjustment',
    v_dn.id,
    v_dn.dn_no,
    'posted',
    COALESCE(v_reason, 'Delivery note line quantity reduced after dispatch'),
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_tx_id;

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
    v_dni.item_id,
    v_delta,
    v_dni.uom_id,
    v_current_stock,
    v_next_stock,
    v_now::DATE,
    v_now::TIME,
    COALESCE(v_reason, 'Delivery note line quantity reduced after dispatch'),
    p_user_id,
    p_user_id
  );

  v_new_allocated := GREATEST(0, COALESCE(v_dni.allocated_qty, 0) - v_delta);
  v_new_picked := GREATEST(0, COALESCE(v_dni.picked_qty, 0) - v_delta);
  v_new_short := GREATEST(0, v_new_allocated - v_new_picked);

  UPDATE delivery_note_items
  SET
    allocated_qty = v_new_allocated,
    picked_qty = v_new_picked,
    short_qty = v_new_short,
    dispatched_qty = p_new_dispatched_qty,
    is_voided = (p_new_dispatched_qty = 0),
    voided_at = CASE WHEN p_new_dispatched_qty = 0 THEN v_now ELSE NULL END,
    voided_by = CASE WHEN p_new_dispatched_qty = 0 THEN p_user_id ELSE NULL END,
    void_reason = CASE WHEN p_new_dispatched_qty = 0 THEN v_reason ELSE NULL END,
    updated_at = v_now
  WHERE id = p_delivery_note_item_id
    AND company_id = p_company_id;

  UPDATE stock_request_items
  SET
    dispatch_qty = GREATEST(0, COALESCE(dispatch_qty, 0) - v_delta),
    updated_at = v_now
  WHERE id = v_dni.sr_item_id;

  INSERT INTO delivery_note_item_adjustments (
    company_id,
    dn_id,
    delivery_note_item_id,
    adjustment_type,
    qty_delta,
    prior_dispatched_qty,
    new_dispatched_qty,
    reason,
    created_at,
    created_by
  )
  VALUES (
    p_company_id,
    p_dn_id,
    p_delivery_note_item_id,
    CASE WHEN p_new_dispatched_qty = 0 THEN 'void_qty' ELSE 'reduce_qty' END,
    v_delta,
    v_current_dispatched,
    p_new_dispatched_qty,
    v_reason,
    v_now,
    p_user_id
  );
END;
$$;

COMMIT;
