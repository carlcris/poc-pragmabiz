-- ============================================================================
-- Migration: Generic Manufacturing and Production Floor
-- Description:
--   - Adds generic manufacturing orders, operations, materials, and floor events.
--   - Creates manufacturing orders from frame job orders.
--   - Supports touch-first production floor actions.
-- Date: 2026-04-20
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.manufacturing_workstations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_unit_id UUID REFERENCES public.business_units(id),
  workstation_code VARCHAR(100) NOT NULL,
  workstation_name VARCHAR(200) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMPTZ NULL,
  UNIQUE (company_id, workstation_code)
);

CREATE TABLE IF NOT EXISTS public.manufacturing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_unit_id UUID REFERENCES public.business_units(id),
  manufacturing_order_code VARCHAR(100) NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'sales_order',
  source_id UUID NOT NULL,
  sales_order_id UUID REFERENCES public.sales_orders(id),
  frame_job_order_id UUID REFERENCES public.frame_job_orders(id),
  quotation_id UUID REFERENCES public.sales_quotations(id),
  customer_id UUID REFERENCES public.customers(id),
  production_type TEXT NOT NULL DEFAULT 'generic',
  status TEXT NOT NULL DEFAULT 'ready',
  priority TEXT NOT NULL DEFAULT 'normal',
  due_date DATE,
  current_workstation_id UUID REFERENCES public.manufacturing_workstations(id),
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  notes TEXT,
  custom_fields JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_manufacturing_order_source CHECK (source_type IN ('sales_order', 'frame_job_order', 'manual')),
  CONSTRAINT chk_manufacturing_order_status CHECK (status IN ('queued', 'ready', 'in_progress', 'on_hold', 'quality_check', 'completed', 'cancelled')),
  CONSTRAINT chk_manufacturing_order_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  UNIQUE (company_id, manufacturing_order_code)
);

CREATE TABLE IF NOT EXISTS public.manufacturing_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  manufacturing_order_id UUID NOT NULL REFERENCES public.manufacturing_orders(id) ON DELETE CASCADE,
  sales_order_item_id UUID REFERENCES public.sales_order_items(id),
  item_id UUID NOT NULL REFERENCES public.items(id),
  item_description TEXT,
  quantity NUMERIC(20, 4) NOT NULL DEFAULT 1,
  uom_id UUID REFERENCES public.units_of_measure(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  custom_fields JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_manufacturing_order_item_qty CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS public.manufacturing_order_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  manufacturing_order_id UUID NOT NULL REFERENCES public.manufacturing_orders(id) ON DELETE CASCADE,
  manufacturing_order_item_id UUID REFERENCES public.manufacturing_order_items(id) ON DELETE CASCADE,
  sales_order_item_id UUID REFERENCES public.sales_order_items(id),
  sales_order_component_id UUID REFERENCES public.sales_order_item_components(id),
  item_id UUID NOT NULL REFERENCES public.items(id),
  item_description TEXT,
  required_quantity NUMERIC(20, 4) NOT NULL,
  issued_quantity NUMERIC(20, 4) NOT NULL DEFAULT 0,
  uom_id UUID REFERENCES public.units_of_measure(id),
  unit_rate NUMERIC(20, 4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(20, 4) NOT NULL DEFAULT 0,
  material_status TEXT NOT NULL DEFAULT 'required',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_manufacturing_material_qty CHECK (required_quantity > 0),
  CONSTRAINT chk_manufacturing_material_status CHECK (material_status IN ('required', 'reserved', 'issued', 'short', 'consumed'))
);

CREATE TABLE IF NOT EXISTS public.manufacturing_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  manufacturing_order_id UUID NOT NULL REFERENCES public.manufacturing_orders(id) ON DELETE CASCADE,
  workstation_id UUID REFERENCES public.manufacturing_workstations(id),
  operation_code VARCHAR(100) NOT NULL,
  operation_name VARCHAR(200) NOT NULL,
  operation_type TEXT NOT NULL DEFAULT 'production',
  status TEXT NOT NULL DEFAULT 'pending',
  sequence_no INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  assigned_to UUID REFERENCES public.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_manufacturing_operation_type CHECK (operation_type IN ('production', 'quality_check', 'ready')),
  CONSTRAINT chk_manufacturing_operation_status CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked'))
);

