BEGIN;

CREATE OR REPLACE FUNCTION public.complete_pick_list_transaction(
  p_company_id UUID,
  p_user_id UUID,
  p_pick_list_id UUID,
  p_pick_rows JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pick_list public.pick_lists%ROWTYPE;
  v_dn public.delivery_notes%ROWTYPE;
  v_row JSONB;
  v_delivery_note_item_id UUID;
  v_pick_list_item_id UUID;
  v_batch_location_sku TEXT;
  v_picked_location_id UUID;
  v_picked_batch_code TEXT;
  v_picked_batch_received_at TIMESTAMPTZ;
  v_pick_qty NUMERIC;
  v_acknowledged BOOLEAN;
  v_mismatch_reason TEXT;
  v_dn_line public.delivery_note_items%ROWTYPE;
  v_pick_list_item public.pick_list_items%ROWTYPE;
  v_pick_list_item_count INTEGER;
  v_qty_per_unit NUMERIC;
  v_current_line_picked NUMERIC;
  v_next_line_picked NUMERIC;
  v_resolved_batch_location_sku TEXT;
  v_source_item_batch_id UUID;
  v_source_location_qty NUMERIC;
  v_source_batch_qty NUMERIC;
  v_existing_pick public.delivery_note_item_picks%ROWTYPE;
  v_picked_total NUMERIC;
  v_dn_picked_total NUMERIC;
  v_has_picked BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
  v_is_mismatch BOOLEAN;
BEGIN
  IF jsonb_typeof(COALESCE(p_pick_rows, '[]'::JSONB)) <> 'array' THEN
    RAISE EXCEPTION 'pickRows must be an array';
  END IF;

  SELECT *
  INTO v_pick_list
  FROM public.pick_lists
  WHERE id = p_pick_list_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pick list not found';
  END IF;

  IF v_pick_list.status = 'done' THEN
    RETURN v_pick_list.id;
  END IF;

  IF v_pick_list.status NOT IN ('in_progress', 'paused') THEN
    RAISE EXCEPTION 'Pick list must be in progress before completing';
  END IF;

  SELECT *
  INTO v_dn
  FROM public.delivery_notes
  WHERE id = v_pick_list.dn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Linked delivery note not found';
  END IF;

  IF v_dn.status IN ('dispatched', 'received', 'voided') THEN
    RAISE EXCEPTION 'Cannot complete pick list after delivery note is %', v_dn.status;
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(COALESCE(p_pick_rows, '[]'::JSONB))
  LOOP
    v_pick_list_item_id := NULLIF(v_row->>'pickListItemId', '')::UUID;
    v_delivery_note_item_id := NULLIF(v_row->>'deliveryNoteItemId', '')::UUID;
    v_batch_location_sku := NULLIF(BTRIM(COALESCE(v_row->>'batchLocationSku', '')), '');
    v_picked_location_id := NULLIF(v_row->>'pickedLocationId', '')::UUID;
    v_picked_batch_code := NULLIF(BTRIM(COALESCE(v_row->>'pickedBatchCode', '')), '');
    v_picked_batch_received_at := NULLIF(v_row->>'pickedBatchReceivedAt', '')::TIMESTAMPTZ;
    v_pick_qty := COALESCE(NULLIF(v_row->>'pickedQty', '')::NUMERIC, 0);
    v_acknowledged := COALESCE((v_row->>'isMismatchWarningAcknowledged')::BOOLEAN, FALSE);
    v_mismatch_reason := NULLIF(BTRIM(COALESCE(v_row->>'mismatchReason', '')), '');
    v_resolved_batch_location_sku := v_batch_location_sku;

    IF v_pick_qty <= 0 THEN
      RAISE EXCEPTION 'Picked quantity must be greater than zero';
    END IF;

    IF v_pick_list_item_id IS NOT NULL THEN
      SELECT *
      INTO v_pick_list_item
      FROM public.pick_list_items
      WHERE id = v_pick_list_item_id
        AND company_id = p_company_id
        AND pick_list_id = p_pick_list_id
      FOR UPDATE;
    ELSE
      IF v_delivery_note_item_id IS NULL THEN
        RAISE EXCEPTION 'pickListItemId is required';
      END IF;

      SELECT COUNT(*)
      INTO v_pick_list_item_count
      FROM public.pick_list_items
      WHERE company_id = p_company_id
        AND pick_list_id = p_pick_list_id
        AND dn_item_id = v_delivery_note_item_id;

      IF v_pick_list_item_count <> 1 THEN
        RAISE EXCEPTION 'pickListItemId is required for split pick-list lines';
      END IF;

      SELECT *
      INTO v_pick_list_item
      FROM public.pick_list_items
      WHERE company_id = p_company_id
        AND pick_list_id = p_pick_list_id
        AND dn_item_id = v_delivery_note_item_id
      FOR UPDATE;
    END IF;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid pick list item for this pick list';
    END IF;

    v_delivery_note_item_id := v_pick_list_item.dn_item_id;

    SELECT *
    INTO v_dn_line
    FROM public.delivery_note_items
    WHERE id = v_delivery_note_item_id
      AND company_id = p_company_id
      AND dn_id = v_pick_list.dn_id
      AND is_voided = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Delivery note item not found';
    END IF;

    SELECT COALESCE(iuo.qty_per_unit, 1)
    INTO v_qty_per_unit
    FROM public.item_unit_options iuo
    WHERE iuo.id = v_dn_line.item_unit_option_id
      AND iuo.company_id = p_company_id;
    v_qty_per_unit := GREATEST(COALESCE(v_qty_per_unit, 1), 1);

    SELECT COALESCE(SUM(picked_qty), 0)
    INTO v_current_line_picked
    FROM public.delivery_note_item_picks
    WHERE company_id = p_company_id
      AND pick_list_id = p_pick_list_id
      AND pick_list_item_id = v_pick_list_item.id
      AND deleted_at IS NULL;

    IF v_current_line_picked >= v_pick_list_item.allocated_qty THEN
      CONTINUE;
    END IF;

    IF v_batch_location_sku IS NOT NULL THEN
      SELECT
        ilb.location_id,
        ilb.batch_location_sku,
        ib.id,
        ib.batch_code,
        ib.received_at,
        ilb.qty_on_hand,
        ib.qty_on_hand
      INTO
        v_picked_location_id,
        v_resolved_batch_location_sku,
        v_source_item_batch_id,
        v_picked_batch_code,
        v_picked_batch_received_at,
        v_source_location_qty,
        v_source_batch_qty
      FROM public.item_batch_locations ilb
      JOIN public.item_batches ib ON ib.id = ilb.item_batch_id
      WHERE ilb.company_id = p_company_id
        AND ilb.batch_location_sku = v_batch_location_sku
        AND ilb.item_id = v_dn_line.item_id
        AND ilb.warehouse_id = v_dn_line.fulfilling_warehouse_id
        AND ilb.deleted_at IS NULL
        AND ib.deleted_at IS NULL
      LIMIT 1;

      IF v_source_item_batch_id IS NULL THEN
        RAISE EXCEPTION 'Scanned batch location SKU not found for this item';
      END IF;
    END IF;

    IF v_picked_location_id IS NULL
       OR v_picked_batch_code IS NULL
       OR v_picked_batch_received_at IS NULL THEN
      RAISE EXCEPTION 'Pick source is required before completing';
    END IF;

    SELECT
      ib.id,
      ilb.qty_on_hand,
      ib.qty_on_hand,
      COALESCE(v_resolved_batch_location_sku, ilb.batch_location_sku)
    INTO
      v_source_item_batch_id,
      v_source_location_qty,
      v_source_batch_qty,
      v_resolved_batch_location_sku
    FROM public.item_batches ib
    JOIN public.item_batch_locations ilb ON ilb.item_batch_id = ib.id
    WHERE ib.company_id = p_company_id
      AND ib.item_id = v_dn_line.item_id
      AND ib.warehouse_id = v_dn_line.fulfilling_warehouse_id
      AND ib.batch_code = v_picked_batch_code
      AND ib.received_at = v_picked_batch_received_at
      AND ib.deleted_at IS NULL
      AND ilb.company_id = p_company_id
      AND ilb.item_id = v_dn_line.item_id
      AND ilb.warehouse_id = v_dn_line.fulfilling_warehouse_id
      AND ilb.location_id = v_picked_location_id
      AND ilb.deleted_at IS NULL
    LIMIT 1;

    IF v_source_item_batch_id IS NULL THEN
      RAISE EXCEPTION 'Selected source batch was not found';
    END IF;

    v_next_line_picked := v_current_line_picked + v_pick_qty;
    IF v_next_line_picked > v_pick_list_item.allocated_qty THEN
      RAISE EXCEPTION 'Picked quantity exceeds allocated quantity for this line';
    END IF;

    IF (v_pick_qty * v_qty_per_unit) > LEAST(v_source_location_qty, v_source_batch_qty) THEN
      RAISE EXCEPTION 'Selected source batch does not have enough available quantity';
    END IF;

    v_is_mismatch :=
      COALESCE(v_pick_list_item.suggested_pick_location_id <> v_picked_location_id, FALSE)
      OR COALESCE(v_pick_list_item.suggested_pick_batch_code <> v_picked_batch_code, FALSE)
      OR COALESCE(v_pick_list_item.suggested_batch_location_sku <> v_resolved_batch_location_sku, FALSE);

    SELECT *
    INTO v_existing_pick
    FROM public.delivery_note_item_picks
    WHERE company_id = p_company_id
      AND pick_list_id = p_pick_list_id
      AND pick_list_item_id = v_pick_list_item.id
      AND picked_location_id = v_picked_location_id
      AND picked_batch_code = v_picked_batch_code
      AND picked_batch_received_at = v_picked_batch_received_at
      AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.delivery_note_item_picks
      SET picked_qty = v_existing_pick.picked_qty + v_pick_qty,
          batch_location_sku = v_resolved_batch_location_sku,
          picker_user_id = p_user_id,
          picked_at = v_now,
          is_mismatch_warning_acknowledged = CASE WHEN v_is_mismatch THEN v_acknowledged ELSE FALSE END,
          mismatch_reason = CASE WHEN v_is_mismatch THEN v_mismatch_reason ELSE NULL END,
          updated_at = v_now,
          updated_by = p_user_id
      WHERE id = v_existing_pick.id;
    ELSE
      INSERT INTO public.delivery_note_item_picks (
        company_id,
        dn_id,
        delivery_note_item_id,
        pick_list_item_id,
        pick_list_id,
        item_id,
        source_warehouse_id,
        picked_location_id,
        picked_batch_code,
        picked_batch_received_at,
        batch_location_sku,
        picked_qty,
        dispatched_qty,
        picker_user_id,
        picked_at,
        is_mismatch_warning_acknowledged,
        mismatch_reason,
        created_by,
        updated_by
      )
      VALUES (
        p_company_id,
        v_pick_list.dn_id,
        v_delivery_note_item_id,
        v_pick_list_item.id,
        p_pick_list_id,
        v_dn_line.item_id,
        v_dn_line.fulfilling_warehouse_id,
        v_picked_location_id,
        v_picked_batch_code,
        v_picked_batch_received_at,
        v_resolved_batch_location_sku,
        v_pick_qty,
        0,
        p_user_id,
        v_now,
        CASE WHEN v_is_mismatch THEN v_acknowledged ELSE FALSE END,
        CASE WHEN v_is_mismatch THEN v_mismatch_reason ELSE NULL END,
        p_user_id,
        p_user_id
      );
    END IF;
  END LOOP;

  FOR v_pick_list_item IN
    SELECT *
    FROM public.pick_list_items
    WHERE company_id = p_company_id
      AND pick_list_id = p_pick_list_id
    FOR UPDATE
  LOOP
    SELECT COALESCE(SUM(picked_qty), 0)
    INTO v_picked_total
    FROM public.delivery_note_item_picks
    WHERE company_id = p_company_id
      AND pick_list_id = p_pick_list_id
      AND pick_list_item_id = v_pick_list_item.id
      AND deleted_at IS NULL;

    v_picked_total := LEAST(v_pick_list_item.allocated_qty, COALESCE(v_picked_total, 0));
    IF v_picked_total > 0 THEN
      v_has_picked := TRUE;
    END IF;

    UPDATE public.pick_list_items
    SET picked_qty = v_picked_total,
        short_qty = GREATEST(0, v_pick_list_item.allocated_qty - v_picked_total),
        updated_at = v_now
    WHERE id = v_pick_list_item.id;
  END LOOP;

  FOR v_dn_line IN
    SELECT dni.*
    FROM public.delivery_note_items dni
    WHERE dni.company_id = p_company_id
      AND dni.dn_id = v_pick_list.dn_id
      AND EXISTS (
        SELECT 1
        FROM public.pick_list_items pli
        WHERE pli.company_id = dni.company_id
          AND pli.pick_list_id = p_pick_list_id
          AND pli.dn_item_id = dni.id
      )
    FOR UPDATE
  LOOP
    SELECT COALESCE(SUM(pli.picked_qty), 0)
    INTO v_dn_picked_total
    FROM public.pick_list_items pli
    WHERE pli.company_id = p_company_id
      AND pli.pick_list_id = p_pick_list_id
      AND pli.dn_item_id = v_dn_line.id;

    v_dn_picked_total := LEAST(COALESCE(v_dn_line.allocated_qty, 0), COALESCE(v_dn_picked_total, 0));

    UPDATE public.delivery_note_items
    SET picked_qty = v_dn_picked_total,
        short_qty = GREATEST(0, COALESCE(allocated_qty, 0) - v_dn_picked_total),
        updated_at = v_now
    WHERE id = v_dn_line.id
      AND company_id = p_company_id;
  END LOOP;

  IF NOT v_has_picked THEN
    RAISE EXCEPTION 'At least one pick list item must have picked quantity before completing';
  END IF;

  UPDATE public.pick_lists
  SET status = 'done',
      completed_at = v_now,
      updated_at = v_now,
      updated_by = p_user_id
  WHERE id = p_pick_list_id
    AND company_id = p_company_id;

  UPDATE public.delivery_notes
  SET status = 'dispatch_ready',
      picking_completed_at = v_now,
      picking_completed_by = p_user_id,
      updated_at = v_now,
      updated_by = p_user_id
  WHERE id = v_pick_list.dn_id
    AND company_id = p_company_id;

  RETURN p_pick_list_id;
END;
$function$;

COMMIT;
