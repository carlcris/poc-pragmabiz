
CREATE OR REPLACE FUNCTION public.complete_pick_list_transaction(
  p_company_id UUID,
  p_user_id UUID,
  p_pick_list_id UUID,
  p_pick_rows JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pick_list pick_lists%ROWTYPE;
  v_dn delivery_notes%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_row JSONB;
  v_delivery_note_item_id UUID;
  v_batch_location_sku TEXT;
  v_picked_location_id UUID;
  v_picked_batch_code TEXT;
  v_picked_batch_received_at TIMESTAMPTZ;
  v_pick_qty NUMERIC;
  v_acknowledged BOOLEAN;
  v_mismatch_reason TEXT;
  v_dn_line delivery_note_items%ROWTYPE;
  v_pick_list_item pick_list_items%ROWTYPE;
  v_qty_per_unit NUMERIC;
  v_current_line_picked NUMERIC;
  v_next_line_picked NUMERIC;
  v_resolved_batch_location_sku TEXT;
  v_source_item_batch_id UUID;
  v_source_location_qty NUMERIC;
  v_source_batch_qty NUMERIC;
  v_existing_pick delivery_note_item_picks%ROWTYPE;
  v_picked_total NUMERIC;
  v_has_picked BOOLEAN := FALSE;
BEGIN
  IF jsonb_typeof(COALESCE(p_pick_rows, '[]'::JSONB)) <> 'array' THEN
    RAISE EXCEPTION 'pickRows must be an array';
  END IF;

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

  IF v_pick_list.status = 'done' THEN
    RETURN v_pick_list.id;
  END IF;

  IF v_pick_list.status NOT IN ('in_progress', 'paused') THEN
    RAISE EXCEPTION 'Pick list must be in progress before completing';
  END IF;

  SELECT *
  INTO v_dn
  FROM delivery_notes
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
    v_delivery_note_item_id := NULLIF(v_row->>'deliveryNoteItemId', '')::UUID;
    v_batch_location_sku := NULLIF(BTRIM(COALESCE(v_row->>'batchLocationSku', '')), '');
    v_picked_location_id := NULLIF(v_row->>'pickedLocationId', '')::UUID;
    v_picked_batch_code := NULLIF(BTRIM(COALESCE(v_row->>'pickedBatchCode', '')), '');
    v_picked_batch_received_at := NULLIF(v_row->>'pickedBatchReceivedAt', '')::TIMESTAMPTZ;
    v_pick_qty := COALESCE(NULLIF(v_row->>'pickedQty', '')::NUMERIC, 0);
    v_acknowledged := COALESCE((v_row->>'isMismatchWarningAcknowledged')::BOOLEAN, FALSE);
    v_mismatch_reason := NULLIF(BTRIM(COALESCE(v_row->>'mismatchReason', '')), '');
    v_resolved_batch_location_sku := v_batch_location_sku;

    IF v_delivery_note_item_id IS NULL THEN
      RAISE EXCEPTION 'deliveryNoteItemId is required';
    END IF;

    IF v_pick_qty <= 0 THEN
      RAISE EXCEPTION 'Picked quantity must be greater than zero';
    END IF;

    SELECT *
    INTO v_pick_list_item
    FROM pick_list_items
    WHERE company_id = p_company_id
      AND pick_list_id = p_pick_list_id
      AND dn_item_id = v_delivery_note_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid delivery note item for this pick list';
    END IF;

    SELECT *
    INTO v_dn_line
    FROM delivery_note_items
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
    FROM item_unit_options iuo
    WHERE iuo.id = v_dn_line.item_unit_option_id
      AND iuo.company_id = p_company_id;
    v_qty_per_unit := GREATEST(COALESCE(v_qty_per_unit, 1), 1);

    SELECT COALESCE(SUM(picked_qty), 0)
    INTO v_current_line_picked
    FROM delivery_note_item_picks
    WHERE company_id = p_company_id
      AND pick_list_id = p_pick_list_id
      AND delivery_note_item_id = v_delivery_note_item_id
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
      FROM item_location_batch ilb
      JOIN item_batch ib ON ib.id = ilb.item_batch_id
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
    FROM item_batch ib
    JOIN item_location_batch ilb ON ilb.item_batch_id = ib.id
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

    SELECT *
    INTO v_existing_pick
    FROM delivery_note_item_picks
    WHERE company_id = p_company_id
      AND pick_list_id = p_pick_list_id
      AND delivery_note_item_id = v_delivery_note_item_id
      AND picked_location_id = v_picked_location_id
      AND picked_batch_code = v_picked_batch_code
      AND picked_batch_received_at = v_picked_batch_received_at
      AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND THEN
      UPDATE delivery_note_item_picks
      SET picked_qty = v_existing_pick.picked_qty + v_pick_qty,
          picker_user_id = p_user_id,
          picked_at = v_now,
          is_mismatch_warning_acknowledged = v_acknowledged,
          mismatch_reason = v_mismatch_reason,
          updated_at = v_now,
          updated_by = p_user_id
      WHERE id = v_existing_pick.id;
    ELSE
      INSERT INTO delivery_note_item_picks (
        company_id,
        dn_id,
        delivery_note_item_id,
        pick_list_id,
        item_id,
        source_warehouse_id,
        picked_location_id,
        picked_batch_code,
        picked_batch_received_at,
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
        p_pick_list_id,
        v_dn_line.item_id,
        v_dn_line.fulfilling_warehouse_id,
        v_picked_location_id,
        v_picked_batch_code,
        v_picked_batch_received_at,
        v_pick_qty,
        0,
        p_user_id,
        v_now,
        v_acknowledged,
        v_mismatch_reason,
        p_user_id,
        p_user_id
      );
    END IF;

    UPDATE delivery_note_items
    SET suggested_pick_location_id = v_picked_location_id,
        suggested_pick_batch_code = v_picked_batch_code,
        suggested_pick_batch_received_at = v_picked_batch_received_at,
        suggested_batch_location_sku = v_resolved_batch_location_sku,
        has_pick_source_override =
          COALESCE(suggested_pick_location_id <> v_picked_location_id, FALSE)
          OR COALESCE(suggested_pick_batch_code <> v_picked_batch_code, FALSE)
          OR COALESCE(suggested_batch_location_sku <> v_resolved_batch_location_sku, FALSE),
        last_pick_source_override_at = CASE
          WHEN COALESCE(suggested_pick_location_id <> v_picked_location_id, FALSE)
            OR COALESCE(suggested_pick_batch_code <> v_picked_batch_code, FALSE)
            OR COALESCE(suggested_batch_location_sku <> v_resolved_batch_location_sku, FALSE)
          THEN v_now
          ELSE last_pick_source_override_at
        END,
        last_pick_source_override_by = CASE
          WHEN COALESCE(suggested_pick_location_id <> v_picked_location_id, FALSE)
            OR COALESCE(suggested_pick_batch_code <> v_picked_batch_code, FALSE)
            OR COALESCE(suggested_batch_location_sku <> v_resolved_batch_location_sku, FALSE)
          THEN p_user_id
          ELSE last_pick_source_override_by
        END,
        updated_at = v_now
    WHERE id = v_delivery_note_item_id
      AND company_id = p_company_id;
  END LOOP;

  FOR v_pick_list_item IN
    SELECT *
    FROM pick_list_items
    WHERE company_id = p_company_id
      AND pick_list_id = p_pick_list_id
    FOR UPDATE
  LOOP
    SELECT COALESCE(SUM(picked_qty), 0)
    INTO v_picked_total
    FROM delivery_note_item_picks
    WHERE company_id = p_company_id
      AND pick_list_id = p_pick_list_id
      AND delivery_note_item_id = v_pick_list_item.dn_item_id
      AND deleted_at IS NULL;

    v_picked_total := LEAST(v_pick_list_item.allocated_qty, COALESCE(v_picked_total, 0));
    IF v_picked_total > 0 THEN
      v_has_picked := TRUE;
    END IF;

    UPDATE pick_list_items
    SET picked_qty = v_picked_total,
        short_qty = GREATEST(0, v_pick_list_item.allocated_qty - v_picked_total),
        updated_at = v_now
    WHERE id = v_pick_list_item.id;

    UPDATE delivery_note_items
    SET picked_qty = v_picked_total,
        short_qty = GREATEST(0, v_pick_list_item.allocated_qty - v_picked_total),
        updated_at = v_now
    WHERE id = v_pick_list_item.dn_item_id
      AND company_id = p_company_id;
  END LOOP;

  IF NOT v_has_picked THEN
    RAISE EXCEPTION 'At least one pick list item must have picked quantity before completing';
  END IF;

  UPDATE pick_lists
  SET status = 'done',
      completed_at = v_now,
      updated_at = v_now,
      updated_by = p_user_id
  WHERE id = p_pick_list_id
    AND company_id = p_company_id;

  UPDATE delivery_notes
  SET status = 'dispatch_ready',
      picking_completed_at = v_now,
      picking_completed_by = p_user_id,
      updated_at = v_now,
      updated_by = p_user_id
  WHERE id = v_pick_list.dn_id
    AND company_id = p_company_id;

  RETURN p_pick_list_id;
END;
$$;

COMMENT ON FUNCTION public.complete_pick_list_transaction(UUID, UUID, UUID, JSONB) IS
  'Atomically applies final pick rows, reconciles pick quantities, and marks the pick list and linked delivery note complete.';
