-- Restore transactional claim release omitted by the picking-source policy replacement.
CREATE OR REPLACE FUNCTION public.record_pick_list_item_progress(
  p_company_id UUID,
  p_user_id UUID,
  p_pick_list_id UUID,
  p_pick_list_item_id UUID,
  p_operation_id UUID,
  p_picked_qty NUMERIC,
  p_batch_location_sku TEXT DEFAULT NULL,
  p_picked_location_id UUID DEFAULT NULL,
  p_picked_batch_code TEXT DEFAULT NULL,
  p_picked_batch_received_at TIMESTAMPTZ DEFAULT NULL,
  p_mismatch_acknowledged BOOLEAN DEFAULT FALSE,
  p_mismatch_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pick_list RECORD;
  v_pick_list_item RECORD;
  v_dn_line RECORD;
  v_policy TEXT;
  v_source_warehouse_id UUID;
  v_source_business_unit_id UUID;
  v_source_location_id UUID;
  v_source_batch_location_sku TEXT;
  v_source_batch_code TEXT;
  v_source_batch_received_at TIMESTAMPTZ;
  v_source_location_pickable BOOLEAN;
  v_source_location_active BOOLEAN;
  v_source_warehouse_active BOOLEAN;
  v_qty_per_unit NUMERIC;
  v_picked_base_qty NUMERIC;
  v_actual_available_stock NUMERIC;
  v_planned_reserved_stock NUMERIC;
  v_existing_pick_id UUID;
  v_is_mismatch BOOLEAN;
  v_operation_inserted BOOLEAN := FALSE;
  v_line_picked_total NUMERIC;
  v_dn_picked_total NUMERIC;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'PICK_PROGRESS_UNAUTHORIZED';
  END IF;
  IF p_operation_id IS NULL OR p_picked_qty IS NULL OR p_picked_qty <= 0 THEN
    RAISE EXCEPTION 'PICK_PROGRESS_INVALID_QUANTITY';
  END IF;
  v_source_batch_location_sku := NULLIF(BTRIM(COALESCE(p_batch_location_sku, '')), '');
  IF v_source_batch_location_sku IS NULL THEN
    RAISE EXCEPTION 'PICK_PROGRESS_SOURCE_REQUIRED';
  END IF;

  SELECT
    pick_list.status,
    pick_list.business_unit_id,
    pick_list.dn_id
  INTO v_pick_list
  FROM public.pick_lists pick_list
  WHERE pick_list.id = p_pick_list_id
    AND pick_list.company_id = p_company_id
    AND pick_list.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'PICK_PROGRESS_NOT_FOUND'; END IF;
  IF v_pick_list.status <> 'in_progress' THEN
    RAISE EXCEPTION 'PICK_PROGRESS_NOT_ACTIVE';
  END IF;
  IF v_pick_list.business_unit_id IS DISTINCT FROM public.get_current_business_unit_id()
     OR NOT public.user_has_permission(
       p_user_id, 'pick_lists', 'edit', v_pick_list.business_unit_id
     )
     OR (
       public.user_has_permission(
         p_user_id,
         'pick_lists.operation.view_only_assigned_pick_lists.view',
         'view',
         v_pick_list.business_unit_id
       )
       AND NOT EXISTS (
         SELECT 1
         FROM public.pick_list_assignees assignee
         WHERE assignee.company_id = p_company_id
           AND assignee.pick_list_id = p_pick_list_id
           AND assignee.user_id = p_user_id
       )
     ) THEN
    RAISE EXCEPTION 'PICK_PROGRESS_UNAUTHORIZED';
  END IF;

  SELECT
    item.dn_item_id,
    item.item_id,
    item.item_unit_option_id,
    item.allocated_qty,
    item.suggested_batch_location_sku,
    item.suggested_pick_location_id,
    item.suggested_pick_batch_code,
    item.suggested_pick_batch_received_at
  INTO v_pick_list_item
  FROM public.pick_list_items item
  WHERE item.id = p_pick_list_item_id
    AND item.company_id = p_company_id
    AND item.pick_list_id = p_pick_list_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'PICK_PROGRESS_LINE_NOT_FOUND'; END IF;
  IF v_pick_list_item.suggested_batch_location_sku IS NULL
     OR v_pick_list_item.suggested_pick_location_id IS NULL
     OR v_pick_list_item.suggested_pick_batch_code IS NULL
     OR v_pick_list_item.suggested_pick_batch_received_at IS NULL THEN
    RAISE EXCEPTION 'PICK_PROGRESS_SUGGESTED_SOURCE_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pick_list_item_pick_operations operation
    WHERE operation.operation_id = p_operation_id
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.pick_list_item_pick_operations operation
      WHERE operation.operation_id = p_operation_id
        AND operation.company_id = p_company_id
        AND operation.pick_list_id = p_pick_list_id
        AND operation.pick_list_item_id = p_pick_list_item_id
        AND operation.picker_user_id = p_user_id
        AND operation.picked_qty = p_picked_qty
    ) THEN
      RAISE EXCEPTION 'PICK_PROGRESS_OPERATION_CONFLICT';
    END IF;
    RETURN p_pick_list_item_id;
  END IF;

  SELECT
    line.id,
    line.fulfilling_warehouse_id
  INTO v_dn_line
  FROM public.delivery_note_items line
  WHERE line.id = v_pick_list_item.dn_item_id
    AND line.company_id = p_company_id
    AND line.dn_id = v_pick_list.dn_id
    AND line.is_voided IS FALSE
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'PICK_PROGRESS_LINE_NOT_FOUND'; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pick_list_item_claims claim
    WHERE claim.company_id = p_company_id
      AND claim.pick_list_id = p_pick_list_id
      AND claim.pick_list_item_id = p_pick_list_item_id
      AND claim.claimed_by = p_user_id
      AND claim.released_at IS NULL
      AND claim.expires_at > NOW()
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'PICK_PROGRESS_CLAIM_REQUIRED';
  END IF;

  SELECT
    batch_location.warehouse_id,
    warehouse.business_unit_id,
    batch_location.location_id,
    batch_location.batch_location_sku,
    batch.batch_code,
    batch.received_at,
    location.is_pickable,
    location.is_active,
    warehouse.is_active
  INTO
    v_source_warehouse_id,
    v_source_business_unit_id,
    v_source_location_id,
    v_source_batch_location_sku,
    v_source_batch_code,
    v_source_batch_received_at,
    v_source_location_pickable,
    v_source_location_active,
    v_source_warehouse_active
  FROM public.item_batch_locations batch_location
  JOIN public.item_batches batch
    ON batch.id = batch_location.item_batch_id
   AND batch.company_id = batch_location.company_id
   AND batch.deleted_at IS NULL
  JOIN public.warehouses warehouse
    ON warehouse.id = batch_location.warehouse_id
   AND warehouse.company_id = batch_location.company_id
   AND warehouse.deleted_at IS NULL
  JOIN public.warehouse_locations location
    ON location.id = batch_location.location_id
   AND location.company_id = batch_location.company_id
   AND location.deleted_at IS NULL
  WHERE batch_location.company_id = p_company_id
    AND batch_location.batch_location_sku = v_source_batch_location_sku
    AND batch_location.item_id = v_pick_list_item.item_id
    AND batch_location.deleted_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'PICK_PROGRESS_SOURCE_NOT_FOUND'; END IF;
  IF NOT v_source_warehouse_active OR NOT v_source_location_active OR NOT v_source_location_pickable THEN
    RAISE EXCEPTION 'PICK_PROGRESS_SOURCE_UNAVAILABLE';
  END IF;
  IF v_source_business_unit_id IS DISTINCT FROM v_pick_list.business_unit_id THEN
    RAISE EXCEPTION 'PICK_PROGRESS_SOURCE_OUTSIDE_BUSINESS_UNIT';
  END IF;
  IF v_source_batch_code IS DISTINCT FROM v_pick_list_item.suggested_pick_batch_code
     OR v_source_batch_received_at IS DISTINCT FROM
       v_pick_list_item.suggested_pick_batch_received_at THEN
    RAISE EXCEPTION 'PICK_PROGRESS_BATCH_IDENTITY_MISMATCH';
  END IF;

  v_policy := public.get_inventory_picking_policy(p_company_id, v_pick_list.business_unit_id);
  IF v_policy IN ('batch_and_warehouse', 'batch_and_rack')
     AND v_source_warehouse_id IS DISTINCT FROM v_dn_line.fulfilling_warehouse_id THEN
    RAISE EXCEPTION 'PICK_PROGRESS_WAREHOUSE_POLICY_MISMATCH';
  END IF;
  IF v_policy = 'batch_and_rack'
     AND v_source_location_id IS DISTINCT FROM v_pick_list_item.suggested_pick_location_id THEN
    RAISE EXCEPTION 'PICK_PROGRESS_RACK_POLICY_MISMATCH';
  END IF;

  v_is_mismatch :=
    v_source_batch_location_sku IS DISTINCT FROM v_pick_list_item.suggested_batch_location_sku;
  IF v_is_mismatch AND NOT p_mismatch_acknowledged THEN
    RAISE EXCEPTION 'PICK_PROGRESS_MISMATCH_ACKNOWLEDGEMENT_REQUIRED';
  END IF;

  SELECT GREATEST(COALESCE(unit_option.qty_per_unit, 1), 1)
  INTO v_qty_per_unit
  FROM public.item_unit_options unit_option
  WHERE unit_option.id = v_pick_list_item.item_unit_option_id
    AND unit_option.company_id = p_company_id
    AND unit_option.deleted_at IS NULL;
  v_qty_per_unit := GREATEST(COALESCE(v_qty_per_unit, 1), 1);
  v_picked_base_qty := p_picked_qty * v_qty_per_unit;

  SELECT COALESCE(SUM(pick.picked_qty), 0)
  INTO v_line_picked_total
  FROM public.delivery_note_item_picks pick
  WHERE pick.company_id = p_company_id
    AND pick.pick_list_id = p_pick_list_id
    AND pick.pick_list_item_id = p_pick_list_item_id
    AND pick.deleted_at IS NULL;

  IF v_line_picked_total + p_picked_qty > v_pick_list_item.allocated_qty THEN
    RAISE EXCEPTION 'PICK_PROGRESS_INVALID_QUANTITY';
  END IF;

  IF v_source_warehouse_id IS DISTINCT FROM v_dn_line.fulfilling_warehouse_id THEN
    PERFORM stock.id
    FROM public.item_warehouse stock
    WHERE stock.company_id = p_company_id
      AND stock.item_id = v_pick_list_item.item_id
      AND stock.warehouse_id IN (v_dn_line.fulfilling_warehouse_id, v_source_warehouse_id)
      AND stock.deleted_at IS NULL
    ORDER BY stock.warehouse_id
    FOR UPDATE;

    SELECT COALESCE(stock.reserved_stock, 0)
    INTO v_planned_reserved_stock
    FROM public.item_warehouse stock
    WHERE stock.company_id = p_company_id
      AND stock.item_id = v_pick_list_item.item_id
      AND stock.warehouse_id = v_dn_line.fulfilling_warehouse_id
      AND stock.deleted_at IS NULL;

    SELECT COALESCE(stock.available_stock, 0)
    INTO v_actual_available_stock
    FROM public.item_warehouse stock
    WHERE stock.company_id = p_company_id
      AND stock.item_id = v_pick_list_item.item_id
      AND stock.warehouse_id = v_source_warehouse_id
      AND stock.deleted_at IS NULL;

    IF v_planned_reserved_stock IS NULL OR v_planned_reserved_stock < v_picked_base_qty THEN
      RAISE EXCEPTION 'PICK_PROGRESS_RESERVATION_CONFLICT';
    END IF;
    IF v_actual_available_stock IS NULL OR v_actual_available_stock < v_picked_base_qty THEN
      RAISE EXCEPTION 'PICK_PROGRESS_ALTERNATIVE_SOURCE_UNAVAILABLE';
    END IF;
  END IF;

  INSERT INTO public.pick_list_item_pick_operations (
    operation_id, company_id, pick_list_id, pick_list_item_id, picker_user_id, picked_qty
  )
  VALUES (
    p_operation_id, p_company_id, p_pick_list_id, p_pick_list_item_id, p_user_id, p_picked_qty
  )
  ON CONFLICT (operation_id) DO NOTHING
  RETURNING TRUE INTO v_operation_inserted;

  IF NOT v_operation_inserted THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.pick_list_item_pick_operations operation
      WHERE operation.operation_id = p_operation_id
        AND operation.company_id = p_company_id
        AND operation.pick_list_id = p_pick_list_id
        AND operation.pick_list_item_id = p_pick_list_item_id
        AND operation.picker_user_id = p_user_id
        AND operation.picked_qty = p_picked_qty
    ) THEN
      RAISE EXCEPTION 'PICK_PROGRESS_OPERATION_CONFLICT';
    END IF;
    RETURN p_pick_list_item_id;
  END IF;

  PERFORM public.move_pick_list_source_reservation(
    p_company_id,
    p_user_id,
    v_pick_list_item.item_id,
    v_pick_list_item.suggested_batch_location_sku,
    v_source_batch_location_sku,
    v_picked_base_qty
  );

  IF v_source_warehouse_id IS DISTINCT FROM v_dn_line.fulfilling_warehouse_id THEN
    UPDATE public.item_warehouse
    SET reserved_stock = COALESCE(reserved_stock, 0) - v_picked_base_qty,
        updated_by = p_user_id,
        updated_at = v_now
    WHERE company_id = p_company_id
      AND item_id = v_pick_list_item.item_id
      AND warehouse_id = v_dn_line.fulfilling_warehouse_id
      AND deleted_at IS NULL;

    UPDATE public.item_warehouse
    SET reserved_stock = COALESCE(reserved_stock, 0) + v_picked_base_qty,
        updated_by = p_user_id,
        updated_at = v_now
    WHERE company_id = p_company_id
      AND item_id = v_pick_list_item.item_id
      AND warehouse_id = v_source_warehouse_id
      AND deleted_at IS NULL;
  END IF;

  SELECT pick.id
  INTO v_existing_pick_id
  FROM public.delivery_note_item_picks pick
  WHERE pick.company_id = p_company_id
    AND pick.pick_list_id = p_pick_list_id
    AND pick.pick_list_item_id = p_pick_list_item_id
    AND pick.source_warehouse_id = v_source_warehouse_id
    AND pick.picked_location_id = v_source_location_id
    AND pick.picked_batch_code = v_source_batch_code
    AND pick.picked_batch_received_at = v_source_batch_received_at
    AND pick.deleted_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.delivery_note_item_picks
    SET picked_qty = picked_qty + p_picked_qty,
        batch_location_sku = v_source_batch_location_sku,
        picker_user_id = p_user_id,
        picked_at = v_now,
        is_mismatch_warning_acknowledged = v_is_mismatch,
        mismatch_reason = CASE
          WHEN v_is_mismatch THEN NULLIF(BTRIM(COALESCE(p_mismatch_reason, '')), '')
          ELSE NULL
        END,
        updated_by = p_user_id,
        updated_at = v_now
    WHERE id = v_existing_pick_id;
  ELSE
    INSERT INTO public.delivery_note_item_picks (
      company_id, dn_id, delivery_note_item_id, pick_list_item_id, pick_list_id, item_id,
      source_warehouse_id, picked_location_id, picked_batch_code, picked_batch_received_at,
      batch_location_sku, picked_qty, dispatched_qty, picker_user_id, picked_at,
      is_mismatch_warning_acknowledged, mismatch_reason, created_by, updated_by
    )
    VALUES (
      p_company_id, v_pick_list.dn_id, v_dn_line.id, p_pick_list_item_id, p_pick_list_id,
      v_pick_list_item.item_id, v_source_warehouse_id, v_source_location_id,
      v_source_batch_code, v_source_batch_received_at, v_source_batch_location_sku,
      p_picked_qty, 0, p_user_id, v_now, v_is_mismatch,
      CASE
        WHEN v_is_mismatch THEN NULLIF(BTRIM(COALESCE(p_mismatch_reason, '')), '')
        ELSE NULL
      END,
      p_user_id, p_user_id
    );
  END IF;

  SELECT COALESCE(SUM(pick.picked_qty), 0)
  INTO v_line_picked_total
  FROM public.delivery_note_item_picks pick
  WHERE pick.company_id = p_company_id
    AND pick.pick_list_id = p_pick_list_id
    AND pick.pick_list_item_id = p_pick_list_item_id
    AND pick.deleted_at IS NULL;

  UPDATE public.pick_list_items
  SET picked_qty = LEAST(allocated_qty, v_line_picked_total),
      short_qty = GREATEST(0, allocated_qty - v_line_picked_total),
      updated_at = v_now
  WHERE id = p_pick_list_item_id;

  SELECT COALESCE(SUM(item.picked_qty), 0)
  INTO v_dn_picked_total
  FROM public.pick_list_items item
  WHERE item.company_id = p_company_id
    AND item.pick_list_id = p_pick_list_id
    AND item.dn_item_id = v_dn_line.id;

  UPDATE public.delivery_note_items
  SET picked_qty = LEAST(allocated_qty, v_dn_picked_total),
      short_qty = GREATEST(0, allocated_qty - v_dn_picked_total),
      updated_at = v_now
  WHERE id = v_dn_line.id
    AND company_id = p_company_id;

  -- Release the verified line in the same transaction as its saved progress.
  -- The detail response must not retain a claim that disables mobile Finish.
  UPDATE public.pick_list_item_claims
  SET released_at = v_now,
      updated_at = v_now
  WHERE company_id = p_company_id
    AND pick_list_id = p_pick_list_id
    AND pick_list_item_id = p_pick_list_item_id
    AND claimed_by = p_user_id
    AND released_at IS NULL;

  RETURN p_pick_list_item_id;
END;
$$;
