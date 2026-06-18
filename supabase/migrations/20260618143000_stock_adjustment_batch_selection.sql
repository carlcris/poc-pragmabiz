ALTER TABLE public.stock_adjustment_items
  ADD COLUMN IF NOT EXISTS item_batch_location_id UUID
  REFERENCES public.item_batch_locations(id);

CREATE INDEX IF NOT EXISTS idx_stock_adjustment_items_item_batch_location_id
  ON public.stock_adjustment_items(item_batch_location_id)
  WHERE item_batch_location_id IS NOT NULL;

COMMENT ON COLUMN public.stock_adjustment_items.item_batch_location_id IS
  'Selected item batch-location row adjusted by this stock adjustment line.';

CREATE OR REPLACE FUNCTION public.post_stock_adjustment(
  p_adjustment_id UUID,
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  adjustment_id UUID,
  stock_transaction_id UUID,
  stock_transaction_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adjustment public.stock_adjustments%ROWTYPE;
  v_line public.stock_adjustment_items%ROWTYPE;
  v_batch_location public.item_batch_locations%ROWTYPE;
  v_item_batch public.item_batches%ROWTYPE;
  v_stock_transaction_id UUID;
  v_stock_transaction_code TEXT;
  v_transaction_type TEXT;
  v_total_difference NUMERIC(20, 4);
  v_difference NUMERIC(20, 4);
  v_unit_cost NUMERIC(20, 4);
  v_batch_qty_after NUMERIC(20, 4);
  v_location_id UUID;
  v_current_warehouse_qty NUMERIC(20, 4);
  v_new_warehouse_qty NUMERIC(20, 4);
  v_posting_time TIME;
BEGIN
  IF p_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required';
  END IF;

  SELECT *
  INTO v_adjustment
  FROM public.stock_adjustments
  WHERE id = p_adjustment_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock adjustment not found';
  END IF;

  IF v_adjustment.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft adjustments can be posted';
  END IF;

  SELECT COALESCE(SUM(difference), 0)
  INTO v_total_difference
  FROM public.stock_adjustment_items
  WHERE adjustment_id = p_adjustment_id
    AND company_id = p_company_id
    AND deleted_at IS NULL;

  IF v_total_difference = 0 THEN
    RAISE EXCEPTION 'No net adjustment';
  END IF;

  v_transaction_type := CASE WHEN v_total_difference > 0 THEN 'in' ELSE 'out' END;
  v_location_id := NULLIF(v_adjustment.custom_fields->>'locationId', '')::UUID;
  v_posting_time := CURRENT_TIME;

  INSERT INTO public.stock_transactions (
    company_id,
    business_unit_id,
    transaction_type,
    transaction_date,
    warehouse_id,
    from_location_id,
    to_location_id,
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
    p_business_unit_id,
    v_transaction_type,
    v_adjustment.adjustment_date,
    v_adjustment.warehouse_id,
    CASE WHEN v_transaction_type = 'out' THEN v_location_id ELSE NULL END,
    CASE WHEN v_transaction_type = 'in' THEN v_location_id ELSE NULL END,
    'stock_adjustment',
    v_adjustment.id,
    v_adjustment.adjustment_code,
    'posted',
    'Stock adjustment: ' || v_adjustment.adjustment_code || ' - ' || v_adjustment.reason,
    p_user_id,
    p_user_id
  )
  RETURNING id, transaction_code
  INTO v_stock_transaction_id, v_stock_transaction_code;

  FOR v_line IN
    SELECT *
    FROM public.stock_adjustment_items
    WHERE adjustment_id = p_adjustment_id
      AND company_id = p_company_id
      AND deleted_at IS NULL
    ORDER BY created_at, id
  LOOP
    v_difference := COALESCE(v_line.difference, 0);
    IF v_difference = 0 THEN
      CONTINUE;
    END IF;

    IF v_line.item_batch_location_id IS NULL THEN
      RAISE EXCEPTION 'Batch selection is required for adjustment line %', v_line.id;
    END IF;

    IF v_line.uom_id IS NULL THEN
      RAISE EXCEPTION 'Item UOM missing on adjustment line %', v_line.id;
    END IF;

    SELECT *
    INTO v_batch_location
    FROM public.item_batch_locations
    WHERE id = v_line.item_batch_location_id
      AND company_id = p_company_id
      AND item_id = v_line.item_id
      AND warehouse_id = v_adjustment.warehouse_id
      AND (v_location_id IS NULL OR location_id = v_location_id)
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected batch-location is not valid for adjustment line %', v_line.id;
    END IF;

    SELECT *
    INTO v_item_batch
    FROM public.item_batches
    WHERE id = v_batch_location.item_batch_id
      AND company_id = p_company_id
      AND item_id = v_line.item_id
      AND warehouse_id = v_adjustment.warehouse_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected item batch is not valid for adjustment line %', v_line.id;
    END IF;

    v_batch_qty_after := COALESCE(v_batch_location.qty_on_hand, 0) + v_difference;
    IF v_batch_qty_after < 0 THEN
      RAISE EXCEPTION 'Selected batch-location stock cannot go negative for adjustment line %', v_line.id;
    END IF;

    IF v_batch_qty_after < COALESCE(v_batch_location.qty_reserved, 0) THEN
      RAISE EXCEPTION 'Selected batch-location stock cannot fall below reserved quantity for adjustment line %', v_line.id;
    END IF;

    v_unit_cost := COALESCE(v_line.unit_cost, 0);

    SELECT COALESCE(current_stock, 0)
    INTO v_current_warehouse_qty
    FROM public.item_warehouse
    WHERE company_id = p_company_id
      AND item_id = v_line.item_id
      AND warehouse_id = v_adjustment.warehouse_id
      AND deleted_at IS NULL
    FOR UPDATE;

    v_current_warehouse_qty := COALESCE(v_current_warehouse_qty, 0);
    v_new_warehouse_qty := v_current_warehouse_qty + v_difference;

    IF v_new_warehouse_qty < 0 THEN
      RAISE EXCEPTION 'Warehouse stock cannot go negative for adjustment line %', v_line.id;
    END IF;

    INSERT INTO public.stock_transaction_items (
      company_id,
      transaction_id,
      item_id,
      quantity,
      uom_id,
      unit_cost,
      total_cost,
      batch_no,
      notes,
      qty_before,
      qty_after,
      valuation_rate,
      stock_value_before,
      stock_value_after,
      posting_date,
      posting_time,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_stock_transaction_id,
      v_line.item_id,
      ABS(v_difference),
      v_line.uom_id,
      v_unit_cost,
      ABS(v_difference) * v_unit_cost,
      v_item_batch.batch_code,
      COALESCE(v_line.reason, 'Adjustment: ' || v_adjustment.adjustment_code),
      v_current_warehouse_qty,
      v_new_warehouse_qty,
      v_unit_cost,
      v_current_warehouse_qty * v_unit_cost,
      v_new_warehouse_qty * v_unit_cost,
      v_adjustment.adjustment_date,
      v_posting_time,
      p_user_id,
      p_user_id
    );

    UPDATE public.item_batch_locations
    SET qty_on_hand = v_batch_qty_after,
        qty_available = v_batch_qty_after - COALESCE(qty_reserved, 0),
        updated_by = p_user_id,
        updated_at = NOW()
    WHERE id = v_batch_location.id;

    UPDATE public.item_batches
    SET qty_on_hand = COALESCE(qty_on_hand, 0) + v_difference,
        qty_available = COALESCE(qty_on_hand, 0) + v_difference - COALESCE(qty_reserved, 0),
        updated_by = p_user_id,
        updated_at = NOW()
    WHERE id = v_item_batch.id;

    INSERT INTO public.item_warehouse (
      company_id,
      item_id,
      warehouse_id,
      current_stock,
      default_location_id,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_line.item_id,
      v_adjustment.warehouse_id,
      v_new_warehouse_qty,
      v_batch_location.location_id,
      p_user_id,
      p_user_id
    )
    ON CONFLICT (company_id, item_id, warehouse_id)
    DO UPDATE SET
      current_stock = v_new_warehouse_qty,
      default_location_id = COALESCE(public.item_warehouse.default_location_id, EXCLUDED.default_location_id),
      updated_by = p_user_id,
      updated_at = NOW();
  END LOOP;

  UPDATE public.stock_adjustments
  SET status = 'posted',
      stock_transaction_id = v_stock_transaction_id,
      approved_by = p_user_id,
      approved_at = NOW(),
      posted_by = p_user_id,
      posted_at = NOW(),
      updated_by = p_user_id,
      updated_at = NOW()
  WHERE id = v_adjustment.id;

  RETURN QUERY SELECT v_adjustment.id, v_stock_transaction_id, v_stock_transaction_code::TEXT;
END;
$$;
