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
  JOIN public.warehouses w
    ON w.id = ll.warehouse_id
   AND w.company_id = p_company_id
   AND w.is_active IS TRUE
   AND w.deleted_at IS NULL
  WHERE ll.id = p_load_list_id
    AND ll.company_id = p_company_id
    AND (
      ll.business_unit_id = p_business_unit_id
      OR w.business_unit_id = p_business_unit_id
    )
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
      unit_name,
      qty_per_unit,
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
      lli.unit_name,
      lli.qty_per_unit,
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

CREATE OR REPLACE FUNCTION public.submit_grn_to_putaway(
  p_company_id UUID,
  p_user_id UUID,
  p_grn_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_grn public.grns%ROWTYPE;
  v_grn_item public.grn_items%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_posting_date DATE;
  v_posting_time TIME;
  v_tx_id UUID;
  v_tx_code TEXT;
  v_item_uom_id UUID;
  v_unit_cost NUMERIC;
  v_qty_per_unit NUMERIC;
  v_received_qty NUMERIC;
  v_received_base_qty NUMERIC;
  v_expected_base_qty NUMERIC;
  v_current_stock NUMERIC;
  v_next_stock NUMERIC;
  v_batch_code TEXT;
  v_suggested_location_id UUID;
  v_has_items BOOLEAN := FALSE;
  v_has_received BOOLEAN := FALSE;
  v_existing_tx_code TEXT;
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

  SELECT *
  INTO v_grn
  FROM public.grns
  WHERE id = p_grn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN not found';
  END IF;

  IF v_grn.status NOT IN ('draft', 'receiving', 'pending_approval') THEN
    RAISE EXCEPTION 'Only draft, receiving, or pending confirmation GRNs can be staged';
  END IF;

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes',
    'view',
    v_grn.business_unit_id
  ) OR NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes.operation.submit_receiving.edit',
    'edit',
    v_grn.business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT st.transaction_code
  INTO v_existing_tx_code
  FROM public.stock_transactions st
  WHERE st.company_id = p_company_id
    AND st.reference_type = 'grn'
    AND st.reference_id = v_grn.id
    AND st.deleted_at IS NULL
  ORDER BY st.created_at ASC
  LIMIT 1;

  IF v_existing_tx_code IS NOT NULL THEN
    RETURN v_existing_tx_code;
  END IF;

  v_batch_code := COALESCE(
    NULLIF(BTRIM(v_grn.batch_number), ''),
    'GRN-' || v_grn.grn_number
  );

  v_posting_date := COALESCE(v_grn.receiving_date, CURRENT_DATE);
  v_posting_time := v_now::TIME;

  INSERT INTO public.stock_transactions (
    company_id,
    business_unit_id,
    transaction_type,
    transaction_date,
    warehouse_id,
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
    v_grn.business_unit_id,
    'in',
    v_posting_date,
    v_grn.warehouse_id,
    'grn',
    v_grn.id,
    v_grn.grn_number,
    'posted',
    COALESCE(NULLIF(BTRIM(p_notes), ''), 'GRN received pending putaway - ' || v_grn.grn_number),
    p_user_id,
    p_user_id
  )
  RETURNING id, transaction_code INTO v_tx_id, v_tx_code;

  FOR v_grn_item IN
    SELECT gi.*
    FROM public.grn_items gi
    WHERE gi.grn_id = v_grn.id
    ORDER BY gi.created_at ASC, gi.id ASC
    FOR UPDATE
  LOOP
    v_has_items := TRUE;
    v_received_qty := COALESCE(v_grn_item.received_qty, 0);

    IF v_received_qty <= 0 THEN
      CONTINUE;
    END IF;

    v_has_received := TRUE;

    v_qty_per_unit := v_grn_item.qty_per_unit;
    v_received_base_qty := v_received_qty * v_qty_per_unit;
    v_expected_base_qty := COALESCE(v_grn_item.load_list_qty, 0) * v_qty_per_unit;

    SELECT
      i.uom_id,
      COALESCE(NULLIF(lli.unit_price, 0), NULLIF(i.purchase_price, 0), 0)
    INTO v_item_uom_id, v_unit_cost
    FROM public.items i
    LEFT JOIN public.load_list_items lli
      ON lli.id = v_grn_item.load_list_item_id
    WHERE i.id = v_grn_item.item_id;

    IF v_item_uom_id IS NULL THEN
      RAISE EXCEPTION 'Item UOM not found for item %', v_grn_item.item_id;
    END IF;

    SELECT COALESCE(iw.current_stock, 0)
    INTO v_current_stock
    FROM public.item_warehouse iw
    WHERE iw.company_id = p_company_id
      AND iw.item_id = v_grn_item.item_id
      AND iw.warehouse_id = v_grn.warehouse_id
      AND iw.deleted_at IS NULL
    FOR UPDATE;

    v_current_stock := COALESCE(v_current_stock, 0);
    v_next_stock := v_current_stock + v_received_base_qty;

    SELECT gb.warehouse_location_id
    INTO v_suggested_location_id
    FROM public.grn_boxes gb
    JOIN public.warehouse_locations wl
      ON wl.id = gb.warehouse_location_id
     AND wl.company_id = p_company_id
     AND wl.warehouse_id = v_grn.warehouse_id
     AND wl.is_active IS TRUE
     AND wl.is_storable IS TRUE
     AND wl.deleted_at IS NULL
    WHERE gb.grn_item_id = v_grn_item.id
      AND gb.warehouse_location_id IS NOT NULL
    GROUP BY gb.warehouse_location_id
    ORDER BY SUM(COALESCE(gb.qty_per_box, 0)) DESC, gb.warehouse_location_id
    LIMIT 1;

    PERFORM public.create_putaway_task(
      p_company_id,
      v_grn.business_unit_id,
      v_grn.warehouse_id,
      v_grn_item.item_id,
      v_item_uom_id,
      'grn',
      v_grn.id,
      v_grn_item.id,
      v_grn.grn_number,
      v_received_base_qty,
      COALESCE(v_unit_cost, 0),
      p_user_id,
      v_suggested_location_id,
      v_expected_base_qty,
      v_batch_code,
      'GRN received pending putaway - ' || v_grn.grn_number
    );

    INSERT INTO public.stock_transaction_items (
      company_id,
      transaction_id,
      item_id,
      quantity,
      uom_id,
      batch_no,
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
      v_grn_item.item_id,
      v_received_base_qty,
      v_item_uom_id,
      v_batch_code,
      COALESCE(v_unit_cost, 0),
      ABS(v_received_base_qty) * COALESCE(v_unit_cost, 0),
      v_current_stock,
      v_next_stock,
      COALESCE(v_unit_cost, 0),
      v_current_stock * COALESCE(v_unit_cost, 0),
      v_next_stock * COALESCE(v_unit_cost, 0),
      v_posting_date,
      v_posting_time,
      'GRN received pending putaway - ' || v_grn.grn_number,
      p_user_id,
      p_user_id
    );
  END LOOP;

  IF NOT v_has_items THEN
    RAISE EXCEPTION 'GRN has no items';
  END IF;

  IF NOT v_has_received THEN
    RAISE EXCEPTION 'At least one GRN item must have a received quantity';
  END IF;

  UPDATE public.grns
  SET status = 'pending_approval',
      received_by = COALESCE(received_by, p_user_id),
      updated_by = p_user_id,
      updated_at = v_now
  WHERE id = v_grn.id
    AND status <> 'pending_approval';

  RETURN v_tx_code;
