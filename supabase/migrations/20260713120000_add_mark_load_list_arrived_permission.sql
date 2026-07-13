BEGIN;

INSERT INTO public.permissions (
  resource,
  parent_resource,
  surface,
  capability_key,
  capability_action,
  label,
  permission_group,
  description,
  is_granular,
  can_view,
  can_create,
  can_edit,
  can_delete
)
VALUES (
  'load_lists.operation.mark_arrived.edit',
  'load_lists',
  'operation',
  'mark_arrived',
  'edit',
  'Mark Load List Arrived',
  'Load List Operations',
  'Allows marking an in-transit load list as arrived and creating its linked GRN.',
  TRUE,
  FALSE,
  FALSE,
  TRUE,
  FALSE
)
ON CONFLICT (resource) DO UPDATE
SET
  parent_resource = EXCLUDED.parent_resource,
  surface = EXCLUDED.surface,
  capability_key = EXCLUDED.capability_key,
  capability_action = EXCLUDED.capability_action,
  label = EXCLUDED.label,
  permission_group = EXCLUDED.permission_group,
  description = EXCLUDED.description,
  is_granular = TRUE,
  can_view = FALSE,
  can_create = FALSE,
  can_edit = TRUE,
  can_delete = FALSE,
  updated_at = NOW();

INSERT INTO public.role_permissions (
  role_id,
  permission_id,
  can_view,
  can_create,
  can_edit,
  can_delete
)
SELECT
  r.id,
  arrived_permission.id,
  FALSE,
  FALSE,
  TRUE,
  FALSE
FROM public.roles r
CROSS JOIN public.permissions arrived_permission
WHERE r.deleted_at IS NULL
  AND arrived_permission.resource = 'load_lists.operation.mark_arrived.edit'
  AND LOWER(BTRIM(r.name)) <> 'picker'
  AND (
    LOWER(BTRIM(r.name)) IN ('super admin', 'admin', 'stockman')
    OR EXISTS (
      SELECT 1
      FROM public.role_permissions existing_role_permission
      JOIN public.permissions existing_permission
        ON existing_permission.id = existing_role_permission.permission_id
      WHERE existing_role_permission.role_id = r.id
        AND existing_permission.resource = 'load_lists'
        AND existing_permission.deleted_at IS NULL
        AND existing_role_permission.can_edit IS TRUE
    )
  )
ON CONFLICT (role_id, permission_id) DO UPDATE
SET
  can_view = FALSE,
  can_create = FALSE,
  can_edit = TRUE,
  can_delete = FALSE;

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
  v_warehouse_id UUID;
  v_target_business_unit_id UUID;
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

  SELECT u.company_id
  INTO v_user_company_id
  FROM public.users u
  WHERE u.id = v_auth_user_id
    AND u.deleted_at IS NULL
    AND u.is_active IS TRUE;

  IF v_user_company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT
    ll.ll_number,
    ll.status,
    ll.warehouse_id,
    ll.container_number,
    ll.seal_number,
    ll.batch_number,
    ll.estimated_arrival_date,
    ll.actual_arrival_date
  INTO
    v_load_list_number,
    v_load_list_status,
    v_warehouse_id,
    v_container_number,
    v_seal_number,
    v_batch_number,
    v_estimated_arrival_date,
    v_actual_arrival_date
  FROM public.load_lists ll
  WHERE ll.id = p_load_list_id
    AND ll.company_id = p_company_id
    AND ll.business_unit_id = p_business_unit_id
    AND ll.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Load list not found';
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
    FROM public.load_list_items lli
    WHERE lli.load_list_id = p_load_list_id
  ) THEN
    RAISE EXCEPTION 'Load list has no items';
  END IF;

  SELECT w.business_unit_id
  INTO v_target_business_unit_id
  FROM public.warehouses w
  WHERE w.id = v_warehouse_id
    AND w.company_id = p_company_id
    AND w.is_active IS TRUE
    AND w.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target warehouse not found';
  END IF;

  SELECT g.id, g.grn_number
  INTO v_grn_id, v_grn_number
  FROM public.grns g
  WHERE g.load_list_id = p_load_list_id
    AND g.company_id = p_company_id
    AND g.deleted_at IS NULL
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
  WHERE id = p_load_list_id;

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
      v_target_business_unit_id,
      v_warehouse_id,
      v_container_number,
      v_seal_number,
      v_batch_number,
      CURRENT_DATE,
      COALESCE(v_actual_arrival_date, v_estimated_arrival_date, CURRENT_DATE),
      'draft',
      'Auto-created from Load List ' || v_load_list_number,
      p_user_id,
      p_user_id,
      p_user_id
    )
    RETURNING id, grn_number
    INTO v_grn_id, v_grn_number;

    INSERT INTO public.grn_items (
      grn_id,
      load_list_item_id,
      item_id,
      item_unit_option_id,
      load_list_qty,
      received_qty,
      damaged_qty,
      num_boxes,
      barcodes_printed
    )
    SELECT
      v_grn_id,
      lli.id,
      lli.item_id,
      lli.item_unit_option_id,
      lli.load_list_qty,
      0,
      0,
      0,
      FALSE
    FROM public.load_list_items lli
    WHERE lli.load_list_id = p_load_list_id;
  END IF;

  RETURN v_grn_number;
END;
$$;

COMMENT ON FUNCTION public.mark_load_list_arrived(UUID, UUID, UUID, UUID, DATE) IS
  'Atomically marks an in-transit load list arrived and creates its target-business-unit GRN and lines.';

COMMIT;
