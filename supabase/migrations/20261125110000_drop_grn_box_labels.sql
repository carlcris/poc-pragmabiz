-- Box labels and final placement are owned by the shared Putaway Station.
-- Receiving retains its independent carton-count field, grn_items.num_boxes.

CREATE OR REPLACE FUNCTION public.mark_load_list_arrived(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_load_list_id UUID,
  p_actual_arrival_date DATE DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_load_list_number TEXT;
  v_load_list_status TEXT;
  v_destination_business_unit_id UUID;
  v_container_number TEXT;
  v_seal_number TEXT;
  v_batch_number TEXT;
  v_estimated_arrival_date DATE;
  v_actual_arrival_date DATE;
  v_grn_id UUID;
  v_grn_number TEXT;
BEGIN
  IF v_auth_user_id IS NULL OR v_auth_user_id <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT users.company_id
  INTO v_user_company_id
  FROM public.users
  WHERE users.id = v_auth_user_id
    AND users.deleted_at IS NULL
    AND users.is_active IS TRUE;

  IF v_user_company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT
    load_lists.ll_number,
    load_lists.status,
    load_lists.destination_business_unit_id,
    load_lists.container_number,
    load_lists.seal_number,
    load_lists.batch_number,
    load_lists.estimated_arrival_date,
    load_lists.actual_arrival_date
  INTO
    v_load_list_number,
    v_load_list_status,
    v_destination_business_unit_id,
    v_container_number,
    v_seal_number,
    v_batch_number,
    v_estimated_arrival_date,
    v_actual_arrival_date
  FROM public.load_lists
  WHERE load_lists.id = p_load_list_id
    AND load_lists.company_id = p_company_id
    AND (
      load_lists.business_unit_id = p_business_unit_id
      OR load_lists.destination_business_unit_id = p_business_unit_id
    )
    AND load_lists.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Load list not found';
  END IF;

  IF p_business_unit_id <> v_destination_business_unit_id THEN
    RAISE EXCEPTION 'Only the destination business unit can mark the load list arrived';
  END IF;

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'load_lists',
    'view',
    p_business_unit_id
  ) OR NOT public.user_has_permission(
    v_auth_user_id,
    'load_lists.operation.mark_arrived.edit',
    'edit',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_load_list_status <> 'in_transit' THEN
    RAISE EXCEPTION 'Only in-transit load lists can be marked arrived';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.load_list_items
    WHERE load_list_items.load_list_id = p_load_list_id
  ) THEN
    RAISE EXCEPTION 'Load list has no items';
  END IF;

  SELECT grns.id, grns.grn_number
  INTO v_grn_id, v_grn_number
  FROM public.grns
  WHERE grns.load_list_id = p_load_list_id
    AND grns.company_id = p_company_id
    AND grns.deleted_at IS NULL
  FOR UPDATE;

  v_actual_arrival_date := COALESCE(
    p_actual_arrival_date,
    v_actual_arrival_date,
    CURRENT_DATE
  );

  UPDATE public.load_lists
  SET
    status = 'arrived',
    actual_arrival_date = v_actual_arrival_date,
    updated_by = p_user_id,
    updated_at = NOW()
  WHERE load_lists.id = p_load_list_id;

  IF v_grn_id IS NULL THEN
    INSERT INTO public.grns (
      load_list_id,
      company_id,
      business_unit_id,
      warehouse_id,
      container_number,
      seal_number,
      batch_number,
      receiving_date,
      delivery_date,
      status,
      notes,
      received_by,
      created_by,
      updated_by
    )
    VALUES (
      p_load_list_id,
      p_company_id,
      v_destination_business_unit_id,
      NULL,
      v_container_number,
      v_seal_number,
      v_batch_number,
      CURRENT_DATE,
      COALESCE(v_actual_arrival_date, v_estimated_arrival_date, CURRENT_DATE),
      'draft',
      'Auto-created from Load List ' || v_load_list_number,
      NULL,
      p_user_id,
      p_user_id
    )
    RETURNING grns.id, grns.grn_number
    INTO v_grn_id, v_grn_number;

    INSERT INTO public.grn_items (
      grn_id,
      load_list_item_id,
      item_id,
      item_unit_option_id,
      unit_name,
      qty_per_unit,
      load_list_qty,
      received_qty,
      damaged_qty,
      num_boxes
    )
    SELECT
      v_grn_id,
      load_list_items.id,
      load_list_items.item_id,
      load_list_items.item_unit_option_id,
      load_list_items.unit_name,
      load_list_items.qty_per_unit,
      load_list_items.load_list_qty,
      0,
      0,
      0
    FROM public.load_list_items
    WHERE load_list_items.load_list_id = p_load_list_id;
  END IF;

  RETURN v_grn_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_load_list_arrival(
  p_company_id UUID,
  p_load_list_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_load_list RECORD;
  v_grn RECORD;
  v_activity_count INTEGER := 0;
BEGIN
  SELECT id, status
  INTO v_load_list
  FROM public.load_lists
  WHERE id = p_load_list_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Load list not found';
  END IF;

  IF v_load_list.status <> 'arrived' THEN
    RAISE EXCEPTION 'Only arrived load lists can be reversed to in transit';
  END IF;

  SELECT id, status
  INTO v_grn
  FROM public.grns
  WHERE load_list_id = p_load_list_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    IF v_grn.status <> 'draft' THEN
      RAISE EXCEPTION 'Cannot reverse arrival after receiving has started';
    END IF;

    SELECT COUNT(*)
    INTO v_activity_count
    FROM public.grn_items
    WHERE grn_id = v_grn.id
      AND (
        COALESCE(received_qty, 0) > 0
        OR COALESCE(damaged_qty, 0) > 0
        OR COALESCE(num_boxes, 0) > 0
      );

    IF v_activity_count > 0 THEN
      RAISE EXCEPTION 'Cannot reverse arrival after GRN receiving activity exists';
    END IF;

    -- Hard delete is intentional here: grns.load_list_id has a non-partial
    -- unique constraint, so a soft-deleted auto-GRN would block re-arrival.
    DELETE FROM public.grns
    WHERE id = v_grn.id
      AND company_id = p_company_id;
  END IF;

  UPDATE public.load_lists
  SET status = 'in_transit',
      actual_arrival_date = NULL,
      updated_by = p_user_id,
      updated_at = now()
  WHERE id = p_load_list_id
    AND company_id = p_company_id
    AND deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverse_load_list_arrival(UUID, UUID, UUID) TO authenticated;

DROP FUNCTION public.regenerate_grn_boxes(UUID, UUID, UUID, UUID, INTEGER);
DROP TABLE public.grn_boxes;
ALTER TABLE public.grn_items DROP COLUMN barcodes_printed;

DELETE FROM public.permissions
WHERE resource IN (
  'purchasing_dashboard.widget.box_assignment_queue.view',
  'purchasing_dashboard.widget.location_assignment.view'
);
