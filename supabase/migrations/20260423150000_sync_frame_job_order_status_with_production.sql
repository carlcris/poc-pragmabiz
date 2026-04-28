-- Synchronize frame job order statuses with production status.
-- New workflow:
-- pending -> queued -> in_progress / on_hold -> completed (or cancelled)

ALTER TABLE public.frame_job_orders
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE public.frame_job_orders
  DROP CONSTRAINT IF EXISTS chk_frame_job_order_status;

ALTER TABLE public.frame_job_orders
  ADD CONSTRAINT chk_frame_job_order_status
  CHECK (status IN ('pending', 'queued', 'in_progress', 'on_hold', 'completed', 'cancelled'));

WITH latest_manufacturing AS (
  SELECT DISTINCT ON (frame_job_order_id)
    frame_job_order_id,
    status,
    completed_at
  FROM public.manufacturing_orders
  WHERE frame_job_order_id IS NOT NULL
    AND deleted_at IS NULL
    AND status <> 'cancelled'
  ORDER BY frame_job_order_id, created_at DESC
)
UPDATE public.frame_job_orders job
SET
  status = CASE
    WHEN job.status = 'cancelled' THEN 'cancelled'
    WHEN job.status = 'completed' THEN 'completed'
    WHEN latest_manufacturing.status IN ('ready', 'queued') THEN 'queued'
    WHEN latest_manufacturing.status IN ('in_progress', 'quality_check') THEN 'in_progress'
    WHEN latest_manufacturing.status = 'on_hold' THEN 'on_hold'
    WHEN latest_manufacturing.status = 'completed' THEN 'completed'
    ELSE 'pending'
  END,
  completed_at = CASE
    WHEN job.status = 'completed' THEN job.completed_at
    WHEN latest_manufacturing.status = 'completed' THEN COALESCE(job.completed_at, latest_manufacturing.completed_at)
    ELSE job.completed_at
  END
FROM latest_manufacturing
WHERE job.id = latest_manufacturing.frame_job_order_id
  AND job.deleted_at IS NULL;

UPDATE public.frame_job_orders
SET status = 'pending'
WHERE deleted_at IS NULL
  AND status IN ('draft', 'reserved');

CREATE OR REPLACE FUNCTION public.prevent_frame_job_order_cancel_when_production_active()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled'
     AND COALESCE(OLD.status, '') <> 'cancelled'
     AND EXISTS (
       SELECT 1
       FROM public.manufacturing_orders mo
       WHERE mo.frame_job_order_id = NEW.id
         AND mo.deleted_at IS NULL
         AND mo.status NOT IN ('completed', 'cancelled')
     ) THEN
    RAISE EXCEPTION 'Job orders already in production cannot be cancelled';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_frame_job_order_cancel_when_production_active
ON public.frame_job_orders;

CREATE TRIGGER prevent_frame_job_order_cancel_when_production_active
  BEFORE UPDATE OF status ON public.frame_job_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_frame_job_order_cancel_when_production_active();

