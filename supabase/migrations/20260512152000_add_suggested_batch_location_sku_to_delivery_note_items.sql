-- ============================================================================
-- Migration: Add Suggested Batch Location SKU to Delivery Note Items
-- Description: Persists the selected item_location_batch.batch_location_sku
--              alongside DN pick source suggestions.
-- ============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trigger_delivery_note_items_set_qr_code ON public.delivery_note_items;
DROP FUNCTION IF EXISTS public.set_delivery_note_item_qr_code();

ALTER TABLE public.delivery_note_items
  ADD COLUMN IF NOT EXISTS suggested_batch_location_sku TEXT;

ALTER TABLE public.delivery_note_items
  DROP COLUMN IF EXISTS qr_code;

COMMENT ON COLUMN public.delivery_note_items.suggested_batch_location_sku IS
  'Persisted item_location_batch.batch_location_sku for the suggested or picker-selected source.';

CREATE INDEX IF NOT EXISTS idx_delivery_note_items_suggested_batch_location_sku
  ON public.delivery_note_items(company_id, dn_id, suggested_batch_location_sku)
  WHERE suggested_batch_location_sku IS NOT NULL;

DROP INDEX IF EXISTS public.idx_delivery_note_items_qr_code;

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
  v_suggested_batch_location_sku TEXT;
  v_total_allocated NUMERIC := 0;
  v_qty_per_unit NUMERIC := 1;
  v_allocated_base_qty NUMERIC := 0;
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
    IF v_dni.item_unit_option_id IS NOT NULL THEN
      SELECT COALESCE(qty_per_unit, 1)
      INTO v_qty_per_unit
      FROM public.item_unit_options
      WHERE id = v_dni.item_unit_option_id
        AND deleted_at IS NULL;
    ELSE
      v_qty_per_unit := 1;
    END IF;

    v_allocated_base_qty := COALESCE(v_dni.allocated_qty, 0) * COALESCE(v_qty_per_unit, 1);
    v_total_allocated := v_total_allocated + v_allocated_base_qty;

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
    IF v_available < v_allocated_base_qty THEN
      RAISE EXCEPTION 'Insufficient available stock for item % in warehouse %. Available %, requested %',
        v_dni.item_id, v_dni.fulfilling_warehouse_id, v_available, v_allocated_base_qty;
    END IF;

    UPDATE item_warehouse
    SET
      reserved_stock = COALESCE(reserved_stock, 0) + v_allocated_base_qty,
      updated_by = p_user_id,
      updated_at = NOW()
    WHERE id = v_wh.id;

    v_suggested_pick_location_id := NULL;
    v_suggested_pick_batch_code := NULL;
    v_suggested_pick_batch_received_at := NULL;
    v_suggested_batch_location_sku := NULL;

    SELECT
      ilb.location_id,
      ib.batch_code,
      ib.received_at,
      ilb.batch_location_sku
    INTO
      v_suggested_pick_location_id,
      v_suggested_pick_batch_code,
      v_suggested_pick_batch_received_at,
      v_suggested_batch_location_sku
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
      suggested_batch_location_sku = COALESCE(v_suggested_batch_location_sku, suggested_batch_location_sku),
      updated_at = NOW()
    WHERE id = v_dni.id
      AND company_id = p_company_id;
  END LOOP;

  IF v_total_allocated <= 0 THEN
    RAISE EXCEPTION 'Delivery note has no allocatable line quantities';
  END IF;
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
  v_suggested_batch_location_sku TEXT;
  v_qty_per_unit NUMERIC := 1;
  v_allocated_base_qty NUMERIC := 0;
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

    IF v_dni.item_unit_option_id IS NOT NULL THEN
      SELECT COALESCE(qty_per_unit, 1)
      INTO v_qty_per_unit
      FROM public.item_unit_options
      WHERE id = v_dni.item_unit_option_id
        AND deleted_at IS NULL;
    ELSE
      v_qty_per_unit := 1;
    END IF;

    v_allocated_base_qty := COALESCE(v_dni.allocated_qty, 0) * COALESCE(v_qty_per_unit, 1);

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
    IF v_available < v_allocated_base_qty THEN
      RAISE EXCEPTION 'Insufficient available stock for item % in warehouse %. Available %, requested %',
        v_dni.item_id, v_dni.fulfilling_warehouse_id, v_available, v_allocated_base_qty;
    END IF;

    UPDATE item_warehouse
    SET
      reserved_stock = COALESCE(reserved_stock, 0) + v_allocated_base_qty,
      updated_by = p_user_id,
      updated_at = NOW()
    WHERE id = v_wh.id;

    v_suggested_pick_location_id := NULL;
    v_suggested_pick_batch_code := NULL;
    v_suggested_pick_batch_received_at := NULL;
    v_suggested_batch_location_sku := NULL;

    SELECT
      ilb.location_id,
      ib.batch_code,
      ib.received_at,
      ilb.batch_location_sku
    INTO
      v_suggested_pick_location_id,
      v_suggested_pick_batch_code,
      v_suggested_pick_batch_received_at,
      v_suggested_batch_location_sku
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
      suggested_batch_location_sku = COALESCE(v_suggested_batch_location_sku, suggested_batch_location_sku),
      updated_at = NOW()
    WHERE id = v_dni.id
      AND company_id = p_company_id;
  END LOOP;
END;
$$;

COMMIT;
