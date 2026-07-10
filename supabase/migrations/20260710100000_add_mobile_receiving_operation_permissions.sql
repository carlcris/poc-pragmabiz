BEGIN;

WITH granular_permissions AS (
  SELECT *
  FROM (
    VALUES
      (
        'stock_requests.operation.receive_delivery_notes.edit',
        'stock_requests',
        'operation',
        'receive_delivery_notes',
        'edit',
        'Receive Delivery Notes',
        'Delivery Note Receiving Operations',
        'Allows starting, recording, reviewing, and submitting delivery note receiving.'
      ),
      (
        'goods_receipt_notes.operation.start_receiving.edit',
        'goods_receipt_notes',
        'operation',
        'start_receiving',
        'edit',
        'Start GRN Receiving',
        'GRN Receiving Operations',
        'Allows transitioning a draft GRN and its linked arrived load list into receiving.'
      ),
      (
        'goods_receipt_notes.operation.save_receiving.edit',
        'goods_receipt_notes',
        'operation',
        'save_receiving',
        'edit',
        'Save GRN Receiving',
        'GRN Receiving Operations',
        'Allows saving received and damaged quantities during GRN receiving.'
      ),
      (
        'goods_receipt_notes.operation.submit_receiving.edit',
        'goods_receipt_notes',
        'operation',
        'submit_receiving',
        'edit',
        'Submit GRN Receiving',
        'GRN Receiving Operations',
        'Allows submitting GRN receiving quantities for confirmation and putaway staging.'
      )
  ) AS gp(resource, parent_resource, surface, capability_key, capability_action, label, permission_group, description)
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
  p.id,
  FALSE,
  FALSE,
  TRUE,
  FALSE
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.deleted_at IS NULL
  AND LOWER(r.name) IN ('super admin', 'admin')
  AND p.resource IN (
    'stock_requests.operation.receive_delivery_notes.edit',
    'goods_receipt_notes.operation.start_receiving.edit',
    'goods_receipt_notes.operation.save_receiving.edit',
    'goods_receipt_notes.operation.submit_receiving.edit'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE
SET
  can_view = FALSE,
  can_create = FALSE,
  can_edit = TRUE,
  can_delete = FALSE;

CREATE OR REPLACE FUNCTION public.start_grn_receiving(
  p_company_id UUID,
  p_user_id UUID,
  p_grn_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_grn public.grns%ROWTYPE;
  v_load_list public.load_lists%ROWTYPE;
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

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes',
    'view',
    v_grn.business_unit_id
  ) OR NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes.operation.start_receiving.edit',
    'edit',
    v_grn.business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_grn.status NOT IN ('draft', 'receiving') THEN
    RAISE EXCEPTION 'Only draft GRNs can start receiving';
  END IF;

  IF v_grn.load_list_id IS NOT NULL THEN
    SELECT *
    INTO v_load_list
    FROM public.load_lists
    WHERE id = v_grn.load_list_id
      AND company_id = p_company_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Load list not found';
    END IF;

    IF v_load_list.status NOT IN ('arrived', 'receiving') THEN
      RAISE EXCEPTION 'Only arrived load lists can start receiving';
    END IF;

    IF v_load_list.status <> 'receiving' THEN
      UPDATE public.load_lists
      SET
        status = 'receiving',
        updated_by = p_user_id,
        updated_at = NOW()
      WHERE id = v_load_list.id
        AND company_id = p_company_id;
    END IF;
  END IF;

  IF v_grn.status <> 'receiving' THEN
    UPDATE public.grns
    SET
      status = 'receiving',
      received_by = COALESCE(received_by, p_user_id),
      receiving_date = COALESCE(receiving_date, CURRENT_DATE),
      updated_by = p_user_id,
      updated_at = NOW()
    WHERE id = v_grn.id
      AND company_id = p_company_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.start_grn_receiving(UUID, UUID, UUID) IS
  'Atomically starts GRN receiving after enforcing Goods Receipt Notes view access and the granular start-receiving capability.';

CREATE OR REPLACE FUNCTION public.pause_grn_receiving(
  p_company_id UUID,
  p_user_id UUID,
  p_grn_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_grn public.grns%ROWTYPE;
  v_load_list public.load_lists%ROWTYPE;
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

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes',
    'view',
    v_grn.business_unit_id
  ) OR NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes.operation.start_receiving.edit',
    'edit',
    v_grn.business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_grn.status <> 'receiving' THEN
    RAISE EXCEPTION 'Only receiving GRNs can be paused';
  END IF;

  IF v_grn.load_list_id IS NOT NULL THEN
    SELECT *
    INTO v_load_list
    FROM public.load_lists
    WHERE id = v_grn.load_list_id
      AND company_id = p_company_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND AND v_load_list.status = 'receiving' THEN
      UPDATE public.load_lists
      SET
        status = 'arrived',
        updated_by = p_user_id,
        updated_at = NOW()
      WHERE id = v_load_list.id
        AND company_id = p_company_id;
    END IF;
  END IF;

  UPDATE public.grns
  SET
    status = 'draft',
    updated_by = p_user_id,
    updated_at = NOW()
  WHERE id = v_grn.id
    AND company_id = p_company_id;
END;
$$;

COMMENT ON FUNCTION public.pause_grn_receiving(UUID, UUID, UUID) IS
  'Atomically pauses GRN receiving after enforcing Goods Receipt Notes view access and the granular start-receiving capability.';

CREATE OR REPLACE FUNCTION public.save_grn_receiving(
  p_company_id UUID,
  p_user_id UUID,
  p_grn_id UUID,
  p_patch JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_grn public.grns%ROWTYPE;
  v_items JSONB;
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

  IF p_patch IS NULL
    OR jsonb_typeof(p_patch) <> 'object'
    OR p_patch = '{}'::JSONB
    OR EXISTS (
      SELECT 1
      FROM jsonb_object_keys(p_patch) AS patch_key(key)
      WHERE patch_key.key NOT IN ('receivingDate', 'notes', 'items')
    ) THEN
    RAISE EXCEPTION 'Invalid GRN receiving payload';
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

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes',
    'view',
    v_grn.business_unit_id
  ) OR NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes.operation.save_receiving.edit',
    'edit',
    v_grn.business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_grn.status <> 'receiving' THEN
    RAISE EXCEPTION 'Only receiving GRNs can be saved';
  END IF;

  IF p_patch ? 'receivingDate'
    AND jsonb_typeof(p_patch->'receivingDate') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'Invalid GRN receiving payload';
  END IF;

  IF p_patch ? 'notes'
    AND jsonb_typeof(p_patch->'notes') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'Invalid GRN receiving payload';
  END IF;

  IF LENGTH(COALESCE(p_patch->>'notes', '')) > 2000 THEN
    RAISE EXCEPTION 'Invalid GRN receiving payload';
  END IF;

  IF p_patch ? 'items' THEN
    IF jsonb_typeof(p_patch->'items') <> 'array' THEN
      RAISE EXCEPTION 'Invalid GRN receiving payload';
    END IF;

    IF jsonb_array_length(p_patch->'items') > 500
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_patch->'items') AS item(value)
        WHERE jsonb_typeof(item.value) <> 'object'
          OR EXISTS (
            SELECT 1
            FROM jsonb_object_keys(item.value) AS item_key(key)
            WHERE item_key.key NOT IN ('id', 'receivedQty', 'damagedQty', 'numBoxes', 'notes')
          )
      ) THEN
      RAISE EXCEPTION 'Invalid GRN receiving payload';
    END IF;

    v_items := p_patch->'items';

    IF EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(v_items) AS item(
        id UUID,
        "receivedQty" NUMERIC,
        "damagedQty" NUMERIC,
        "numBoxes" NUMERIC,
        notes TEXT
      )
      WHERE item.id IS NULL
        OR item."receivedQty" IS NULL
        OR item."damagedQty" IS NULL
        OR item."numBoxes" IS NULL
        OR item."receivedQty" < 0
        OR item."damagedQty" < 0
        OR item."numBoxes" < 0
        OR item."numBoxes" <> TRUNC(item."numBoxes")
        OR item."receivedQty" > 1000000000
        OR item."damagedQty" > 1000000000
        OR item."numBoxes" > 1000000
        OR LENGTH(COALESCE(item.notes, '')) > 2000
    ) THEN
      RAISE EXCEPTION 'Invalid GRN receiving payload';
    END IF;

    IF (
      SELECT COUNT(*)
      FROM jsonb_to_recordset(v_items) AS item(id UUID)
    ) <> (
      SELECT COUNT(DISTINCT item.id)
      FROM jsonb_to_recordset(v_items) AS item(id UUID)
    ) THEN
      RAISE EXCEPTION 'Duplicate GRN item';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(v_items) AS item(id UUID)
      LEFT JOIN public.grn_items gi
        ON gi.id = item.id
       AND gi.grn_id = v_grn.id
      WHERE gi.id IS NULL
    ) THEN
      RAISE EXCEPTION 'GRN item not found';
    END IF;

    UPDATE public.grn_items gi
    SET
      received_qty = item."receivedQty",
      damaged_qty = item."damagedQty",
      num_boxes = item."numBoxes"::INTEGER,
      notes = CASE
        WHEN raw_item.value ? 'notes' THEN item.notes
        ELSE gi.notes
      END,
      updated_at = NOW()
    FROM jsonb_array_elements(v_items) AS raw_item(value)
    CROSS JOIN LATERAL jsonb_to_record(raw_item.value) AS item(
        id UUID,
        "receivedQty" NUMERIC,
        "damagedQty" NUMERIC,
        "numBoxes" NUMERIC,
        notes TEXT
      )
    WHERE gi.id = item.id
      AND gi.grn_id = v_grn.id;
  END IF;

  UPDATE public.grns
  SET
    receiving_date = CASE
      WHEN p_patch ? 'receivingDate' THEN NULLIF(p_patch->>'receivingDate', '')::DATE
      ELSE receiving_date
    END,
    notes = CASE
      WHEN p_patch ? 'notes' THEN p_patch->>'notes'
      ELSE notes
    END,
    received_by = COALESCE(received_by, p_user_id),
    updated_by = p_user_id,
    updated_at = NOW()
  WHERE id = v_grn.id
    AND company_id = p_company_id;
END;
$$;

COMMENT ON FUNCTION public.save_grn_receiving(UUID, UUID, UUID, JSONB) IS
  'Atomically saves bounded GRN receiving header and line patches after enforcing Goods Receipt Notes view access and the granular save-receiving capability.';

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

    SELECT COALESCE(iuo.qty_per_unit, 1)
    INTO v_qty_per_unit
    FROM public.item_unit_options iuo
    WHERE iuo.id = v_grn_item.item_unit_option_id;

    v_qty_per_unit := COALESCE(v_qty_per_unit, 1);
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

COMMIT;
