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
BEGIN
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

  IF v_grn.status NOT IN ('draft', 'receiving') THEN
    RAISE EXCEPTION 'Only draft or receiving GRNs can be submitted';
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
  WHERE id = v_grn.id;

  RETURN v_tx_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_grn_with_batch_inventory(
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
  v_grn public.grns%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
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
    RAISE EXCEPTION 'Only GRNs in pending approval can be approved';
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

  RETURN NULL;
END;
$$;

COMMENT ON COLUMN public.putaway_tasks.suggested_location_id IS
  'Optional source-provided destination hint. Final placement is still selected during putaway posting.';

COMMENT ON FUNCTION public.submit_grn_to_putaway(UUID, UUID, UUID, TEXT) IS
  'Stages received GRN quantities into putaway tasks at submit-for-approval time without writing final batch-location inventory.';

COMMIT;
