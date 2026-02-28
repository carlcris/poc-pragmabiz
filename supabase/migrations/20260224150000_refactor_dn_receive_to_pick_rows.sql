-- ============================================================================
-- Migration: Refactor DN Receive To Use Pick Rows
-- Version: 20260224150000
-- Description: Updates post_delivery_note_receive to rebuild destination stock
--              from delivery_note_item_picks while preserving batch_code and
--              original batch received_at across warehouses.
-- Date: 2026-02-24
-- ============================================================================

BEGIN;

ALTER TABLE delivery_note_item_picks
  ADD COLUMN IF NOT EXISTS received_qty DECIMAL(20, 4) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_note_item_picks_received_qty_check'
  ) THEN
    ALTER TABLE delivery_note_item_picks
      ADD CONSTRAINT delivery_note_item_picks_received_qty_check
      CHECK (received_qty >= 0 AND received_qty <= dispatched_qty);
  END IF;
END $$;

COMMENT ON COLUMN delivery_note_item_picks.received_qty IS
  'Quantity from this picked row that has been posted on destination receive.';

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

    -- Fallback for legacy rows / older data where pick rows might not be present.
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

COMMIT;
