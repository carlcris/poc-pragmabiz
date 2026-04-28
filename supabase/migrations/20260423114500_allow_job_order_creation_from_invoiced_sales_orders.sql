-- Allow invoiced sales orders to create a job order when they still have
-- frame-configured items and no active job order has been created yet.

CREATE OR REPLACE FUNCTION public.create_frame_job_order_from_sales_order_transaction(
  p_sales_order_id UUID,
  p_warehouse_id UUID
)
RETURNS TABLE (
  job_order_id UUID,
  job_order_code TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sales_order RECORD;
  v_has_frame_items BOOLEAN;
  v_existing_job RECORD;
  v_job_order_id UUID;
  v_job_order_code TEXT;
  v_component RECORD;
  v_stock RECORD;
  v_available NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Warehouse is required to reserve frame materials';
  END IF;

  SELECT *
  INTO v_sales_order
  FROM public.sales_orders
  WHERE id = p_sales_order_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_sales_order.id IS NULL THEN
    RAISE EXCEPTION 'Sales order not found';
  END IF;

  IF v_sales_order.status NOT IN ('confirmed', 'in_progress', 'invoiced') THEN
    RAISE EXCEPTION 'Only confirmed, in-progress, or invoiced sales orders can create frame job orders';
  END IF;

  SELECT *
  INTO v_existing_job
  FROM public.frame_job_orders
  WHERE sales_order_id = p_sales_order_id
    AND status <> 'cancelled'
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing_job.id IS NOT NULL THEN
    RAISE EXCEPTION 'This sales order already has a frame job order';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.sales_order_item_configurations cfg
    JOIN public.sales_order_items soi ON soi.id = cfg.order_item_id
    WHERE soi.order_id = p_sales_order_id
      AND soi.deleted_at IS NULL
      AND cfg.deleted_at IS NULL
  ) INTO v_has_frame_items;

  IF NOT v_has_frame_items THEN
    RAISE EXCEPTION 'Sales order has no frame-configured items';
  END IF;

  INSERT INTO public.frame_job_orders (
    company_id,
    business_unit_id,
    quotation_id,
    sales_order_id,
    customer_id,
    status,
    order_date,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    v_sales_order.company_id,
    v_sales_order.business_unit_id,
    v_sales_order.quotation_id,
    p_sales_order_id,
    v_sales_order.customer_id,
    'reserved',
    CURRENT_DATE,
    v_sales_order.notes,
    v_user_id,
    v_user_id
  )
  RETURNING id, frame_job_orders.job_order_code INTO v_job_order_id, v_job_order_code;

  FOR v_component IN
    SELECT c.*
    FROM public.sales_order_item_components c
    JOIN public.sales_order_items soi ON soi.id = c.order_item_id
    WHERE soi.order_id = p_sales_order_id
      AND soi.deleted_at IS NULL
      AND c.deleted_at IS NULL
    ORDER BY soi.sort_order ASC NULLS LAST, c.sort_order ASC
  LOOP
    SELECT *
    INTO v_stock
    FROM public.item_warehouse
    WHERE company_id = v_sales_order.company_id
      AND item_id = v_component.item_id
      AND warehouse_id = p_warehouse_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF v_stock.id IS NULL THEN
      RAISE EXCEPTION 'No stock record exists for a required frame component';
    END IF;

    v_available := COALESCE(v_stock.current_stock, 0) - COALESCE(v_stock.reserved_stock, 0);

    IF v_available < v_component.total_quantity THEN
      RAISE EXCEPTION 'Insufficient available stock for a required frame component';
    END IF;

    INSERT INTO public.frame_job_order_items (
      company_id,
      job_order_id,
      sales_order_item_id,
      sales_order_component_id,
      quotation_component_id,
      item_id,
      item_description,
      required_quantity,
      uom_id,
      unit_rate,
      total_amount,
      created_by,
      updated_by
    )
    VALUES (
      v_sales_order.company_id,
      v_job_order_id,
      v_component.order_item_id,
      v_component.id,
      v_component.quotation_component_id,
      v_component.item_id,
      v_component.description,
      v_component.total_quantity,
      v_component.uom_id,
      v_component.unit_rate,
      v_component.total_amount,
      v_user_id,
      v_user_id
    );

    INSERT INTO public.inventory_reservations (
      company_id,
      reservation_type,
      source_type,
      source_id,
      quotation_id,
      sales_order_id,
      sales_order_item_id,
      sales_order_component_id,
      quotation_component_id,
      job_order_id,
      item_id,
      warehouse_id,
      quantity,
      uom_id,
      status,
      created_by,
      updated_by
    )
    VALUES (
      v_sales_order.company_id,
      'frame_job_order',
      'sales_order',
      p_sales_order_id,
      v_sales_order.quotation_id,
      p_sales_order_id,
      v_component.order_item_id,
      v_component.id,
      v_component.quotation_component_id,
      v_job_order_id,
      v_component.item_id,
      p_warehouse_id,
      v_component.total_quantity,
      v_component.uom_id,
      'active',
      v_user_id,
      v_user_id
    );

    UPDATE public.item_warehouse
    SET
      reserved_stock = COALESCE(reserved_stock, 0) + v_component.total_quantity,
      updated_by = v_user_id
    WHERE id = v_stock.id;
  END LOOP;

  UPDATE public.sales_orders
  SET
    status = CASE WHEN status = 'confirmed' THEN 'in_progress' ELSE status END,
    updated_by = v_user_id
  WHERE id = p_sales_order_id;

  job_order_id := v_job_order_id;
  job_order_code := v_job_order_code;
  RETURN NEXT;
END;
$$;
