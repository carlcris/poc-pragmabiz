-- ============================================================================
-- Migration: Fix legacy stock transaction RPCs to use DB-generated codes
-- Description: Replaces legacy RPC/function implementations that still
--              inserted explicit stock_transactions.transaction_code values.
--              The stock_transactions trigger remains the sole owner of code
--              generation.
-- Date: 2026-03-11
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
  v_line_requesting_warehouse_id UUID;
  v_line_default_location_id UUID;
  v_remaining_receive_qty NUMERIC;
  v_take_qty NUMERIC;
  v_pick_row RECORD;
  v_dest_item_batch item_batch%ROWTYPE;
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

    SELECT COALESCE(SUM(GREATEST(0, COALESCE(dispatched_qty, 0) - COALESCE(received_qty, 0))), 0)
    INTO v_max_receivable_qty
    FROM delivery_note_item_picks
    WHERE company_id = p_company_id
      AND dn_id = p_dn_id
      AND delivery_note_item_id = v_dn_item.id
      AND deleted_at IS NULL;

    IF v_max_receivable_qty = 0 THEN
      v_max_receivable_qty := COALESCE(v_dn_item.dispatched_qty, 0);
    END IF;

    IF v_received_qty < 0 OR v_received_qty > v_max_receivable_qty THEN
      RAISE EXCEPTION 'Received quantity must be between 0 and %', v_max_receivable_qty;
    END IF;

    IF v_received_qty = 0 THEN
      CONTINUE;
    END IF;

    v_line_requesting_warehouse_id := COALESCE(
      v_dn_item.requesting_warehouse_id,
      v_dn.requesting_warehouse_id
    );
    IF v_line_requesting_warehouse_id IS NULL THEN
      RAISE EXCEPTION 'Missing requesting warehouse for delivery note item %', v_item_id;
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
      v_line_requesting_warehouse_id,
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

    INSERT INTO stock_transactions (
      company_id,
      business_unit_id,
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
      'in',
      v_posting_date,
      v_line_requesting_warehouse_id,
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
      AND warehouse_id = v_line_requesting_warehouse_id
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
        v_line_requesting_warehouse_id,
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
      v_line_requesting_warehouse_id,
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

    v_remaining_receive_qty := v_received_qty;

    FOR v_pick_row IN
      SELECT *
      FROM delivery_note_item_picks
      WHERE company_id = p_company_id
        AND dn_id = p_dn_id
        AND delivery_note_item_id = v_dn_item.id
        AND deleted_at IS NULL
        AND COALESCE(dispatched_qty, 0) > COALESCE(received_qty, 0)
      ORDER BY created_at ASC, id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining_receive_qty <= 0;

      v_take_qty := LEAST(
        v_remaining_receive_qty,
        GREATEST(0, COALESCE(v_pick_row.dispatched_qty, 0) - COALESCE(v_pick_row.received_qty, 0))
      );
      IF v_take_qty <= 0 THEN
        CONTINUE;
      END IF;

      SELECT *
      INTO v_dest_item_batch
      FROM item_batch
      WHERE company_id = p_company_id
        AND item_id = v_dn_item.item_id
        AND warehouse_id = v_line_requesting_warehouse_id
        AND batch_code = v_pick_row.picked_batch_code
        AND deleted_at IS NULL
      FOR UPDATE;

      IF FOUND THEN
        IF v_dest_item_batch.received_at <> v_pick_row.picked_batch_received_at THEN
          RAISE EXCEPTION 'Batch % receipt date mismatch on destination warehouse for item % (existing %, incoming %)',
            v_pick_row.picked_batch_code,
            v_dn_item.item_id,
            v_dest_item_batch.received_at,
            v_pick_row.picked_batch_received_at;
        END IF;

        UPDATE item_batch
        SET
          qty_on_hand = qty_on_hand + v_take_qty,
          updated_by = p_user_id,
          updated_at = v_now
        WHERE id = v_dest_item_batch.id;
      ELSE
        INSERT INTO item_batch (
          company_id,
          item_id,
          warehouse_id,
          batch_code,
          received_at,
          qty_on_hand,
          qty_reserved,
          created_by,
          updated_by
        )
        VALUES (
          p_company_id,
          v_dn_item.item_id,
          v_line_requesting_warehouse_id,
          v_pick_row.picked_batch_code,
          v_pick_row.picked_batch_received_at,
          v_take_qty,
          0,
          p_user_id,
          p_user_id
        )
        RETURNING * INTO v_dest_item_batch;
      END IF;

      INSERT INTO item_location_batch (
        company_id,
        item_id,
        warehouse_id,
        location_id,
        item_batch_id,
        qty_on_hand,
        qty_reserved,
        created_by,
        updated_by
      )
      VALUES (
        p_company_id,
        v_dn_item.item_id,
        v_line_requesting_warehouse_id,
        v_target_location_id,
        v_dest_item_batch.id,
        v_take_qty,
        0,
        p_user_id,
        p_user_id
      )
      ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE
      SET
        qty_on_hand = item_location_batch.qty_on_hand + EXCLUDED.qty_on_hand,
        updated_by = EXCLUDED.updated_by,
        updated_at = v_now;

      UPDATE delivery_note_item_picks
      SET
        received_qty = COALESCE(received_qty, 0) + v_take_qty,
        updated_by = p_user_id,
        updated_at = v_now
      WHERE id = v_pick_row.id;

      v_remaining_receive_qty := v_remaining_receive_qty - v_take_qty;
    END LOOP;

    IF v_remaining_receive_qty > 0 THEN
      RAISE EXCEPTION 'Insufficient dispatched pick rows to receive delivery note item %', v_dn_item.id;
    END IF;

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

CREATE OR REPLACE FUNCTION public.approve_grn_with_batch_inventory(
  p_company_id UUID,
  p_user_id UUID,
  p_grn_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_grn grns%ROWTYPE;
  v_grn_item grn_items%ROWTYPE;
  v_item_uom_id UUID;
  v_now TIMESTAMP := NOW();
  v_tx_id UUID;
  v_tx_code TEXT;
  v_posting_date DATE;
  v_posting_time TIME;
  v_default_location_id UUID;
  v_generated_batch_code TEXT;
  v_batch_code TEXT;
  v_item_wh item_warehouse%ROWTYPE;
  v_item_batch item_batch%ROWTYPE;
  v_item_loc item_location%ROWTYPE;
  v_item_loc_batch item_location_batch%ROWTYPE;
  v_received_qty NUMERIC;
  v_damaged_qty NUMERIC;
  v_batch_received_at TIMESTAMP;
  v_boxes_total_qty NUMERIC;
  v_remainder_qty NUMERIC;
  v_has_items BOOLEAN := FALSE;
  v_line_location RECORD;
  v_item_wh_current_stock NUMERIC;
  v_item_wh_reserved_stock NUMERIC;
  v_item_wh_next_stock NUMERIC;
BEGIN
  SELECT *
  INTO v_grn
  FROM grns
  WHERE id = p_grn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN not found';
  END IF;

  IF v_grn.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only GRNs in pending approval can be approved';
  END IF;

  v_posting_date := COALESCE(v_grn.receiving_date, CURRENT_DATE);
  v_posting_time := v_now::TIME;
  v_batch_received_at := v_posting_date::TIMESTAMP + v_posting_time;

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
    v_grn.warehouse_id,
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
  RETURNING id INTO v_default_location_id;

  INSERT INTO stock_transactions (
    company_id,
    business_unit_id,
    transaction_type,
    transaction_date,
    warehouse_id,
    to_location_id,
    reference_type,
    reference_id,
    status,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    v_grn.business_unit_id,
    'in',
    v_posting_date,
    v_grn.warehouse_id,
    v_default_location_id,
    'grn',
    v_grn.id,
    'posted',
    COALESCE(NULLIF(BTRIM(p_notes), ''), 'Auto-created from GRN ' || v_grn.grn_number),
    p_user_id,
    p_user_id
  )
  RETURNING id, transaction_code INTO v_tx_id, v_tx_code;

  FOR v_grn_item IN
    SELECT gi.*
    FROM grn_items gi
    WHERE gi.grn_id = v_grn.id
    ORDER BY gi.created_at ASC, gi.id ASC
    FOR UPDATE
  LOOP
    v_has_items := TRUE;
    v_received_qty := COALESCE(v_grn_item.received_qty, 0);
    v_damaged_qty := COALESCE(v_grn_item.damaged_qty, 0);

    IF v_received_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT i.uom_id
    INTO v_item_uom_id
    FROM items i
    WHERE i.id = v_grn_item.item_id;

    IF v_item_uom_id IS NULL THEN
      RAISE EXCEPTION 'Item UOM not found for item %', v_grn_item.item_id;
    END IF;

    v_generated_batch_code := COALESCE(
      NULLIF(BTRIM(v_grn.batch_number), ''),
      'GRN-' || v_grn.grn_number || '-' || SUBSTRING(REPLACE(v_grn_item.id::TEXT, '-', ''), 1, 8)
    );
    v_batch_code := v_generated_batch_code;

    PERFORM 1
    FROM item_batch ib_dup
    WHERE ib_dup.company_id = p_company_id
      AND ib_dup.item_id = v_grn_item.item_id
      AND ib_dup.warehouse_id = v_grn.warehouse_id
      AND ib_dup.batch_code = v_batch_code
      AND ib_dup.deleted_at IS NULL;

    IF FOUND THEN
      RAISE EXCEPTION 'Duplicate batch code % for item % in warehouse %',
        v_batch_code, v_grn_item.item_id, v_grn.warehouse_id;
    END IF;

    SELECT *
    INTO v_item_wh
    FROM item_warehouse
    WHERE company_id = p_company_id
      AND item_id = v_grn_item.item_id
      AND warehouse_id = v_grn.warehouse_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND THEN
      v_item_wh_current_stock := COALESCE(v_item_wh.current_stock, 0);
      v_item_wh_reserved_stock := COALESCE(v_item_wh.reserved_stock, 0);
      v_item_wh_next_stock := v_item_wh_current_stock + v_received_qty;

      UPDATE item_warehouse
      SET
        current_stock = v_item_wh_next_stock,
        in_transit = GREATEST(0, COALESCE(in_transit, 0) - v_received_qty),
        estimated_arrival_date = CASE
          WHEN GREATEST(0, COALESCE(in_transit, 0) - v_received_qty) > 0 THEN estimated_arrival_date
          ELSE NULL
        END,
        default_location_id = COALESCE(default_location_id, v_default_location_id),
        updated_by = p_user_id,
        updated_at = v_now
      WHERE id = v_item_wh.id;
    ELSE
      v_item_wh_current_stock := 0;
      v_item_wh_reserved_stock := 0;
      v_item_wh_next_stock := v_received_qty;

      INSERT INTO item_warehouse (
        company_id,
        item_id,
        warehouse_id,
        current_stock,
        reserved_stock,
        in_transit,
        estimated_arrival_date,
        default_location_id,
        created_by,
        updated_by
      )
      VALUES (
        p_company_id,
        v_grn_item.item_id,
        v_grn.warehouse_id,
        v_item_wh_next_stock,
        0,
        0,
        NULL,
        v_default_location_id,
        p_user_id,
        p_user_id
      );
    END IF;

    INSERT INTO item_batch (
      company_id,
      item_id,
      warehouse_id,
      batch_code,
      received_at,
      qty_on_hand,
      qty_reserved,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_grn_item.item_id,
      v_grn.warehouse_id,
      v_batch_code,
      v_batch_received_at,
      v_received_qty,
      0,
      p_user_id,
      p_user_id
    )
    RETURNING * INTO v_item_batch;

    v_boxes_total_qty := 0;

    FOR v_line_location IN
      SELECT
        gb.warehouse_location_id AS location_id,
        MIN(NULLIF(BTRIM(gb.batch_location_sku), '')) AS batch_location_sku,
        SUM(COALESCE(gb.qty_per_box, 0))::NUMERIC AS qty
      FROM grn_boxes gb
      WHERE gb.grn_item_id = v_grn_item.id
        AND gb.warehouse_location_id IS NOT NULL
      GROUP BY gb.warehouse_location_id
      ORDER BY gb.warehouse_location_id
    LOOP
      EXIT WHEN v_line_location.qty IS NULL OR v_line_location.qty <= 0;
      v_boxes_total_qty := v_boxes_total_qty + COALESCE(v_line_location.qty, 0);

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
        v_grn_item.item_id,
        v_grn.warehouse_id,
        v_line_location.location_id,
        v_line_location.qty,
        0,
        p_user_id,
        p_user_id
      )
      ON CONFLICT (company_id, item_id, warehouse_id, location_id) DO UPDATE
      SET
        qty_on_hand = item_location.qty_on_hand + EXCLUDED.qty_on_hand,
        updated_by = EXCLUDED.updated_by,
        updated_at = v_now
      RETURNING * INTO v_item_loc;

      INSERT INTO item_location_batch (
        company_id,
        item_id,
        warehouse_id,
        location_id,
        item_batch_id,
        batch_location_sku,
        qty_on_hand,
        qty_reserved,
        created_by,
        updated_by
      )
      VALUES (
        p_company_id,
        v_grn_item.item_id,
        v_grn.warehouse_id,
        v_line_location.location_id,
        v_item_batch.id,
        NULLIF(BTRIM(v_line_location.batch_location_sku::TEXT), ''),
        v_line_location.qty,
        0,
        p_user_id,
        p_user_id
      )
      ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE
      SET
        qty_on_hand = item_location_batch.qty_on_hand + EXCLUDED.qty_on_hand,
        batch_location_sku = COALESCE(item_location_batch.batch_location_sku, EXCLUDED.batch_location_sku),
        updated_by = EXCLUDED.updated_by,
        updated_at = v_now
      RETURNING * INTO v_item_loc_batch;

      UPDATE grn_boxes
      SET
        batch_location_sku = v_item_loc_batch.batch_location_sku
      WHERE grn_item_id = v_grn_item.id
        AND warehouse_location_id = v_line_location.location_id;
    END LOOP;

    v_remainder_qty := GREATEST(0, v_received_qty - COALESCE(v_boxes_total_qty, 0));
    IF v_remainder_qty > 0 THEN
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
        v_grn_item.item_id,
        v_grn.warehouse_id,
        COALESCE(v_item_wh.default_location_id, v_default_location_id),
        v_remainder_qty,
        0,
        p_user_id,
        p_user_id
      )
      ON CONFLICT (company_id, item_id, warehouse_id, location_id) DO UPDATE
      SET
        qty_on_hand = item_location.qty_on_hand + EXCLUDED.qty_on_hand,
        updated_by = EXCLUDED.updated_by,
        updated_at = v_now;

      INSERT INTO item_location_batch (
        company_id,
        item_id,
        warehouse_id,
        location_id,
        item_batch_id,
        qty_on_hand,
        qty_reserved,
        created_by,
        updated_by
      )
      VALUES (
        p_company_id,
        v_grn_item.item_id,
        v_grn.warehouse_id,
        COALESCE(v_item_wh.default_location_id, v_default_location_id),
        v_item_batch.id,
        v_remainder_qty,
        0,
        p_user_id,
        p_user_id
      )
      ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE
      SET
        qty_on_hand = item_location_batch.qty_on_hand + EXCLUDED.qty_on_hand,
        updated_by = EXCLUDED.updated_by,
        updated_at = v_now;
    END IF;

    INSERT INTO stock_transaction_items (
      company_id,
      transaction_id,
      item_id,
      quantity,
      uom_id,
      batch_no,
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
      v_grn_item.item_id,
      v_received_qty,
      v_item_uom_id,
      v_batch_code,
      v_item_wh_current_stock,
      v_item_wh_next_stock,
      v_posting_date,
      v_posting_time,
      CASE
        WHEN v_damaged_qty > 0 THEN 'GRN ' || v_grn.grn_number || ' (Damaged: ' || v_damaged_qty || ')'
        ELSE 'GRN ' || v_grn.grn_number
      END,
      p_user_id,
      p_user_id
    );
  END LOOP;

  IF NOT v_has_items THEN
    RAISE EXCEPTION 'GRN has no items';
  END IF;

  UPDATE grns
  SET
    status = 'approved',
    checked_by = p_user_id,
    updated_by = p_user_id,
    updated_at = v_now
  WHERE id = v_grn.id;

  UPDATE load_lists
  SET
    status = 'received',
    updated_by = p_user_id,
    updated_at = v_now
  WHERE id = v_grn.load_list_id;

  RETURN v_tx_code;
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
