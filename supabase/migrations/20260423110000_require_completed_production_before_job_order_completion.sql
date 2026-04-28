-- Prevent frame job orders from completing before linked production completes.
-- This keeps inventory consumption aligned with the actual production lifecycle.

CREATE OR REPLACE FUNCTION public.complete_frame_job_order_transaction(
  p_job_order_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_job_order RECORD;
  v_manufacturing_order RECORD;
  v_reservation RECORD;
  v_stock RECORD;
  v_stock_transaction_id UUID;
  v_next_stock NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO v_job_order
  FROM public.frame_job_orders
  WHERE id = p_job_order_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_job_order.id IS NULL THEN
    RAISE EXCEPTION 'Frame job order not found';
  END IF;

  IF v_job_order.status = 'completed' THEN
    RETURN p_job_order_id;
  END IF;

  IF v_job_order.status NOT IN ('reserved', 'in_progress') THEN
    RAISE EXCEPTION 'Only reserved or in-progress frame job orders can be completed';
  END IF;

  SELECT id, manufacturing_order_code, status
  INTO v_manufacturing_order
  FROM public.manufacturing_orders
  WHERE frame_job_order_id = p_job_order_id
    AND deleted_at IS NULL
    AND status <> 'cancelled'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_manufacturing_order.id IS NOT NULL
     AND v_manufacturing_order.status <> 'completed' THEN
    RAISE EXCEPTION 'Production must be completed before the job order can be completed';
  END IF;

  FOR v_reservation IN
    SELECT *
    FROM public.inventory_reservations
    WHERE job_order_id = p_job_order_id
      AND status = 'active'
      AND deleted_at IS NULL
    ORDER BY created_at ASC
  LOOP
    IF v_stock_transaction_id IS NULL THEN
      INSERT INTO public.stock_transactions (
        company_id,
        business_unit_id,
        transaction_date,
        transaction_type,
        reference_type,
        reference_id,
        warehouse_id,
        status,
        notes,
        custom_fields,
        created_by,
        updated_by
      )
      VALUES (
        v_job_order.company_id,
        v_job_order.business_unit_id,
        CURRENT_DATE,
        'out',
        'frame_job_order',
        p_job_order_id,
        v_reservation.warehouse_id,
        'posted',
        'Frame job order material consumption',
        jsonb_build_object('frameJobOrderId', p_job_order_id),
        v_user_id,
        v_user_id
      )
      RETURNING id INTO v_stock_transaction_id;
    END IF;

    SELECT *
    INTO v_stock
    FROM public.item_warehouse
    WHERE company_id = v_job_order.company_id
      AND item_id = v_reservation.item_id
      AND warehouse_id = v_reservation.warehouse_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF v_stock.id IS NULL THEN
      RAISE EXCEPTION 'No stock record exists for a reserved frame component';
    END IF;

    IF COALESCE(v_stock.current_stock, 0) < v_reservation.quantity THEN
      RAISE EXCEPTION 'Insufficient stock to complete frame job order';
    END IF;

    v_next_stock := COALESCE(v_stock.current_stock, 0) - v_reservation.quantity;

    INSERT INTO public.stock_transaction_items (
      company_id,
      transaction_id,
      item_id,
      quantity,
      uom_id,
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
      v_job_order.company_id,
      v_stock_transaction_id,
      v_reservation.item_id,
      v_reservation.quantity,
      v_reservation.uom_id,
      0,
      0,
      COALESCE(v_stock.current_stock, 0),
      v_next_stock,
      0,
      0,
      0,
      CURRENT_DATE,
      CURRENT_TIME,
      'Consumed by frame job order',
      v_user_id,
      v_user_id
    );

    UPDATE public.item_warehouse
    SET
      current_stock = v_next_stock,
      reserved_stock = GREATEST(0, COALESCE(reserved_stock, 0) - v_reservation.quantity),
      updated_by = v_user_id
    WHERE id = v_stock.id;

    UPDATE public.inventory_reservations
    SET
      status = 'consumed',
      consumed_at = NOW(),
      updated_by = v_user_id
    WHERE id = v_reservation.id;
  END LOOP;

  UPDATE public.frame_job_orders
  SET
    status = 'completed',
    completed_at = NOW(),
    updated_by = v_user_id
  WHERE id = p_job_order_id;

  RETURN p_job_order_id;
END;
$$;
