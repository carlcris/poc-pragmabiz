-- ============================================================================
-- Migration: Add DN Reservation + Suggestion RPC
-- Version: 20260224130000
-- Description: Reserves aggregate stock at DN creation and computes advisory
--              suggested pick source (location + batch) per DN line.
-- Date: 2026-02-24
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.reserve_delivery_note_inventory(
  p_company_id UUID,
  p_user_id UUID,
  p_dn_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_dn delivery_notes%ROWTYPE;
  v_dni delivery_note_items%ROWTYPE;
  v_wh item_warehouse%ROWTYPE;
  v_available NUMERIC;
  v_suggested_pick_location_id UUID;
  v_suggested_pick_batch_code TEXT;
  v_suggested_pick_batch_received_at TIMESTAMP;
  v_total_allocated NUMERIC := 0;
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

  IF v_dn.status <> 'draft' THEN
    RAISE EXCEPTION 'Inventory reservation only allowed while delivery note is in draft status';
  END IF;

  FOR v_dni IN
    SELECT *
    FROM delivery_note_items
    WHERE company_id = p_company_id
      AND dn_id = p_dn_id
    ORDER BY created_at ASC, id ASC
    FOR UPDATE
  LOOP
    v_total_allocated := v_total_allocated + COALESCE(v_dni.allocated_qty, 0);

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

    -- Advisory suggestion only (non-binding): oldest batch, then deterministic location row.
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

  IF v_total_allocated <= 0 THEN
    RAISE EXCEPTION 'Delivery note has no allocatable line quantities';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.reserve_delivery_note_inventory(UUID, UUID, UUID) IS
  'Reserves aggregate stock on item_warehouse for a draft delivery note and stores advisory FIFO pick source suggestions on delivery_note_items.';

COMMIT;
