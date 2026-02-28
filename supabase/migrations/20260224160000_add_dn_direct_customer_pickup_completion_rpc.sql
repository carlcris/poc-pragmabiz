-- ============================================================================
-- Migration: Add DN Direct Customer Pickup Completion RPC
-- Version: 20260224160000
-- Description: Adds a separate transition path to complete delivery notes as
--              customer pickup from warehouse without destination inventory
--              receive posting, while still marking workflow as received.
-- Date: 2026-02-24
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.complete_delivery_note_direct_customer_pickup(
  p_company_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
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
  v_line JSONB;
  v_item_id UUID;
  v_received_qty NUMERIC;
  v_max_receivable_qty NUMERIC;
  v_remaining_receive_qty NUMERIC;
  v_take_qty NUMERIC;
  v_pick_row RECORD;
  v_now TIMESTAMP;
  v_has_receive_line BOOLEAN := FALSE;
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
    RAISE EXCEPTION 'Only dispatched delivery notes can be completed as direct customer pickup';
  END IF;

  v_now := NOW();

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

    v_has_receive_line := TRUE;
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

      UPDATE delivery_note_item_picks
      SET
        received_qty = COALESCE(received_qty, 0) + v_take_qty,
        updated_by = p_user_id,
        updated_at = v_now
      WHERE id = v_pick_row.id;

      v_remaining_receive_qty := v_remaining_receive_qty - v_take_qty;
    END LOOP;

    IF v_remaining_receive_qty > 0 THEN
      RAISE EXCEPTION 'Insufficient dispatched pick rows to complete customer pickup for delivery note item %',
        v_dn_item.id;
    END IF;

    UPDATE stock_request_items
    SET
      received_qty = COALESCE(received_qty, 0) + v_received_qty,
      updated_at = v_now
    WHERE id = v_dn_item.sr_item_id;
  END LOOP;

  IF NOT v_has_receive_line THEN
    RAISE EXCEPTION 'No dispatched quantities available to complete';
  END IF;

  UPDATE delivery_notes
  SET
    status = 'received',
    received_at = COALESCE(p_received_date::timestamp, v_now),
    notes = COALESCE(NULLIF(BTRIM(p_notes), ''), notes),
    updated_by = p_user_id,
    updated_at = v_now
  WHERE id = p_dn_id
    AND company_id = p_company_id;
END;
$$;

COMMIT;
