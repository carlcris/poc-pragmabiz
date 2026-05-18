CREATE OR REPLACE FUNCTION public.cancel_sales_order_transaction(p_sales_order_id UUID)
RETURNS TABLE (
  sales_order_id UUID,
  status TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sales_order RECORD;
  v_has_active_invoice BOOLEAN;
  v_quotation_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
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

  IF NOT public.user_has_permission(
    v_user_id,
    'sales_orders',
    'edit',
    v_sales_order.business_unit_id
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.sales_invoices si
    WHERE si.sales_order_id = p_sales_order_id
      AND si.deleted_at IS NULL
      AND COALESCE(si.status, 'draft') <> 'cancelled'
  ) INTO v_has_active_invoice;

  IF v_sales_order.status = 'invoiced' OR v_has_active_invoice THEN
    RAISE EXCEPTION 'Invoiced sales orders cannot be cancelled';
  END IF;

  IF v_sales_order.status = 'cancelled' THEN
    sales_order_id := p_sales_order_id;
    status := 'cancelled';
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.sales_orders
  SET
    status = 'cancelled',
    updated_by = v_user_id,
    updated_at = NOW()
  WHERE id = p_sales_order_id;

  FOR v_quotation_id IN
    SELECT DISTINCT soi.quotation_id
    FROM public.sales_order_items soi
    WHERE soi.order_id = p_sales_order_id
      AND soi.quotation_id IS NOT NULL
      AND soi.deleted_at IS NULL
  LOOP
    PERFORM public.recalculate_sales_quotation_order_status(v_quotation_id);
  END LOOP;

  sales_order_id := p_sales_order_id;
  status := 'cancelled';
  RETURN NEXT;
END;
$$;
