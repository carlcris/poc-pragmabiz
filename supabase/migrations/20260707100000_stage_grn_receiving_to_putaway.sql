BEGIN;

ALTER TABLE public.putaway_tasks
  ADD COLUMN IF NOT EXISTS suggested_location_id UUID REFERENCES public.warehouse_locations(id);

ALTER TABLE public.putaway_tasks
  DROP CONSTRAINT IF EXISTS putaway_tasks_source_unique;

DROP INDEX IF EXISTS idx_putaway_tasks_source_batch_unique;
CREATE UNIQUE INDEX idx_putaway_tasks_source_batch_unique
  ON public.putaway_tasks (
    company_id,
    source_type,
    source_line_id,
    COALESCE(source_batch_code, '')
  )
  WHERE deleted_at IS NULL;

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
BEGIN
  IF p_source_line_id IS NULL THEN
    RAISE EXCEPTION 'Putaway source line is required';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Putaway quantity must be greater than zero';
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
      AND deleted_at IS NULL
    RETURNING id INTO v_task_id;
  END IF;

  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create putaway task';
  END IF;

  RETURN v_task_id;
END;
$$;

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
  p_source_batch_code TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN public.create_putaway_task(
    p_company_id => p_company_id,
    p_business_unit_id => p_business_unit_id,
    p_warehouse_id => p_warehouse_id,
    p_item_id => p_item_id,
    p_uom_id => p_uom_id,
    p_source_type => p_source_type,
    p_source_id => p_source_id,
    p_source_line_id => p_source_line_id,
    p_source_reference => p_source_reference,
    p_quantity => p_quantity,
    p_unit_cost => p_unit_cost,
    p_user_id => p_user_id,
    p_suggested_location_id => NULL,
    p_in_transit_decrease => 0,
    p_source_batch_code => p_source_batch_code,
    p_notes => p_notes
  );
END;
$$;

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