END;
$$;

COMMENT ON FUNCTION public.submit_grn_to_putaway(UUID, UUID, UUID, TEXT) IS
  'Atomically stages a GRN into putaway after enforcing Goods Receipt Notes view access and the granular submit-receiving capability.';

CREATE OR REPLACE FUNCTION public.create_putaway_task(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_warehouse_id UUID,
  p_item_id UUID,
  p_uom_id UUID,
  p_source_type TEXT,
  p_source_id UUID,
  p_source_line_id UUID,
  p_source_reference TEXT,
  p_quantity NUMERIC,
  p_unit_cost NUMERIC,
  p_user_id UUID,
  p_suggested_location_id UUID,
  p_in_transit_decrease NUMERIC,
  p_source_batch_code TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_task_id UUID;
  v_source_unit_name TEXT;
  v_source_qty_per_unit NUMERIC;
BEGIN
  IF p_source_line_id IS NULL THEN
    RAISE EXCEPTION 'Putaway source line is required';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Putaway quantity must be greater than zero';
  END IF;

  IF p_source_type = 'grn' THEN
    SELECT gi.unit_name, gi.qty_per_unit
    INTO v_source_unit_name, v_source_qty_per_unit
    FROM public.grn_items gi
    JOIN public.grns g
      ON g.id = gi.grn_id
     AND g.company_id = p_company_id
     AND g.deleted_at IS NULL
    WHERE gi.id = p_source_line_id
      AND gi.grn_id = p_source_id
      AND gi.item_id = p_item_id;
  ELSE
    SELECT COALESCE(NULLIF(BTRIM(uom.name), ''), uom.code::TEXT)
    INTO v_source_unit_name
    FROM public.units_of_measure uom
    WHERE uom.id = p_uom_id
      AND uom.company_id = p_company_id
      AND uom.is_active IS TRUE
      AND uom.deleted_at IS NULL;

    v_source_qty_per_unit := 1;
  END IF;

  IF NULLIF(BTRIM(COALESCE(v_source_unit_name, '')), '') IS NULL
     OR COALESCE(v_source_qty_per_unit, 0) <= 0 THEN
    RAISE EXCEPTION 'Putaway source unit snapshot is required';
  END IF;

  IF p_suggested_location_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.warehouse_locations wl
       WHERE wl.id = p_suggested_location_id
         AND wl.company_id = p_company_id
         AND wl.warehouse_id = p_warehouse_id
         AND wl.is_active IS TRUE
         AND wl.is_storable IS TRUE
         AND wl.deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'Suggested putaway location is not valid';
  END IF;

  INSERT INTO public.item_warehouse (
    company_id,
    item_id,
    warehouse_id,
    current_stock,
    reserved_stock,
    in_transit,
    putaway_qty,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    p_item_id,
    p_warehouse_id,
    p_quantity,
    0,
    0,
    p_quantity,
    p_user_id,
    p_user_id
  )
  ON CONFLICT (company_id, item_id, warehouse_id)
  DO UPDATE SET
    current_stock = COALESCE(public.item_warehouse.current_stock, 0) + EXCLUDED.current_stock,
    in_transit = GREATEST(
      0,
      COALESCE(public.item_warehouse.in_transit, 0) - COALESCE(p_in_transit_decrease, 0)
    ),
    estimated_arrival_date = CASE
      WHEN GREATEST(
        0,
        COALESCE(public.item_warehouse.in_transit, 0) - COALESCE(p_in_transit_decrease, 0)
      ) > 0 THEN public.item_warehouse.estimated_arrival_date
      ELSE NULL
    END,
    putaway_qty = COALESCE(public.item_warehouse.putaway_qty, 0) + EXCLUDED.putaway_qty,
    deleted_at = NULL,
    updated_by = p_user_id,
    updated_at = NOW();

  INSERT INTO public.putaway_tasks (
    company_id,
    business_unit_id,
    warehouse_id,
    item_id,
    uom_id,
    source_unit_name,
    source_qty_per_unit,
    source_type,
    source_id,
    source_line_id,
    source_reference,
    source_batch_code,
    suggested_location_id,
    quantity,
    pending_quantity,
    unit_cost,
    status,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    p_business_unit_id,
    p_warehouse_id,
    p_item_id,
    p_uom_id,
    v_source_unit_name,
    v_source_qty_per_unit,
    p_source_type,
    p_source_id,
    p_source_line_id,
    p_source_reference,
    NULLIF(BTRIM(COALESCE(p_source_batch_code, '')), ''),
    p_suggested_location_id,
    p_quantity,
    p_quantity,
    COALESCE(p_unit_cost, 0),
    'pending',
    p_notes,
    p_user_id,
    p_user_id
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_task_id;

  IF v_task_id IS NULL THEN
    UPDATE public.putaway_tasks
    SET quantity = public.putaway_tasks.quantity + p_quantity,
        pending_quantity = public.putaway_tasks.pending_quantity + p_quantity,
        unit_cost = COALESCE(p_unit_cost, 0),
        suggested_location_id = COALESCE(public.putaway_tasks.suggested_location_id, p_suggested_location_id),
        status = CASE
          WHEN public.putaway_tasks.posted_quantity > 0 THEN 'partial'
          ELSE 'pending'
        END,
        updated_by = p_user_id,
        updated_at = NOW()
    WHERE company_id = p_company_id
      AND source_type = p_source_type
      AND source_line_id = p_source_line_id
      AND COALESCE(source_batch_code, '') = COALESCE(NULLIF(BTRIM(COALESCE(p_source_batch_code, '')), ''), '')
      AND source_unit_name = v_source_unit_name
      AND source_qty_per_unit = v_source_qty_per_unit
      AND deleted_at IS NULL
    RETURNING id INTO v_task_id;
  END IF;

  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create putaway task';
  END IF;

  RETURN v_task_id;
END;
$$;

COMMENT ON FUNCTION public.create_putaway_task(
  UUID, UUID, UUID, UUID, UUID, TEXT, UUID, UUID, TEXT, NUMERIC, NUMERIC, UUID, UUID, NUMERIC, TEXT, TEXT
) IS
  'Creates or extends a putaway task while copying immutable source unit metadata into the task.';

CREATE OR REPLACE FUNCTION public.regenerate_grn_boxes(
  p_company_id UUID,
  p_user_id UUID,
  p_grn_id UUID,
  p_grn_item_id UUID,
  p_num_boxes INTEGER,
  p_warehouse_location_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_business_unit_id UUID;
  v_warehouse_id UUID;
  v_grn_number TEXT;
  v_delivery_date DATE;
  v_container_number TEXT;
  v_seal_number TEXT;
  v_received_qty NUMERIC;
  v_qty_per_unit NUMERIC;
  v_qty_per_box NUMERIC;
  v_batch_location_sku TEXT;
  v_created_count INTEGER;
BEGIN
  IF v_auth_user_id IS NULL OR v_auth_user_id <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_num_boxes IS NULL OR p_num_boxes < 1 OR p_num_boxes > 1000000 THEN
    RAISE EXCEPTION 'Invalid number of boxes';
  END IF;

  SELECT users.company_id
  INTO v_user_company_id
  FROM public.users users
  WHERE users.id = v_auth_user_id
    AND users.deleted_at IS NULL
    AND users.is_active IS TRUE;

  IF v_user_company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT
    grns.business_unit_id,
    grns.warehouse_id,
    grns.grn_number,
    grns.delivery_date,
    grns.container_number,
    grns.seal_number,
    grn_items.received_qty,
    grn_items.qty_per_unit
  INTO
    v_business_unit_id,
    v_warehouse_id,
    v_grn_number,
    v_delivery_date,
    v_container_number,
    v_seal_number,
    v_received_qty,
    v_qty_per_unit
  FROM public.grns grns
  JOIN public.grn_items grn_items
    ON grn_items.grn_id = grns.id
   AND grn_items.id = p_grn_item_id
  WHERE grns.id = p_grn_id
    AND grns.company_id = p_company_id
    AND grns.deleted_at IS NULL
  FOR UPDATE OF grns, grn_items;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN item not found';
  END IF;

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes',
    'create',
    v_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF COALESCE(v_received_qty, 0) <= 0 THEN
    RAISE EXCEPTION 'Cannot generate boxes with zero received quantity';
  END IF;

  IF COALESCE(v_qty_per_unit, 0) <= 0 THEN
    RAISE EXCEPTION 'GRN item unit snapshot is invalid';
  END IF;

  IF p_warehouse_location_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.warehouse_locations warehouse_locations
       WHERE warehouse_locations.id = p_warehouse_location_id
         AND warehouse_locations.company_id = p_company_id
         AND warehouse_locations.warehouse_id = v_warehouse_id
         AND warehouse_locations.is_active IS TRUE
         AND warehouse_locations.is_storable IS TRUE
         AND warehouse_locations.deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'Warehouse location is not valid for this GRN';
  END IF;

  v_qty_per_box := (v_received_qty * v_qty_per_unit) / p_num_boxes;

  IF v_qty_per_box <= 0 THEN
    RAISE EXCEPTION 'Calculated quantity per box must be greater than zero';
  END IF;

  IF p_warehouse_location_id IS NOT NULL THEN
    v_batch_location_sku := public.generate_item_batch_location_sku();
  END IF;

  DELETE FROM public.grn_boxes
  WHERE grn_item_id = p_grn_item_id;

  INSERT INTO public.grn_boxes (
    grn_item_id,
    box_number,
    barcode,
    qty_per_box,
    warehouse_location_id,
    batch_location_sku,
    delivery_date,
    container_number,
    seal_number
  )
  SELECT
    p_grn_item_id,
    generated_boxes.box_number,
    v_grn_number || '-' || LEFT(p_grn_item_id::TEXT, 8) || '-' ||
      LPAD(generated_boxes.box_number::TEXT, 3, '0'),
    v_qty_per_box,
    p_warehouse_location_id,
    v_batch_location_sku,
    v_delivery_date,
    v_container_number,
    v_seal_number
  FROM generate_series(1, p_num_boxes) AS generated_boxes(box_number);

  GET DIAGNOSTICS v_created_count = ROW_COUNT;

  UPDATE public.grn_items
  SET barcodes_printed = TRUE
  WHERE id = p_grn_item_id
    AND grn_id = p_grn_id;

  RETURN v_created_count;
END;
$$;

COMMENT ON FUNCTION public.regenerate_grn_boxes(UUID, UUID, UUID, UUID, INTEGER, UUID) IS
  'Atomically regenerates GRN boxes using the GRN line quantity-per-unit snapshot.';

REVOKE ALL ON FUNCTION public.regenerate_grn_boxes(UUID, UUID, UUID, UUID, INTEGER, UUID)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regenerate_grn_boxes(UUID, UUID, UUID, UUID, INTEGER, UUID)
  TO authenticated;

COMMIT;