CREATE OR REPLACE FUNCTION public.finalize_frame_job_order_completion_transaction(
  p_job_order_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_job_order RECORD;
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

  IF v_job_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled job orders cannot be completed';
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
      consumed_at = now(),
      updated_by = v_user_id
    WHERE id = v_reservation.id;

    UPDATE public.frame_job_order_items
    SET
      issued_quantity = required_quantity,
      updated_by = v_user_id
    WHERE job_order_id = p_job_order_id
      AND (
        (v_reservation.sales_order_component_id IS NOT NULL AND sales_order_component_id = v_reservation.sales_order_component_id)
        OR (v_reservation.sales_order_component_id IS NULL AND quotation_component_id = v_reservation.quotation_component_id)
      )
      AND deleted_at IS NULL;
  END LOOP;

  UPDATE public.frame_job_orders
  SET
    status = 'completed',
    completed_at = COALESCE(completed_at, now()),
    updated_by = v_user_id
  WHERE id = p_job_order_id;

  RETURN p_job_order_id;
END;
$$;

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
    'pending',
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

CREATE OR REPLACE FUNCTION public.create_manufacturing_order_from_frame_job_order_transaction(
  p_frame_job_order_id UUID
)
RETURNS TABLE (
  manufacturing_order_id UUID,
  manufacturing_order_code TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_job_order RECORD;
  v_existing RECORD;
  v_mo_id UUID;
  v_mo_code TEXT;
  v_mo_item_id UUID;
  v_frame_line RECORD;
  v_cutting_id UUID;
  v_joining_id UUID;
  v_assembly_id UUID;
  v_qc_id UUID;
  v_ready_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO v_job_order
  FROM public.frame_job_orders
  WHERE id = p_frame_job_order_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_job_order.id IS NULL THEN
    RAISE EXCEPTION 'Frame job order not found';
  END IF;

  IF v_job_order.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending frame job orders can be pushed to production';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.manufacturing_orders
  WHERE frame_job_order_id = p_frame_job_order_id
    AND status <> 'cancelled'
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RAISE EXCEPTION 'This job order is already in production';
  END IF;

  PERFORM public.ensure_default_manufacturing_workstations(
    v_job_order.company_id,
    v_job_order.business_unit_id
  );

  SELECT id INTO v_cutting_id FROM public.manufacturing_workstations WHERE company_id = v_job_order.company_id AND workstation_code = 'CUTTING' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_joining_id FROM public.manufacturing_workstations WHERE company_id = v_job_order.company_id AND workstation_code = 'JOINING' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_assembly_id FROM public.manufacturing_workstations WHERE company_id = v_job_order.company_id AND workstation_code = 'ASSEMBLY' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_qc_id FROM public.manufacturing_workstations WHERE company_id = v_job_order.company_id AND workstation_code = 'QC' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_ready_id FROM public.manufacturing_workstations WHERE company_id = v_job_order.company_id AND workstation_code = 'READY' AND deleted_at IS NULL LIMIT 1;

  INSERT INTO public.manufacturing_orders (
    company_id,
    business_unit_id,
    source_type,
    source_id,
    sales_order_id,
    frame_job_order_id,
    quotation_id,
    customer_id,
    production_type,
    status,
    priority,
    due_date,
    current_workstation_id,
    notes,
    custom_fields,
    created_by,
    updated_by
  )
  VALUES (
    v_job_order.company_id,
    v_job_order.business_unit_id,
    'frame_job_order',
    p_frame_job_order_id,
    v_job_order.sales_order_id,
    p_frame_job_order_id,
    v_job_order.quotation_id,
    v_job_order.customer_id,
    'frame_service',
    'ready',
    'normal',
    v_job_order.order_date,
    v_cutting_id,
    v_job_order.notes,
    jsonb_build_object(
      'source', 'frame_job_order',
      'frameJobOrderId', p_frame_job_order_id,
      'salesOrderId', v_job_order.sales_order_id
    ),
    v_user_id,
    v_user_id
  )
  RETURNING id, manufacturing_orders.manufacturing_order_code INTO v_mo_id, v_mo_code;

  FOR v_frame_line IN
    SELECT
      COALESCE(fjoi.sales_order_item_id, fjoi.quotation_item_id) AS source_line_id,
      MAX(fjoi.item_description) AS item_description
    FROM public.frame_job_order_items fjoi
    WHERE fjoi.job_order_id = p_frame_job_order_id
      AND fjoi.deleted_at IS NULL
    GROUP BY COALESCE(fjoi.sales_order_item_id, fjoi.quotation_item_id)
    ORDER BY MIN(fjoi.created_at)
  LOOP
    INSERT INTO public.manufacturing_order_items (
      company_id,
      manufacturing_order_id,
      sales_order_item_id,
      item_id,
      item_description,
      quantity,
      uom_id,
      sort_order,
      created_by,
      updated_by
    )
    SELECT
      v_job_order.company_id,
      v_mo_id,
      (ARRAY_AGG(fjoi.sales_order_item_id ORDER BY fjoi.created_at))[1],
      (ARRAY_AGG(COALESCE(soi.item_id, qi.item_id, fjoi.item_id) ORDER BY fjoi.created_at))[1],
      COALESCE(MAX(soi.item_description), MAX(qi.item_description), v_frame_line.item_description, 'Frame job order'),
      COALESCE(MAX(soi.quantity), MAX(qi.quantity), 1),
      (ARRAY_AGG(COALESCE(soi.uom_id, qi.uom_id, fjoi.uom_id) ORDER BY fjoi.created_at))[1],
      COALESCE(MAX(soi.sort_order), MAX(qi.sort_order), 0),
      v_user_id,
      v_user_id
    FROM public.frame_job_order_items fjoi
    LEFT JOIN public.sales_order_items soi ON soi.id = fjoi.sales_order_item_id
    LEFT JOIN public.sales_quotation_items qi ON qi.id = fjoi.quotation_item_id
    WHERE fjoi.job_order_id = p_frame_job_order_id
      AND fjoi.deleted_at IS NULL
      AND COALESCE(fjoi.sales_order_item_id, fjoi.quotation_item_id) = v_frame_line.source_line_id
    RETURNING id INTO v_mo_item_id;

    INSERT INTO public.manufacturing_order_materials (
      company_id,
      manufacturing_order_id,
      manufacturing_order_item_id,
      sales_order_item_id,
      sales_order_component_id,
      item_id,
      item_description,
      required_quantity,
      issued_quantity,
      uom_id,
      unit_rate,
      total_amount,
      material_status,
      sort_order,
      created_by,
      updated_by
    )
    SELECT
      v_job_order.company_id,
      v_mo_id,
      v_mo_item_id,
      fjoi.sales_order_item_id,
      fjoi.sales_order_component_id,
      fjoi.item_id,
      fjoi.item_description,
      fjoi.required_quantity,
      fjoi.issued_quantity,
      fjoi.uom_id,
      fjoi.unit_rate,
      fjoi.total_amount,
      CASE WHEN fjoi.issued_quantity >= fjoi.required_quantity THEN 'issued' ELSE 'reserved' END,
      ROW_NUMBER() OVER (ORDER BY fjoi.created_at)::INTEGER,
      v_user_id,
      v_user_id
    FROM public.frame_job_order_items fjoi
    WHERE fjoi.job_order_id = p_frame_job_order_id
      AND fjoi.deleted_at IS NULL
      AND COALESCE(fjoi.sales_order_item_id, fjoi.quotation_item_id) = v_frame_line.source_line_id
    ORDER BY fjoi.created_at;
  END LOOP;

  INSERT INTO public.manufacturing_operations (
    company_id,
    manufacturing_order_id,
    workstation_id,
    operation_code,
    operation_name,
    operation_type,
    status,
    sequence_no,
    created_by,
    updated_by
  )
  VALUES
    (v_job_order.company_id, v_mo_id, v_cutting_id, 'CUT', 'Cut molding', 'production', 'pending', 10, v_user_id, v_user_id),
    (v_job_order.company_id, v_mo_id, v_joining_id, 'JOIN', 'Join frame', 'production', 'pending', 20, v_user_id, v_user_id),
    (v_job_order.company_id, v_mo_id, v_assembly_id, 'ASSEMBLE', 'Fit materials', 'production', 'pending', 30, v_user_id, v_user_id),
    (v_job_order.company_id, v_mo_id, v_qc_id, 'QC', 'Quality check', 'quality_check', 'pending', 40, v_user_id, v_user_id),
    (v_job_order.company_id, v_mo_id, v_ready_id, 'READY', 'Ready for release', 'ready', 'pending', 50, v_user_id, v_user_id);

  INSERT INTO public.manufacturing_order_events (
    company_id,
    manufacturing_order_id,
    event_type,
    event_note,
    to_status,
    created_by
  )
  VALUES (
    v_job_order.company_id,
    v_mo_id,
    'pushed_to_production',
    'Frame job order pushed to production',
    'ready',
    v_user_id
  );

  UPDATE public.frame_job_orders
  SET
    status = 'queued',
    updated_by = v_user_id
  WHERE id = p_frame_job_order_id;

  manufacturing_order_id := v_mo_id;
  manufacturing_order_code := v_mo_code;
  RETURN NEXT;
END;
$$;

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

  IF v_job_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled job orders cannot be completed';
  END IF;

  IF v_job_order.status NOT IN ('queued', 'in_progress', 'on_hold') THEN
    RAISE EXCEPTION 'Only queued, in-progress, or on-hold job orders can be completed';
  END IF;

  SELECT id, manufacturing_order_code, status
  INTO v_manufacturing_order
  FROM public.manufacturing_orders
  WHERE frame_job_order_id = p_job_order_id
    AND deleted_at IS NULL
    AND status <> 'cancelled'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_manufacturing_order.id IS NULL THEN
    RAISE EXCEPTION 'Job order must be pushed to production before completion';
  END IF;

  IF v_manufacturing_order.status <> 'completed' THEN
    RAISE EXCEPTION 'Production must be completed before the job order can be completed';
  END IF;

  RETURN public.finalize_frame_job_order_completion_transaction(p_job_order_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_manufacturing_floor_action_transaction(
  p_manufacturing_order_id UUID,
  p_action TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_order RECORD;
  v_current_operation RECORD;
  v_next_operation RECORD;
  v_event_operation_id UUID;
  v_from_status TEXT;
  v_to_status TEXT;
  v_job_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO v_order
  FROM public.manufacturing_orders
  WHERE id = p_manufacturing_order_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Manufacturing order not found';
  END IF;

  IF v_order.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Completed or cancelled manufacturing orders cannot be changed';
  END IF;

  v_from_status := v_order.status;

  IF p_action = 'hold' THEN
    UPDATE public.manufacturing_orders
    SET status = 'on_hold', updated_by = v_user_id
    WHERE id = p_manufacturing_order_id;
    v_to_status := 'on_hold';
  ELSIF p_action = 'resume' THEN
    SELECT *
    INTO v_current_operation
    FROM public.manufacturing_operations
    WHERE manufacturing_order_id = p_manufacturing_order_id
      AND status = 'in_progress'
      AND deleted_at IS NULL
    ORDER BY sequence_no ASC
    LIMIT 1;

    IF FOUND THEN
      v_to_status := 'in_progress';
      v_event_operation_id := v_current_operation.id;
    ELSE
      v_to_status := 'ready';
    END IF;

    UPDATE public.manufacturing_orders
    SET status = v_to_status, updated_by = v_user_id
    WHERE id = p_manufacturing_order_id;
  ELSIF p_action = 'start' THEN
    SELECT *
    INTO v_current_operation
    FROM public.manufacturing_operations
    WHERE manufacturing_order_id = p_manufacturing_order_id
      AND status IN ('pending', 'blocked')
      AND deleted_at IS NULL
    ORDER BY sequence_no ASC
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No pending operation found';
    END IF;

    v_event_operation_id := v_current_operation.id;

    UPDATE public.manufacturing_operations
    SET status = 'in_progress',
        started_at = COALESCE(started_at, now()),
        updated_by = v_user_id
    WHERE id = v_current_operation.id;

    UPDATE public.manufacturing_orders
    SET status = CASE WHEN v_current_operation.operation_type = 'quality_check' THEN 'quality_check' ELSE 'in_progress' END,
        started_at = COALESCE(started_at, now()),
        current_workstation_id = v_current_operation.workstation_id,
        updated_by = v_user_id
    WHERE id = p_manufacturing_order_id;

    v_to_status := CASE WHEN v_current_operation.operation_type = 'quality_check' THEN 'quality_check' ELSE 'in_progress' END;
  ELSIF p_action = 'complete_step' THEN
    SELECT *
    INTO v_current_operation
    FROM public.manufacturing_operations
    WHERE manufacturing_order_id = p_manufacturing_order_id
      AND status = 'in_progress'
      AND deleted_at IS NULL
    ORDER BY sequence_no ASC
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No in-progress operation found';
    END IF;

    v_event_operation_id := v_current_operation.id;

    UPDATE public.manufacturing_operations
    SET status = 'completed',
        completed_at = now(),
        updated_by = v_user_id
    WHERE id = v_current_operation.id;

    SELECT *
    INTO v_next_operation
    FROM public.manufacturing_operations
    WHERE manufacturing_order_id = p_manufacturing_order_id
      AND status = 'pending'
      AND deleted_at IS NULL
    ORDER BY sequence_no ASC
    LIMIT 1;

    IF NOT FOUND THEN
      UPDATE public.manufacturing_orders
      SET status = 'completed',
          completed_at = now(),
          updated_by = v_user_id
      WHERE id = p_manufacturing_order_id;
      v_to_status := 'completed';
    ELSE
      v_event_operation_id := v_next_operation.id;

      UPDATE public.manufacturing_operations
      SET status = 'in_progress',
          started_at = COALESCE(started_at, now()),
          updated_by = v_user_id
      WHERE id = v_next_operation.id;

      v_to_status := CASE WHEN v_next_operation.operation_type = 'quality_check' THEN 'quality_check' ELSE 'in_progress' END;

      UPDATE public.manufacturing_orders
      SET status = v_to_status,
          current_workstation_id = v_next_operation.workstation_id,
          updated_by = v_user_id
      WHERE id = p_manufacturing_order_id;
    END IF;
  ELSIF p_action = 'complete' THEN
    UPDATE public.manufacturing_operations
    SET status = 'completed',
        completed_at = COALESCE(completed_at, now()),
        updated_by = v_user_id
    WHERE manufacturing_order_id = p_manufacturing_order_id
      AND status <> 'completed'
      AND deleted_at IS NULL;

    UPDATE public.manufacturing_orders
    SET status = 'completed',
        completed_at = now(),
        updated_by = v_user_id
    WHERE id = p_manufacturing_order_id;
    v_to_status := 'completed';
  ELSE
    RAISE EXCEPTION 'Unsupported manufacturing floor action';
  END IF;

  INSERT INTO public.manufacturing_order_events (
    company_id,
    manufacturing_order_id,
    manufacturing_operation_id,
    event_type,
    event_note,
    from_status,
    to_status,
    created_by
  )
  VALUES (
    v_order.company_id,
    p_manufacturing_order_id,
    v_event_operation_id,
    p_action,
    p_note,
    v_from_status,
    v_to_status,
    v_user_id
  );

  IF v_order.frame_job_order_id IS NOT NULL THEN
    IF v_to_status = 'completed' THEN
      PERFORM public.finalize_frame_job_order_completion_transaction(v_order.frame_job_order_id);
    ELSE
      v_job_status := CASE
        WHEN v_to_status IN ('ready', 'queued') THEN 'queued'
        WHEN v_to_status IN ('in_progress', 'quality_check') THEN 'in_progress'
        WHEN v_to_status = 'on_hold' THEN 'on_hold'
        ELSE NULL
      END;

      IF v_job_status IS NOT NULL THEN
        UPDATE public.frame_job_orders
        SET
          status = v_job_status,
          updated_by = v_user_id
        WHERE id = v_order.frame_job_order_id
          AND deleted_at IS NULL
          AND status <> 'cancelled';
      END IF;
    END IF;
  END IF;

  RETURN p_manufacturing_order_id;
END;
$$;