DROP FUNCTION IF EXISTS public.approve_grn_with_batch_inventory(UUID, UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.confirm_grn_with_putaway(
  p_company_id UUID,
  p_user_id UUID,
  p_grn_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_grn public.grns%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_tx_code TEXT;
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

  IF v_grn.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only GRNs in pending confirmation can be confirmed';
  END IF;

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes',
    'edit',
    v_grn.business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT st.transaction_code
  INTO v_tx_code
  FROM public.stock_transactions st
  WHERE st.company_id = p_company_id
    AND st.reference_type = 'grn'
    AND st.reference_id = v_grn.id
    AND st.deleted_at IS NULL
  ORDER BY st.created_at ASC
  LIMIT 1;

  IF v_tx_code IS NULL THEN
    RAISE EXCEPTION 'GRN must be submitted before confirmation';
  END IF;

  UPDATE public.grns
  SET status = 'approved',
      checked_by = p_user_id,
      received_by = COALESCE(received_by, p_user_id),
      updated_by = p_user_id,
      updated_at = v_now
  WHERE id = v_grn.id;

  IF v_grn.load_list_id IS NOT NULL THEN
    PERFORM public.recalculate_stock_requisition_fulfillment_for_load_list(
      p_company_id,
      v_grn.load_list_id
    );

    UPDATE public.load_lists
    SET status = 'received',
        received_by = COALESCE(received_by, p_user_id),
        received_date = COALESCE(received_date, v_now),
        updated_by = p_user_id,
        updated_at = v_now
    WHERE id = v_grn.load_list_id
      AND company_id = p_company_id
      AND deleted_at IS NULL;
  END IF;

  RETURN v_tx_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_stock_requisition_fulfillment_for_items(
  p_company_id UUID,
  p_sr_item_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  WITH affected_sr_items AS (
    SELECT DISTINCT sri.id AS sr_item_id, sri.sr_id
    FROM public.stock_requisition_items sri
    JOIN public.stock_requisitions sr
      ON sr.id = sri.sr_id
    WHERE sri.id = ANY(COALESCE(p_sr_item_ids, ARRAY[]::UUID[]))
      AND sr.company_id = p_company_id
      AND sr.deleted_at IS NULL
  ),
  approved_load_list_actuals AS (
    SELECT
      gi.load_list_item_id,
      SUM(COALESCE(gi.received_qty, 0) + COALESCE(gi.damaged_qty, 0))::NUMERIC AS accounted_qty
    FROM public.grn_items gi
    JOIN public.grns g
      ON g.id = gi.grn_id
    WHERE gi.load_list_item_id IS NOT NULL
      AND g.company_id = p_company_id
      AND g.status = 'approved'
      AND g.deleted_at IS NULL
    GROUP BY gi.load_list_item_id
  ),
  distributed_link_fulfillment AS (
    SELECT
      llsi.sr_item_id,
      GREATEST(
        LEAST(
          COALESCE(llsi.fulfilled_qty, 0),
          COALESCE(ala.accounted_qty, 0) -
            COALESCE(
              SUM(COALESCE(llsi.fulfilled_qty, 0)) OVER (
                PARTITION BY llsi.load_list_item_id
                ORDER BY llsi.created_at, llsi.id
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            )
        ),
        0
      ) AS actual_fulfilled_qty
    FROM public.load_list_sr_items llsi
    JOIN affected_sr_items asi
      ON asi.sr_item_id = llsi.sr_item_id
    LEFT JOIN approved_load_list_actuals ala
      ON ala.load_list_item_id = llsi.load_list_item_id
  ),
  aggregated_sr_fulfillment AS (
    SELECT
      asi.sr_item_id,
      COALESCE(SUM(dlf.actual_fulfilled_qty), 0)::NUMERIC AS fulfilled_qty
    FROM affected_sr_items asi
    LEFT JOIN distributed_link_fulfillment dlf
      ON dlf.sr_item_id = asi.sr_item_id
    GROUP BY asi.sr_item_id
  )
  UPDATE public.stock_requisition_items sri
  SET fulfilled_qty = agg.fulfilled_qty
  FROM aggregated_sr_fulfillment agg
  WHERE sri.id = agg.sr_item_id;

  WITH affected_srs AS (
    SELECT DISTINCT sri.sr_id
    FROM public.stock_requisition_items sri
    JOIN public.stock_requisitions sr
      ON sr.id = sri.sr_id
    WHERE sri.id = ANY(COALESCE(p_sr_item_ids, ARRAY[]::UUID[]))
      AND sr.company_id = p_company_id
      AND sr.deleted_at IS NULL
  ),
  sr_status AS (
    SELECT
      sri.sr_id,
      BOOL_AND(COALESCE(sri.fulfilled_qty, 0) >= COALESCE(sri.requested_qty, 0)) AS all_fulfilled,
      BOOL_OR(COALESCE(sri.fulfilled_qty, 0) > 0) AS any_fulfilled
    FROM public.stock_requisition_items sri
    WHERE sri.sr_id IN (SELECT sr_id FROM affected_srs)
    GROUP BY sri.sr_id
  )
  UPDATE public.stock_requisitions sr
  SET status = CASE
    WHEN sr.status = 'draft' THEN sr.status
    WHEN ss.all_fulfilled THEN 'fulfilled'
    WHEN ss.any_fulfilled THEN 'partially_fulfilled'
    ELSE 'submitted'
  END
  FROM sr_status ss
  WHERE sr.id = ss.sr_id
    AND sr.company_id = p_company_id
    AND sr.status <> 'cancelled';
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
  v_load_list public.load_lists%ROWTYPE;
  v_link public.load_list_sr_items%ROWTYPE;
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
  INTO v_load_list
  FROM public.load_lists
  WHERE id = p_load_list_id
    AND company_id = p_company_id
    AND business_unit_id = p_business_unit_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Load list not found';
  END IF;

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'load_lists',
    'edit',
    v_load_list.business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_load_list.status NOT IN ('draft', 'confirmed') THEN
    RAISE EXCEPTION 'Only draft or confirmed load lists can be modified';
  END IF;

  SELECT llsi.*
  INTO v_link
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
  WHERE id = v_link.id;

  PERFORM public.recalculate_stock_requisition_fulfillment_for_items(
    p_company_id,
    ARRAY[v_link.sr_item_id]
  );
END;
$$;

COMMENT ON COLUMN public.putaway_tasks.suggested_location_id IS
  'Optional source-provided destination hint. Final placement is still selected during putaway posting.';

COMMENT ON FUNCTION public.submit_grn_to_putaway(UUID, UUID, UUID, TEXT) IS
  'Stages received GRN quantities into putaway tasks at submit-for-confirmation time without writing final batch-location inventory.';

COMMENT ON FUNCTION public.confirm_grn_with_putaway(UUID, UUID, UUID, TEXT) IS
  'Confirms a GRN only after received quantities have already been staged into putaway.';

COMMENT ON FUNCTION public.recalculate_stock_requisition_fulfillment_for_items(UUID, UUID[]) IS
  'Recalculates fulfillment quantity and parent status for explicit stock requisition item IDs, including items whose last load-list link was removed.';

COMMENT ON FUNCTION public.remove_load_list_sr_link(UUID, UUID, UUID, UUID, UUID) IS
  'Atomically removes one load-list to stock-requisition item link and reconciles the affected requisition item.';

COMMIT;
