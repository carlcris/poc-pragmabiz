BEGIN;

WITH granular_permissions(
  resource,
  parent_resource,
  surface,
  capability_key,
  capability_action,
  label,
  permission_group,
  description
) AS (
  VALUES
      (
        'load_lists.operation.link_stock_requisitions.edit',
        'load_lists',
        'operation',
        'link_stock_requisitions',
        'edit',
        'Link Stock Requisitions',
        'Load List Operations',
        'Allows adding and removing stock-requisition links on draft or confirmed load lists.'
      ),
      (
        'load_lists.operation.mark_in_transit.edit',
        'load_lists',
        'operation',
        'mark_in_transit',
        'edit',
        'Mark Load List In Transit',
        'Load List Operations',
        'Allows moving a confirmed load list into transit and updating in-transit inventory.'
      )
)
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
SELECT
  resource,
  parent_resource,
  surface,
  capability_key,
  capability_action,
  label,
  permission_group,
  description,
  TRUE,
  FALSE,
  FALSE,
  TRUE,
  FALSE
FROM granular_permissions
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

-- Preserve access for non-warehouse roles that already had broad load-list edit
-- access. Picker and Stockman remain opt-in for these operations.
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
  operation_permission.id,
  FALSE,
  FALSE,
  TRUE,
  FALSE