CREATE TABLE IF NOT EXISTS public.manufacturing_order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  manufacturing_order_id UUID NOT NULL REFERENCES public.manufacturing_orders(id) ON DELETE CASCADE,
  manufacturing_operation_id UUID REFERENCES public.manufacturing_operations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_note TEXT,
  from_status TEXT,
  to_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMPTZ NULL
);

DO $$
BEGIN
  ALTER TABLE public.manufacturing_orders
    ADD COLUMN IF NOT EXISTS frame_job_order_id UUID REFERENCES public.frame_job_orders(id);
END $$;

ALTER TABLE public.manufacturing_orders
  DROP CONSTRAINT IF EXISTS chk_manufacturing_order_source;
ALTER TABLE public.manufacturing_orders
  ADD CONSTRAINT chk_manufacturing_order_source CHECK (source_type IN ('sales_order', 'frame_job_order', 'manual'));

CREATE INDEX IF NOT EXISTS idx_manufacturing_workstations_company ON public.manufacturing_workstations(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_manufacturing_orders_company ON public.manufacturing_orders(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_manufacturing_orders_sales_order ON public.manufacturing_orders(sales_order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_manufacturing_orders_frame_job_order ON public.manufacturing_orders(frame_job_order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_manufacturing_orders_status ON public.manufacturing_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_manufacturing_orders_workstation ON public.manufacturing_orders(current_workstation_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_manufacturing_operations_order ON public.manufacturing_operations(manufacturing_order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_manufacturing_materials_order ON public.manufacturing_order_materials(manufacturing_order_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_manufacturing_orders_active_sales_order
  ON public.manufacturing_orders(sales_order_id)
  WHERE sales_order_id IS NOT NULL
    AND status <> 'cancelled'
    AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_manufacturing_orders_active_frame_job_order
  ON public.manufacturing_orders(frame_job_order_id)
  WHERE frame_job_order_id IS NOT NULL
    AND status <> 'cancelled'
    AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS trigger_generate_manufacturing_order_code ON public.manufacturing_orders;
CREATE TRIGGER trigger_generate_manufacturing_order_code
  BEFORE INSERT ON public.manufacturing_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('manufacturing_order_code', 'MO', '9');

DROP TRIGGER IF EXISTS update_manufacturing_workstations_updated_at ON public.manufacturing_workstations;
CREATE TRIGGER update_manufacturing_workstations_updated_at
  BEFORE UPDATE ON public.manufacturing_workstations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_manufacturing_orders_updated_at ON public.manufacturing_orders;
CREATE TRIGGER update_manufacturing_orders_updated_at
  BEFORE UPDATE ON public.manufacturing_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_manufacturing_order_items_updated_at ON public.manufacturing_order_items;
CREATE TRIGGER update_manufacturing_order_items_updated_at
  BEFORE UPDATE ON public.manufacturing_order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_manufacturing_order_materials_updated_at ON public.manufacturing_order_materials;
CREATE TRIGGER update_manufacturing_order_materials_updated_at
  BEFORE UPDATE ON public.manufacturing_order_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_manufacturing_operations_updated_at ON public.manufacturing_operations;
CREATE TRIGGER update_manufacturing_operations_updated_at
  BEFORE UPDATE ON public.manufacturing_operations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.manufacturing_workstations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_order_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manufacturing_workstations_company_all ON public.manufacturing_workstations;
CREATE POLICY manufacturing_workstations_company_all ON public.manufacturing_workstations
  FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS manufacturing_orders_company_all ON public.manufacturing_orders;
CREATE POLICY manufacturing_orders_company_all ON public.manufacturing_orders
  FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS manufacturing_order_items_company_all ON public.manufacturing_order_items;
CREATE POLICY manufacturing_order_items_company_all ON public.manufacturing_order_items
  FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS manufacturing_order_materials_company_all ON public.manufacturing_order_materials;
CREATE POLICY manufacturing_order_materials_company_all ON public.manufacturing_order_materials
  FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS manufacturing_operations_company_all ON public.manufacturing_operations;
CREATE POLICY manufacturing_operations_company_all ON public.manufacturing_operations
  FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS manufacturing_order_events_company_all ON public.manufacturing_order_events;
CREATE POLICY manufacturing_order_events_company_all ON public.manufacturing_order_events
  FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

INSERT INTO public.permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES ('manufacturing', 'Manage manufacturing orders and production floor execution', true, true, true, true)
ON CONFLICT (resource) WHERE deleted_at IS NULL DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id, can_view, can_create, can_edit, can_delete)
SELECT r.id, p.id, true, true, true, true
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.resource = 'manufacturing'
  AND r.name IN ('Super Admin', 'Admin')
  AND NOT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );

CREATE OR REPLACE FUNCTION public.ensure_default_manufacturing_workstations(
  p_company_id UUID,
  p_business_unit_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  INSERT INTO public.manufacturing_workstations (
    company_id,
    business_unit_id,
    workstation_code,
    workstation_name,
    description,
    sort_order,
    created_by,
    updated_by
  )
  VALUES
    (p_company_id, p_business_unit_id, 'CUTTING', 'Cutting', 'Cutting or chop station', 10, v_user_id, v_user_id),
    (p_company_id, p_business_unit_id, 'JOINING', 'Joining', 'Frame joining station', 20, v_user_id, v_user_id),
    (p_company_id, p_business_unit_id, 'ASSEMBLY', 'Assembly', 'Fit glass, backing, and accessories', 30, v_user_id, v_user_id),
    (p_company_id, p_business_unit_id, 'QC', 'Quality Check', 'Final inspection station', 40, v_user_id, v_user_id),
    (p_company_id, p_business_unit_id, 'READY', 'Ready', 'Ready for release or delivery', 50, v_user_id, v_user_id)
  ON CONFLICT (company_id, workstation_code) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_manufacturing_order_from_sales_order_transaction(
  p_sales_order_id UUID
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
  v_sales_order RECORD;
  v_existing RECORD;
  v_has_frame_items BOOLEAN;
  v_mo_id UUID;
  v_mo_code TEXT;
  v_order_item RECORD;
  v_mo_item_id UUID;
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
  INTO v_sales_order
  FROM public.sales_orders
  WHERE id = p_sales_order_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_sales_order.id IS NULL THEN
    RAISE EXCEPTION 'Sales order not found';
  END IF;

  IF v_sales_order.status NOT IN ('confirmed', 'in_progress') THEN
    RAISE EXCEPTION 'Only confirmed or in-progress sales orders can create manufacturing orders';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.manufacturing_orders
  WHERE sales_order_id = p_sales_order_id
    AND status <> 'cancelled'
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RAISE EXCEPTION 'This sales order already has a manufacturing order';
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
    RAISE EXCEPTION 'Sales order has no manufacturable items';
  END IF;

  PERFORM public.ensure_default_manufacturing_workstations(
    v_sales_order.company_id,
    v_sales_order.business_unit_id
  );

  SELECT id INTO v_cutting_id FROM public.manufacturing_workstations WHERE company_id = v_sales_order.company_id AND workstation_code = 'CUTTING' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_joining_id FROM public.manufacturing_workstations WHERE company_id = v_sales_order.company_id AND workstation_code = 'JOINING' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_assembly_id FROM public.manufacturing_workstations WHERE company_id = v_sales_order.company_id AND workstation_code = 'ASSEMBLY' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_qc_id FROM public.manufacturing_workstations WHERE company_id = v_sales_order.company_id AND workstation_code = 'QC' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_ready_id FROM public.manufacturing_workstations WHERE company_id = v_sales_order.company_id AND workstation_code = 'READY' AND deleted_at IS NULL LIMIT 1;

  INSERT INTO public.manufacturing_orders (
    company_id,
    business_unit_id,
    source_type,
    source_id,
    sales_order_id,
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
    v_sales_order.company_id,
    v_sales_order.business_unit_id,
    'sales_order',
    p_sales_order_id,
    p_sales_order_id,
    v_sales_order.quotation_id,
    v_sales_order.customer_id,
    'frame_service',
    'ready',
    'normal',
    v_sales_order.expected_delivery_date,
    v_cutting_id,
    v_sales_order.notes,
    jsonb_build_object('source', 'sales_order', 'salesOrderId', p_sales_order_id),
    v_user_id,
    v_user_id
  )
  RETURNING id, manufacturing_orders.manufacturing_order_code INTO v_mo_id, v_mo_code;

  FOR v_order_item IN
    SELECT soi.*
    FROM public.sales_order_items soi
    JOIN public.sales_order_item_configurations cfg ON cfg.order_item_id = soi.id
    WHERE soi.order_id = p_sales_order_id
      AND soi.deleted_at IS NULL
      AND cfg.deleted_at IS NULL
    ORDER BY soi.sort_order ASC NULLS LAST, soi.created_at ASC
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
    VALUES (
      v_sales_order.company_id,
      v_mo_id,
      v_order_item.id,
      v_order_item.item_id,
      v_order_item.item_description,
      v_order_item.quantity,
      v_order_item.uom_id,
      v_order_item.sort_order,
      v_user_id,
      v_user_id
    )
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
      uom_id,
      unit_rate,
      total_amount,
      sort_order,
      created_by,
      updated_by
    )
    SELECT
      v_sales_order.company_id,
      v_mo_id,
      v_mo_item_id,
      c.order_item_id,
      c.id,
      c.item_id,
      c.description,
      c.total_quantity,
      c.uom_id,
      c.unit_rate,
      c.total_amount,
      c.sort_order,
      v_user_id,
      v_user_id
    FROM public.sales_order_item_components c
    WHERE c.order_item_id = v_order_item.id
      AND c.deleted_at IS NULL
    ORDER BY c.sort_order ASC NULLS LAST, c.created_at ASC;
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
    (v_sales_order.company_id, v_mo_id, v_cutting_id, 'CUT', 'Cut molding', 'production', 'pending', 10, v_user_id, v_user_id),
    (v_sales_order.company_id, v_mo_id, v_joining_id, 'JOIN', 'Join frame', 'production', 'pending', 20, v_user_id, v_user_id),
    (v_sales_order.company_id, v_mo_id, v_assembly_id, 'ASSEMBLE', 'Fit materials', 'production', 'pending', 30, v_user_id, v_user_id),
    (v_sales_order.company_id, v_mo_id, v_qc_id, 'QC', 'Quality check', 'quality_check', 'pending', 40, v_user_id, v_user_id),
    (v_sales_order.company_id, v_mo_id, v_ready_id, 'READY', 'Ready for release', 'ready', 'pending', 50, v_user_id, v_user_id);

  INSERT INTO public.manufacturing_order_events (
    company_id,
    manufacturing_order_id,
    event_type,
    event_note,
    to_status,
    created_by
  )
  VALUES (
    v_sales_order.company_id,
    v_mo_id,
    'created',
    'Manufacturing order created from sales order',
    'ready',
    v_user_id
  );

  UPDATE public.sales_orders
  SET
    status = CASE WHEN status = 'confirmed' THEN 'in_progress' ELSE status END,
    updated_by = v_user_id
  WHERE id = p_sales_order_id;

  manufacturing_order_id := v_mo_id;
  manufacturing_order_code := v_mo_code;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_manufacturing_order_from_sales_order_transaction(
  p_sales_order_id UUID
)
RETURNS TABLE (
  manufacturing_order_id UUID,
  manufacturing_order_code TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Manufacturing orders must be pushed from job orders';
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

  RETURN p_manufacturing_order_id;
END;
$$;
