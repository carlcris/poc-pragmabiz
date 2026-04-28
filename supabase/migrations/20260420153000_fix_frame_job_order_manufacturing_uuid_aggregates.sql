-- ============================================================================
-- Migration: Fix frame job order manufacturing UUID aggregates
-- Description:
--   - Replaces UUID MAX aggregates in the frame job order production release RPC.
--   - Keeps existing databases correct even when the generic manufacturing
--     migration was already applied before this fix.
-- Date: 2026-04-20
-- ============================================================================

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

  IF v_job_order.status NOT IN ('reserved', 'in_progress') THEN
    RAISE EXCEPTION 'Only reserved or in-progress frame job orders can be pushed to production';
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
    status = CASE WHEN status = 'reserved' THEN 'in_progress' ELSE status END,
    updated_by = v_user_id
  WHERE id = p_frame_job_order_id;

  manufacturing_order_id := v_mo_id;
  manufacturing_order_code := v_mo_code;
  RETURN NEXT;
END;
$$;