FROM public.roles r
CROSS JOIN public.permissions operation_permission
WHERE r.deleted_at IS NULL
  AND operation_permission.resource IN (
    'load_lists.operation.link_stock_requisitions.edit',
    'load_lists.operation.mark_in_transit.edit'
  )
  AND LOWER(BTRIM(r.name)) NOT IN ('picker', 'stockman')
  AND (
    LOWER(BTRIM(r.name)) IN ('super admin', 'admin')
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

CREATE OR REPLACE FUNCTION public.link_load_list_stock_requisitions(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_load_list_id UUID,
  p_links JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_load_list_status TEXT;
  v_links_created INTEGER;
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

  SELECT ll.status
  INTO v_load_list_status
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
    'load_lists.operation.link_stock_requisitions.edit',
    'edit',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_load_list_status NOT IN ('draft', 'confirmed') THEN
    RAISE EXCEPTION 'Only draft or confirmed load lists can be modified';
  END IF;

  IF p_links IS NULL
     OR JSONB_TYPEOF(p_links) <> 'array'
     OR JSONB_ARRAY_LENGTH(p_links) = 0
     OR JSONB_ARRAY_LENGTH(p_links) > 100 THEN
    RAISE EXCEPTION 'Invalid stock requisition links';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM JSONB_TO_RECORDSET(p_links) AS requested(
      load_list_item_id UUID,
      sr_item_id UUID,
      fulfilled_qty NUMERIC
    )
    WHERE requested.load_list_item_id IS NULL
      OR requested.sr_item_id IS NULL
      OR requested.fulfilled_qty IS NULL
      OR requested.fulfilled_qty <= 0
      OR requested.fulfilled_qty <> ROUND(requested.fulfilled_qty, 4)
  ) THEN
    RAISE EXCEPTION 'Invalid stock requisition links';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM JSONB_TO_RECORDSET(p_links) AS requested(
      load_list_item_id UUID,
      sr_item_id UUID,
      fulfilled_qty NUMERIC
    )
    GROUP BY requested.load_list_item_id, requested.sr_item_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate stock requisition links are not allowed';
  END IF;

  PERFORM lli.id
  FROM public.load_list_items lli
  WHERE lli.id IN (
    SELECT DISTINCT requested.load_list_item_id
    FROM JSONB_TO_RECORDSET(p_links) AS requested(
      load_list_item_id UUID,
      sr_item_id UUID,
      fulfilled_qty NUMERIC
    )
  )
  ORDER BY lli.id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM JSONB_TO_RECORDSET(p_links) AS requested(
      load_list_item_id UUID,
      sr_item_id UUID,
      fulfilled_qty NUMERIC
    )
    LEFT JOIN public.load_list_items lli
      ON lli.id = requested.load_list_item_id
     AND lli.load_list_id = p_load_list_id
    WHERE lli.id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more load list items were not found in this load list';
  END IF;

  PERFORM sri.id
  FROM public.stock_requisition_items sri
  WHERE sri.id IN (
    SELECT DISTINCT requested.sr_item_id
    FROM JSONB_TO_RECORDSET(p_links) AS requested(
      load_list_item_id UUID,
      sr_item_id UUID,
      fulfilled_qty NUMERIC
    )
  )
  ORDER BY sri.id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM JSONB_TO_RECORDSET(p_links) AS requested(
      load_list_item_id UUID,
      sr_item_id UUID,
      fulfilled_qty NUMERIC
    )
    LEFT JOIN public.stock_requisition_items sri
      ON sri.id = requested.sr_item_id
    LEFT JOIN public.stock_requisitions sr
      ON sr.id = sri.sr_id
     AND sr.company_id = p_company_id
     AND sr.business_unit_id = p_business_unit_id
     AND sr.deleted_at IS NULL
    WHERE sri.id IS NULL OR sr.id IS NULL OR sr.status = 'cancelled'
  ) THEN
    RAISE EXCEPTION 'One or more stock requisition items are unavailable';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM JSONB_TO_RECORDSET(p_links) AS requested(
      load_list_item_id UUID,
      sr_item_id UUID,
      fulfilled_qty NUMERIC
    )
    JOIN public.load_list_items lli
      ON lli.id = requested.load_list_item_id
    JOIN public.stock_requisition_items sri
      ON sri.id = requested.sr_item_id
    WHERE lli.item_id IS DISTINCT FROM sri.item_id
  ) THEN
    RAISE EXCEPTION 'Load list and stock requisition items must reference the same item';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM JSONB_TO_RECORDSET(p_links) AS requested(
      load_list_item_id UUID,
      sr_item_id UUID,
      fulfilled_qty NUMERIC
    )
    JOIN public.load_list_sr_items existing_link
      ON existing_link.load_list_item_id = requested.load_list_item_id
     AND existing_link.sr_item_id = requested.sr_item_id
  ) THEN
    RAISE EXCEPTION 'One or more selected links already exist';
  END IF;

  IF EXISTS (
    WITH requested_totals AS (
      SELECT requested.load_list_item_id, SUM(requested.fulfilled_qty) AS fulfilled_qty
      FROM JSONB_TO_RECORDSET(p_links) AS requested(
        load_list_item_id UUID,
        sr_item_id UUID,
        fulfilled_qty NUMERIC
      )
      GROUP BY requested.load_list_item_id
    ),
    existing_totals AS (
      SELECT llsi.load_list_item_id, SUM(llsi.fulfilled_qty) AS fulfilled_qty
      FROM public.load_list_sr_items llsi
      WHERE llsi.load_list_item_id IN (SELECT load_list_item_id FROM requested_totals)
      GROUP BY llsi.load_list_item_id
    )
    SELECT 1
    FROM requested_totals requested_total
    JOIN public.load_list_items lli
      ON lli.id = requested_total.load_list_item_id
    LEFT JOIN existing_totals existing_total
      ON existing_total.load_list_item_id = requested_total.load_list_item_id
    WHERE requested_total.fulfilled_qty + COALESCE(existing_total.fulfilled_qty, 0)
      > lli.load_list_qty
  ) THEN
    RAISE EXCEPTION 'Linked quantity would exceed load list item quantity';
  END IF;

  IF EXISTS (
    WITH requested_totals AS (
      SELECT requested.sr_item_id, SUM(requested.fulfilled_qty) AS fulfilled_qty
      FROM JSONB_TO_RECORDSET(p_links) AS requested(
        load_list_item_id UUID,
        sr_item_id UUID,
        fulfilled_qty NUMERIC
      )
      GROUP BY requested.sr_item_id
    ),
    existing_totals AS (
      SELECT llsi.sr_item_id, SUM(llsi.fulfilled_qty) AS fulfilled_qty
      FROM public.load_list_sr_items llsi
      WHERE llsi.sr_item_id IN (SELECT sr_item_id FROM requested_totals)
      GROUP BY llsi.sr_item_id
    )
    SELECT 1
    FROM requested_totals requested_total
    JOIN public.stock_requisition_items sri
      ON sri.id = requested_total.sr_item_id
    LEFT JOIN existing_totals existing_total
      ON existing_total.sr_item_id = requested_total.sr_item_id
    WHERE requested_total.fulfilled_qty + COALESCE(existing_total.fulfilled_qty, 0)
      > sri.requested_qty
  ) THEN
    RAISE EXCEPTION 'Linked quantity would exceed stock requisition item quantity';
  END IF;

  INSERT INTO public.load_list_sr_items (
    load_list_item_id,
    sr_item_id,
    fulfilled_qty
  )
  SELECT
    requested.load_list_item_id,
    requested.sr_item_id,
    requested.fulfilled_qty
  FROM JSONB_TO_RECORDSET(p_links) AS requested(
    load_list_item_id UUID,
    sr_item_id UUID,
    fulfilled_qty NUMERIC
  );

  GET DIAGNOSTICS v_links_created = ROW_COUNT;

  PERFORM public.recalculate_stock_requisition_fulfillment_for_load_list(
    p_company_id,
    p_load_list_id
  );

  RETURN v_links_created;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_load_list_in_transit(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_load_list_id UUID,
  p_estimated_arrival_date DATE DEFAULT NULL,
  p_liner_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_load_list_status TEXT;
  v_warehouse_id UUID;
  v_estimated_arrival_date DATE;
  v_liner_name TEXT;
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

  SELECT ll.status, ll.warehouse_id, ll.estimated_arrival_date, ll.liner_name
  INTO v_load_list_status, v_warehouse_id, v_estimated_arrival_date, v_liner_name
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
    'load_lists.operation.mark_in_transit.edit',
    'edit',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_load_list_status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed load lists can be marked in transit';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.load_list_items lli
    WHERE lli.load_list_id = p_load_list_id
  ) THEN
    RAISE EXCEPTION 'Load list has no items';
  END IF;

  v_estimated_arrival_date := COALESCE(p_estimated_arrival_date, v_estimated_arrival_date);
  v_liner_name := COALESCE(NULLIF(BTRIM(p_liner_name), ''), v_liner_name);

  WITH load_quantities AS (
    SELECT
      lli.item_id,
      SUM(lli.load_list_qty * COALESCE(iuo.qty_per_unit, 1))::NUMERIC AS in_transit_qty
    FROM public.load_list_items lli
    LEFT JOIN public.item_unit_options iuo
      ON iuo.id = lli.item_unit_option_id
     AND iuo.item_id = lli.item_id
     AND iuo.deleted_at IS NULL
    WHERE lli.load_list_id = p_load_list_id
    GROUP BY lli.item_id
  )
  INSERT INTO public.item_warehouse (
    company_id,
    item_id,
    warehouse_id,
    in_transit,
    estimated_arrival_date,
    current_stock,
    reserved_stock,
    is_active,
    created_by,
    updated_by,
    deleted_at
  )
  SELECT
    p_company_id,
    load_quantity.item_id,
    v_warehouse_id,
    load_quantity.in_transit_qty,
    v_estimated_arrival_date,
    0,
    0,
    TRUE,
    p_user_id,
    p_user_id,
    NULL
  FROM load_quantities load_quantity
  ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE
  SET
    in_transit = COALESCE(public.item_warehouse.in_transit, 0) + EXCLUDED.in_transit,
    estimated_arrival_date = EXCLUDED.estimated_arrival_date,
    is_active = TRUE,
    updated_by = p_user_id,
    updated_at = NOW(),
    deleted_at = NULL;

  UPDATE public.load_lists
  SET
    status = 'in_transit',
    estimated_arrival_date = v_estimated_arrival_date,
    liner_name = v_liner_name,
    updated_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_load_list_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_load_list_sr_link(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_load_list_id UUID,
  p_link_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_load_list_status TEXT;
  v_link_id UUID;
  v_sr_item_id UUID;
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

  SELECT ll.status
  INTO v_load_list_status
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
    'load_lists.operation.link_stock_requisitions.edit',
    'edit',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_load_list_status NOT IN ('draft', 'confirmed') THEN
    RAISE EXCEPTION 'Only draft or confirmed load lists can be modified';
  END IF;

  SELECT llsi.id, llsi.sr_item_id
  INTO v_link_id, v_sr_item_id
  FROM public.load_list_sr_items llsi
  JOIN public.load_list_items lli
    ON lli.id = llsi.load_list_item_id
  WHERE llsi.id = p_link_id
    AND lli.load_list_id = p_load_list_id
  FOR UPDATE OF llsi;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link not found';
  END IF;

  DELETE FROM public.load_list_sr_items
  WHERE id = v_link_id;

  PERFORM public.recalculate_stock_requisition_fulfillment_for_items(
    p_company_id,
    ARRAY[v_sr_item_id]
  );
END;
$$;

COMMENT ON FUNCTION public.link_load_list_stock_requisitions(UUID, UUID, UUID, UUID, JSONB) IS
  'Atomically validates, inserts, and reconciles bounded load-list to stock-requisition links.';

COMMENT ON FUNCTION public.mark_load_list_in_transit(UUID, UUID, UUID, UUID, DATE, TEXT) IS
  'Atomically marks a confirmed load list in transit and increments target-warehouse in-transit inventory.';

COMMENT ON FUNCTION public.remove_load_list_sr_link(UUID, UUID, UUID, UUID, UUID) IS
  'Atomically removes one load-list stock-requisition link for users with the granular linking capability.';

COMMIT;
