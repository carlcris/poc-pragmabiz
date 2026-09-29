BEGIN;

-- Frame job orders describe production demand. Warehouse inventory is owned by
-- a separate production material request so creating a job never checks or
-- reserves stock.
CREATE TABLE public.production_material_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_unit_id UUID NOT NULL REFERENCES public.business_units(id),
  frame_job_order_id UUID NOT NULL REFERENCES public.frame_job_orders(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  status TEXT NOT NULL DEFAULT 'draft',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id),
  issued_at TIMESTAMPTZ,
  issued_by UUID REFERENCES public.users(id),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL REFERENCES public.users(id),
  CONSTRAINT production_material_requests_status_check
    CHECK (status IN ('draft', 'approved', 'issued', 'cancelled'))
);

CREATE TABLE public.production_material_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  production_material_request_id UUID NOT NULL
    REFERENCES public.production_material_requests(id) ON DELETE CASCADE,
  frame_job_order_item_id UUID NOT NULL REFERENCES public.frame_job_order_items(id),
  item_id UUID NOT NULL REFERENCES public.items(id),
  requested_quantity NUMERIC(20,2) NOT NULL,
  issued_quantity NUMERIC(20,2) NOT NULL DEFAULT 0,
  uom_id UUID NOT NULL REFERENCES public.units_of_measure(id),
  base_quantity NUMERIC(20,2) NOT NULL,
  base_uom_id UUID NOT NULL REFERENCES public.units_of_measure(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL REFERENCES public.users(id),
  CONSTRAINT production_material_request_items_quantity_check
    CHECK (
      requested_quantity > 0
      AND issued_quantity >= 0
      AND issued_quantity <= requested_quantity
      AND base_quantity > 0
    ),
  UNIQUE (production_material_request_id, frame_job_order_item_id)
);

ALTER TABLE public.inventory_reservations
  ADD COLUMN production_material_request_id UUID
    REFERENCES public.production_material_requests(id) ON DELETE SET NULL,
  ADD COLUMN production_material_request_item_id UUID
    REFERENCES public.production_material_request_items(id) ON DELETE SET NULL,
  ADD CONSTRAINT inventory_reservations_production_material_request_ownership_check CHECK (
    production_material_request_id IS NULL
    OR (
      reservation_type = 'frame_job_order'
      AND production_material_request_item_id IS NOT NULL
      AND job_order_id IS NOT NULL
      AND source_type = 'production_material_request_item'
      AND source_id = production_material_request_item_id
    )
  );

CREATE UNIQUE INDEX production_material_requests_active_job_key
  ON public.production_material_requests(frame_job_order_id)
  WHERE status <> 'cancelled';

CREATE INDEX production_material_requests_job_history_idx
  ON public.production_material_requests(frame_job_order_id, created_at DESC);

CREATE INDEX production_material_requests_warehouse_status_idx
  ON public.production_material_requests(
    company_id,
    business_unit_id,
    warehouse_id,
    status,
    updated_at DESC
  );

CREATE INDEX production_material_request_items_request_idx
  ON public.production_material_request_items(production_material_request_id);

CREATE UNIQUE INDEX inventory_reservations_production_material_request_item_key
  ON public.inventory_reservations(production_material_request_item_id, warehouse_id)
  WHERE production_material_request_item_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE public.production_material_requests IS
  'Warehouse material requests for frame production. Draft records demand, approval reserves stock, and issue deducts stock.';
COMMENT ON COLUMN public.production_material_requests.status IS
  'Lifecycle: draft -> approved -> issued, or draft/approved -> cancelled.';
COMMENT ON TABLE public.production_material_request_items IS
  'Outstanding frame job material quantities captured when a production material request is created.';

ALTER TABLE public.production_material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_material_request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY production_material_requests_select
  ON public.production_material_requests
  FOR SELECT TO authenticated
  USING (
    company_id = (
      SELECT users.company_id
      FROM public.users
      WHERE users.id = (SELECT auth.uid())
    )
    AND business_unit_id IN (
      SELECT access_row.business_unit_id
      FROM public.user_business_unit_access access_row
      WHERE access_row.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY production_material_request_items_select
  ON public.production_material_request_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.production_material_requests request_row
      JOIN public.user_business_unit_access access_row
        ON access_row.business_unit_id = request_row.business_unit_id
       AND access_row.user_id = (SELECT auth.uid())
      WHERE request_row.id = production_material_request_items.production_material_request_id
        AND request_row.company_id = (
          SELECT users.company_id
          FROM public.users
          WHERE users.id = (SELECT auth.uid())
        )
    )
  );

GRANT SELECT ON public.production_material_requests TO authenticated;
GRANT SELECT ON public.production_material_request_items TO authenticated;

-- Existing active frame reservations were created at job creation. Release
-- them once so each unfinished job can enter the new request lifecycle.
WITH release_totals AS (
  SELECT
    reservation.company_id,
    reservation.warehouse_id,
    reservation.item_id,
    SUM(reservation.quantity) AS quantity
  FROM public.inventory_reservations reservation
  WHERE reservation.reservation_type = 'frame_job_order'
    AND reservation.status = 'active'
    AND reservation.production_material_request_id IS NULL
    AND reservation.deleted_at IS NULL
  GROUP BY reservation.company_id, reservation.warehouse_id, reservation.item_id
)
UPDATE public.item_warehouse stock
SET reserved_stock = GREATEST(0, COALESCE(stock.reserved_stock, 0) - release_totals.quantity),
    updated_at = NOW()
FROM release_totals
WHERE stock.company_id = release_totals.company_id
  AND stock.warehouse_id = release_totals.warehouse_id
  AND stock.item_id = release_totals.item_id
  AND stock.deleted_at IS NULL;

UPDATE public.inventory_reservations reservation
SET status = 'released',
    released_base = reservation.quantity,
    released_at = NOW(),
    updated_at = NOW()
WHERE reservation.reservation_type = 'frame_job_order'
  AND reservation.status = 'active'
  AND reservation.production_material_request_id IS NULL
  AND reservation.deleted_at IS NULL;

UPDATE public.manufacturing_order_materials material
SET material_status = CASE
      WHEN material.issued_quantity >= material.required_quantity THEN 'issued'
      ELSE 'required'
    END,
    updated_at = NOW()
FROM public.manufacturing_orders production_order
WHERE production_order.id = material.manufacturing_order_id
  AND production_order.frame_job_order_id IS NOT NULL
  AND production_order.deleted_at IS NULL
  AND material.deleted_at IS NULL;

DROP FUNCTION IF EXISTS public.create_frame_job_order_from_sales_order_transaction(UUID, UUID);

CREATE OR REPLACE FUNCTION public.create_frame_job_order_from_sales_order_transaction(
  p_sales_order_id UUID
)
RETURNS TABLE(job_order_id UUID, job_order_code TEXT, billing_mode TEXT)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sales_order RECORD;
  v_mode RECORD;
  v_job_order_id UUID;
  v_job_order_code TEXT;
  v_component RECORD;
  v_created INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id, company_id, business_unit_id, customer_id, status, notes
  INTO v_sales_order
  FROM public.sales_orders
  WHERE id = p_sales_order_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_sales_order.id IS NULL THEN
    RAISE EXCEPTION 'Sales order not found';
  END IF;

  IF v_sales_order.business_unit_id IS DISTINCT FROM public.get_current_business_unit_id()
     OR NOT public.user_has_permission(
       v_user_id,
       'sales_orders',
       'edit',
       v_sales_order.business_unit_id
     ) THEN
    RAISE EXCEPTION 'FRAME_JOB_ORDER_PERMISSION_DENIED';
  END IF;

  IF v_sales_order.status NOT IN ('confirmed', 'in_progress', 'invoiced') THEN
    RAISE EXCEPTION 'Only confirmed, in-progress, or invoiced sales orders can create frame job orders';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sales_order_item_configurations configuration
    JOIN public.sales_order_items order_item ON order_item.id = configuration.order_item_id
    WHERE order_item.order_id = p_sales_order_id
      AND order_item.deleted_at IS NULL
      AND configuration.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Sales order has no frame-configured items';
  END IF;

  FOR v_mode IN
    SELECT DISTINCT configuration.billing_mode
    FROM public.sales_order_item_configurations configuration
    JOIN public.sales_order_items order_item ON order_item.id = configuration.order_item_id
    WHERE order_item.order_id = p_sales_order_id
      AND order_item.deleted_at IS NULL
      AND configuration.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.frame_job_orders existing
        WHERE existing.sales_order_id = p_sales_order_id
          AND existing.billing_mode = configuration.billing_mode
          AND existing.status <> 'cancelled'
          AND existing.deleted_at IS NULL
      )
    ORDER BY configuration.billing_mode
  LOOP
    INSERT INTO public.frame_job_orders (
      company_id,
      business_unit_id,
      quotation_id,
      sales_order_id,
      customer_id,
      status,
      billing_mode,
      order_date,
      notes,
      created_by,
      updated_by
    )
    VALUES (
      v_sales_order.company_id,
      v_sales_order.business_unit_id,
      NULL,
      p_sales_order_id,
      v_sales_order.customer_id,
      'pending',
      v_mode.billing_mode,
      CURRENT_DATE,
      v_sales_order.notes,
      v_user_id,
      v_user_id
    )
    RETURNING id, frame_job_orders.job_order_code
    INTO v_job_order_id, v_job_order_code;

    FOR v_component IN
      SELECT
        component.id,
        component.order_item_id,
        component.quotation_component_id,
        component.item_id,
        component.description,
        component.total_quantity,
        component.uom_id,
        component.unit_rate,
        component.total_amount,
        item.is_stock_item
      FROM public.sales_order_item_components component
      JOIN public.sales_order_items order_item ON order_item.id = component.order_item_id
      JOIN public.sales_order_item_configurations configuration
        ON configuration.id = component.configuration_id
      JOIN public.items item ON item.id = component.item_id
      WHERE order_item.order_id = p_sales_order_id
        AND order_item.deleted_at IS NULL
        AND component.deleted_at IS NULL
        AND configuration.deleted_at IS NULL
        AND item.deleted_at IS NULL
        AND configuration.billing_mode = v_mode.billing_mode
      ORDER BY order_item.sort_order ASC NULLS LAST,
        configuration.size_index ASC,
        component.sort_order ASC
    LOOP
      INSERT INTO public.frame_job_order_items (
        company_id,
        job_order_id,
        sales_order_item_id,
        sales_order_component_id,
        quotation_component_id,
        item_id,
        item_description,
        required_quantity,
        issued_quantity,
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
        ROUND(v_component.total_quantity, 2),
        CASE WHEN v_component.is_stock_item THEN 0 ELSE ROUND(v_component.total_quantity, 2) END,
        v_component.uom_id,
        v_component.unit_rate,
        v_component.total_amount,
        v_user_id,
        v_user_id
      );
    END LOOP;

    v_created := v_created + 1;
    job_order_id := v_job_order_id;
    job_order_code := v_job_order_code;
    billing_mode := v_mode.billing_mode;
    RETURN NEXT;
  END LOOP;

  IF v_created = 0 THEN
    RAISE EXCEPTION 'This sales order already has a frame job order for every billing mode';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.create_frame_job_order_from_sales_order_transaction(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_frame_job_order_from_sales_order_transaction(UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.create_production_material_request_transaction(
  p_frame_job_order_id UUID,
  p_warehouse_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_company_id UUID;
  v_business_unit_id UUID := public.get_current_business_unit_id();
  v_job_order RECORD;
  v_request_id UUID;
  v_created_count INTEGER;
BEGIN
  SELECT user_row.company_id
  INTO v_company_id
  FROM public.users user_row
  WHERE user_row.id = v_actor_id
    AND user_row.is_active IS TRUE
    AND user_row.deleted_at IS NULL;

  IF v_actor_id IS NULL OR v_company_id IS NULL OR v_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_CONTEXT_INVALID';
  END IF;

  IF NOT public.user_has_permission(v_actor_id, 'stock_requests', 'create', v_business_unit_id) THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_PERMISSION_DENIED';
  END IF;

  IF p_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_WAREHOUSE_REQUIRED';
  END IF;

  SELECT job_order.id, job_order.company_id, job_order.business_unit_id, job_order.status
  INTO v_job_order
  FROM public.frame_job_orders job_order
  WHERE job_order.id = p_frame_job_order_id
    AND job_order.company_id = v_company_id
    AND job_order.business_unit_id = v_business_unit_id
    AND job_order.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_JOB_NOT_FOUND';
  END IF;

  IF v_job_order.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_JOB_CLOSED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.production_material_requests request_row
    WHERE request_row.frame_job_order_id = p_frame_job_order_id
      AND request_row.status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_ACTIVE_EXISTS';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.warehouses warehouse
    WHERE warehouse.id = p_warehouse_id
      AND warehouse.company_id = v_company_id
      AND warehouse.business_unit_id = v_business_unit_id
      AND warehouse.is_active IS TRUE
      AND warehouse.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_WAREHOUSE_INVALID';
  END IF;

  -- Lock the item definitions until demand has been captured. Never turn an
  -- unavailable material into an apparently complete, smaller request.
  PERFORM item.id
  FROM public.frame_job_order_items job_item
  JOIN public.items item ON item.id = job_item.item_id
  WHERE job_item.job_order_id = p_frame_job_order_id
    AND job_item.required_quantity > job_item.issued_quantity
    AND job_item.deleted_at IS NULL
  ORDER BY item.id
  FOR SHARE OF item;

  IF EXISTS (
    SELECT 1
    FROM public.frame_job_order_items job_item
    JOIN public.items item ON item.id = job_item.item_id
    WHERE job_item.job_order_id = p_frame_job_order_id
      AND job_item.required_quantity > job_item.issued_quantity
      AND job_item.deleted_at IS NULL
      AND (item.company_id IS DISTINCT FROM v_company_id
        OR item.is_active IS NOT TRUE OR item.deleted_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_MATERIAL_UNAVAILABLE';
  END IF;

  INSERT INTO public.production_material_requests (
    company_id,
    business_unit_id,
    frame_job_order_id,
    warehouse_id,
    status,
    created_by,
    updated_by
  )
  VALUES (
    v_company_id,
    v_business_unit_id,
    p_frame_job_order_id,
    p_warehouse_id,
    'draft',
    v_actor_id,
    v_actor_id
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.production_material_request_items (
    company_id,
    production_material_request_id,
    frame_job_order_item_id,
    item_id,
    requested_quantity,
    issued_quantity,
    uom_id,
    base_quantity,
    base_uom_id,
    created_by,
    updated_by
  )
  SELECT
    v_company_id,
    v_request_id,
    job_item.id,
    job_item.item_id,
    ROUND(job_item.required_quantity - job_item.issued_quantity, 2),
    0,
    job_item.uom_id,
    -- Frame component quantities are already expressed in the inventory unit
    -- consumed by production. The CUT unit is a billing/display unit and does
    -- not require an item-unit conversion to reserve the underlying material.
    ROUND(job_item.required_quantity - job_item.issued_quantity, 2),
    item.uom_id,
    v_actor_id,
    v_actor_id
  FROM public.frame_job_order_items job_item
  JOIN public.items item
    ON item.id = job_item.item_id
   AND item.company_id = v_company_id
   AND item.is_stock_item IS TRUE
   AND item.is_active IS TRUE
   AND item.deleted_at IS NULL
  WHERE job_item.job_order_id = p_frame_job_order_id
    AND job_item.required_quantity > job_item.issued_quantity
    AND job_item.deleted_at IS NULL;

  GET DIAGNOSTICS v_created_count = ROW_COUNT;
  IF v_created_count = 0 THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_NO_OUTSTANDING_MATERIALS';
  END IF;

  IF v_created_count > 500 THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_TOO_LARGE';
  END IF;

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_production_material_request_transaction(
  p_frame_job_order_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_company_id UUID;
  v_business_unit_id UUID := public.get_current_business_unit_id();
  v_request RECORD;
  v_line RECORD;
  v_stock RECORD;
BEGIN
  SELECT user_row.company_id INTO v_company_id
  FROM public.users user_row
  WHERE user_row.id = v_actor_id
    AND user_row.is_active IS TRUE
    AND user_row.deleted_at IS NULL;

  IF v_actor_id IS NULL OR v_company_id IS NULL OR v_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_CONTEXT_INVALID';
  END IF;

  IF NOT public.user_has_permission(v_actor_id, 'stock_requests', 'edit', v_business_unit_id) THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_PERMISSION_DENIED';
  END IF;

  -- Share the job lock with production creation and completion before locking
  -- its request, so issue cannot race a material snapshot or a closed job.
  PERFORM job_order.id
  FROM public.frame_job_orders job_order
  WHERE job_order.id = p_frame_job_order_id
    AND job_order.company_id = v_company_id
    AND job_order.business_unit_id = v_business_unit_id
    AND job_order.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_JOB_NOT_FOUND';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.frame_job_orders job_order
    WHERE job_order.id = p_frame_job_order_id
      AND job_order.status IN ('completed', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_JOB_CLOSED';
  END IF;

  SELECT request_row.id, request_row.warehouse_id, request_row.status
  INTO v_request
  FROM public.production_material_requests request_row
  WHERE request_row.frame_job_order_id = p_frame_job_order_id
    AND request_row.company_id = v_company_id
    AND request_row.business_unit_id = v_business_unit_id
    AND request_row.status <> 'cancelled'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_NOT_FOUND';
  END IF;

  IF v_request.status <> 'draft' THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_STATUS_CHANGED';
  END IF;

  FOR v_line IN
    SELECT request_item.id,
           request_item.frame_job_order_item_id,
           request_item.item_id,
           request_item.base_quantity,
           request_item.base_uom_id
    FROM public.production_material_request_items request_item
    WHERE request_item.production_material_request_id = v_request.id
    ORDER BY request_item.item_id, request_item.id
  LOOP
    SELECT stock.id, stock.current_stock, stock.reserved_stock
    INTO v_stock
    FROM public.item_warehouse stock
    WHERE stock.company_id = v_company_id
      AND stock.item_id = v_line.item_id
      AND stock.warehouse_id = v_request.warehouse_id
      AND stock.is_active IS TRUE
      AND stock.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_STOCK_UNAVAILABLE';
    END IF;

    IF COALESCE(v_stock.current_stock, 0) - COALESCE(v_stock.reserved_stock, 0)
       < v_line.base_quantity THEN
      RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_INSUFFICIENT_STOCK';
    END IF;

    INSERT INTO public.inventory_reservations (
      company_id,
      business_unit_id,
      reservation_type,
      source_type,
      source_id,
      job_order_id,
      production_material_request_id,
      production_material_request_item_id,
      item_id,
      warehouse_id,
      quantity,
      uom_id,
      status,
      created_by,
      updated_by
    )
    VALUES (
      v_company_id,
      v_business_unit_id,
      'frame_job_order',
      'production_material_request_item',
      v_line.id,
      p_frame_job_order_id,
      v_request.id,
      v_line.id,
      v_line.item_id,
      v_request.warehouse_id,
      v_line.base_quantity,
      v_line.base_uom_id,
      'active',
      v_actor_id,
      v_actor_id
    );

    UPDATE public.item_warehouse stock
    SET reserved_stock = COALESCE(stock.reserved_stock, 0) + v_line.base_quantity,
        updated_by = v_actor_id,
        updated_at = NOW()
    WHERE stock.id = v_stock.id;

    UPDATE public.manufacturing_order_materials material
    SET material_status = 'reserved',
        updated_by = v_actor_id,
        updated_at = NOW()
    FROM public.manufacturing_orders production_order,
         public.frame_job_order_items job_item
    WHERE production_order.id = material.manufacturing_order_id
      AND production_order.frame_job_order_id = p_frame_job_order_id
      AND job_item.id = v_line.frame_job_order_item_id
      AND material.sales_order_component_id = job_item.sales_order_component_id
      AND material.deleted_at IS NULL;
  END LOOP;

  UPDATE public.production_material_requests
  SET status = 'approved',
      approved_at = NOW(),
      approved_by = v_actor_id,
      updated_at = NOW(),
      updated_by = v_actor_id
  WHERE id = v_request.id;

  RETURN v_request.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_production_material_request_transaction(
  p_frame_job_order_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_company_id UUID;
  v_business_unit_id UUID := public.get_current_business_unit_id();
  v_request RECORD;
  v_line RECORD;
  v_stock RECORD;
  v_stock_transaction_id UUID;
  v_next_stock NUMERIC(20,2);
BEGIN
  SELECT user_row.company_id INTO v_company_id
  FROM public.users user_row
  WHERE user_row.id = v_actor_id
    AND user_row.is_active IS TRUE
    AND user_row.deleted_at IS NULL;

  IF v_actor_id IS NULL OR v_company_id IS NULL OR v_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_CONTEXT_INVALID';
  END IF;

  IF NOT public.user_has_permission(v_actor_id, 'stock_requests', 'edit', v_business_unit_id) THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_PERMISSION_DENIED';
  END IF;

  -- Share the job lock with production creation and completion before locking
  -- its request, so issue cannot race a material snapshot or a closed job.
  PERFORM job_order.id
  FROM public.frame_job_orders job_order
  WHERE job_order.id = p_frame_job_order_id
    AND job_order.company_id = v_company_id
    AND job_order.business_unit_id = v_business_unit_id
    AND job_order.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_JOB_NOT_FOUND';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.frame_job_orders job_order
    WHERE job_order.id = p_frame_job_order_id
      AND job_order.status IN ('completed', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_JOB_CLOSED';
  END IF;

  SELECT request_row.id, request_row.warehouse_id, request_row.status
  INTO v_request
  FROM public.production_material_requests request_row
  WHERE request_row.frame_job_order_id = p_frame_job_order_id
    AND request_row.company_id = v_company_id
    AND request_row.business_unit_id = v_business_unit_id
    AND request_row.status <> 'cancelled'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_NOT_FOUND';
  END IF;

  IF v_request.status <> 'approved' THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_STATUS_CHANGED';
  END IF;

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
    v_company_id,
    v_business_unit_id,
    CURRENT_DATE,
    'out',
    'frame_job_order',
    p_frame_job_order_id,
    v_request.warehouse_id,
    'posted',
    'Materials issued to frame production',
    jsonb_build_object(
      'frameJobOrderId', p_frame_job_order_id,
      'productionMaterialRequestId', v_request.id
    ),
    v_actor_id,
    v_actor_id
  )
  RETURNING id INTO v_stock_transaction_id;

  FOR v_line IN
    SELECT request_item.id,
           request_item.frame_job_order_item_id,
           request_item.item_id,
           request_item.requested_quantity,
           request_item.uom_id,
           request_item.base_quantity,
           request_item.base_uom_id,
           reservation.id AS reservation_id
    FROM public.production_material_request_items request_item
    JOIN public.inventory_reservations reservation
      ON reservation.production_material_request_item_id = request_item.id
     AND reservation.status = 'active'
     AND reservation.deleted_at IS NULL
    WHERE request_item.production_material_request_id = v_request.id
    ORDER BY request_item.item_id, request_item.id
  LOOP
    SELECT stock.id, stock.current_stock, stock.reserved_stock
    INTO v_stock
    FROM public.item_warehouse stock
    WHERE stock.company_id = v_company_id
      AND stock.item_id = v_line.item_id
      AND stock.warehouse_id = v_request.warehouse_id
      AND stock.is_active IS TRUE
      AND stock.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_STOCK_UNAVAILABLE';
    END IF;

    IF COALESCE(v_stock.current_stock, 0) < v_line.base_quantity THEN
      RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_INSUFFICIENT_STOCK';
    END IF;

    v_next_stock := ROUND(COALESCE(v_stock.current_stock, 0) - v_line.base_quantity, 2);

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
      v_company_id,
      v_stock_transaction_id,
      v_line.item_id,
      v_line.base_quantity,
      v_line.base_uom_id,
      0,
      0,
      COALESCE(v_stock.current_stock, 0),
      v_next_stock,
      0,
      0,
      0,
      CURRENT_DATE,
      CURRENT_TIME,
      'Issued to frame production',
      v_actor_id,
      v_actor_id
    );

    UPDATE public.item_warehouse stock
    SET current_stock = v_next_stock,
        reserved_stock = GREATEST(0, COALESCE(stock.reserved_stock, 0) - v_line.base_quantity),
        updated_by = v_actor_id,
        updated_at = NOW()
    WHERE stock.id = v_stock.id;

    UPDATE public.inventory_reservations
    SET status = 'consumed',
        consumed_base = v_line.base_quantity,
        consumed_at = NOW(),
        updated_by = v_actor_id,
        updated_at = NOW()
    WHERE id = v_line.reservation_id;

    UPDATE public.production_material_request_items
    SET issued_quantity = v_line.requested_quantity,
        updated_by = v_actor_id,
        updated_at = NOW()
    WHERE id = v_line.id;

    UPDATE public.frame_job_order_items job_item
    SET issued_quantity = LEAST(
          job_item.required_quantity,
          job_item.issued_quantity + v_line.requested_quantity
        ),
        updated_by = v_actor_id,
        updated_at = NOW()
    WHERE job_item.id = v_line.frame_job_order_item_id;

    UPDATE public.manufacturing_order_materials material
    SET issued_quantity = LEAST(
          material.required_quantity,
          material.issued_quantity + v_line.requested_quantity
        ),
        material_status = CASE
          WHEN material.issued_quantity + v_line.requested_quantity >= material.required_quantity
            THEN 'issued'
          ELSE 'short'
        END,
        updated_by = v_actor_id,
        updated_at = NOW()
    FROM public.manufacturing_orders production_order,
         public.frame_job_order_items job_item
    WHERE production_order.id = material.manufacturing_order_id
      AND production_order.frame_job_order_id = p_frame_job_order_id
      AND job_item.id = v_line.frame_job_order_item_id
      AND material.sales_order_component_id = job_item.sales_order_component_id
      AND material.deleted_at IS NULL;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.production_material_request_items request_item
    WHERE request_item.production_material_request_id = v_request.id
      AND request_item.issued_quantity < request_item.requested_quantity
  ) THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_RESERVATION_MISSING';
  END IF;

  UPDATE public.production_material_requests
  SET status = 'issued',
      issued_at = NOW(),
      issued_by = v_actor_id,
      updated_at = NOW(),
      updated_by = v_actor_id
  WHERE id = v_request.id;

  RETURN v_request.id;
END;
$$;

-- Internal release operation shared by request cancellation and job completion.
-- Callers authorize the operation and hold the frame-job lock first.
CREATE OR REPLACE FUNCTION public.close_unissued_production_material_request(
  p_frame_job_order_id UUID,
  p_actor_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := p_actor_id;
  v_company_id UUID;
  v_request RECORD;
  v_reservation RECORD;
BEGIN
  SELECT request_row.id, request_row.company_id
  INTO v_request
  FROM public.production_material_requests request_row
  WHERE request_row.frame_job_order_id = p_frame_job_order_id
    AND request_row.status IN ('draft', 'approved')
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  v_company_id := v_request.company_id;

  FOR v_reservation IN
    SELECT reservation.id,
           reservation.item_id,
           reservation.warehouse_id,
           reservation.quantity
    FROM public.inventory_reservations reservation
    WHERE reservation.production_material_request_id = v_request.id
      AND reservation.status = 'active'
      AND reservation.deleted_at IS NULL
    ORDER BY reservation.item_id, reservation.id
  LOOP
    UPDATE public.item_warehouse stock
    SET reserved_stock = COALESCE(stock.reserved_stock, 0) - v_reservation.quantity,
        updated_by = v_actor_id,
        updated_at = NOW()
    WHERE stock.company_id = v_company_id
      AND stock.warehouse_id = v_reservation.warehouse_id
      AND stock.item_id = v_reservation.item_id
      AND COALESCE(stock.reserved_stock, 0) >= v_reservation.quantity
      AND stock.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_STOCK_UNAVAILABLE';
    END IF;

    UPDATE public.inventory_reservations
    SET status = 'released',
        released_base = v_reservation.quantity,
        released_at = NOW(),
        updated_by = v_actor_id,
        updated_at = NOW()
    WHERE id = v_reservation.id;
  END LOOP;

  UPDATE public.manufacturing_order_materials material
  SET material_status = CASE
        WHEN material.issued_quantity >= material.required_quantity THEN 'issued'
        ELSE 'required'
      END,
      updated_by = v_actor_id,
      updated_at = NOW()
  FROM public.manufacturing_orders production_order
  WHERE production_order.id = material.manufacturing_order_id
    AND production_order.frame_job_order_id = p_frame_job_order_id
    AND material.deleted_at IS NULL;

  UPDATE public.production_material_requests
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancelled_by = v_actor_id,
      updated_at = NOW(),
      updated_by = v_actor_id
  WHERE id = v_request.id;

END;
$$;

REVOKE ALL ON FUNCTION public.close_unissued_production_material_request(UUID, UUID)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancel_production_material_request_transaction(
  p_frame_job_order_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_company_id UUID;
  v_business_unit_id UUID := public.get_current_business_unit_id();
  v_request RECORD;
BEGIN
  SELECT user_row.company_id INTO v_company_id
  FROM public.users user_row
  WHERE user_row.id = v_actor_id
    AND user_row.is_active IS TRUE
    AND user_row.deleted_at IS NULL;

  IF v_actor_id IS NULL OR v_company_id IS NULL OR v_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_CONTEXT_INVALID';
  END IF;

  IF NOT public.user_has_permission(v_actor_id, 'stock_requests', 'edit', v_business_unit_id) THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_PERMISSION_DENIED';
  END IF;

  -- Share the job lock with production creation and completion before locking
  -- its request, so issue cannot race a material snapshot or a closed job.
  PERFORM job_order.id
  FROM public.frame_job_orders job_order
  WHERE job_order.id = p_frame_job_order_id
    AND job_order.company_id = v_company_id
    AND job_order.business_unit_id = v_business_unit_id
    AND job_order.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_JOB_NOT_FOUND';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.frame_job_orders job_order
    WHERE job_order.id = p_frame_job_order_id
      AND job_order.status IN ('completed', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_JOB_CLOSED';
  END IF;

  SELECT request_row.id, request_row.status
  INTO v_request
  FROM public.production_material_requests request_row
  WHERE request_row.frame_job_order_id = p_frame_job_order_id
    AND request_row.company_id = v_company_id
    AND request_row.business_unit_id = v_business_unit_id
    AND request_row.status <> 'cancelled'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_NOT_FOUND';
  END IF;

  IF v_request.status NOT IN ('draft', 'approved') THEN
    RAISE EXCEPTION 'PRODUCTION_MATERIAL_REQUEST_STATUS_CHANGED';
  END IF;

  PERFORM public.close_unissued_production_material_request(p_frame_job_order_id, v_actor_id);
  RETURN v_request.id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_production_material_request_transaction(UUID, UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_production_material_request_transaction(UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.issue_production_material_request_transaction(UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_production_material_request_transaction(UUID)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_production_material_request_transaction(UUID, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_production_material_request_transaction(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_production_material_request_transaction(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_production_material_request_transaction(UUID)
  TO authenticated;

-- New manufacturing materials start as required. Approval is the only event
-- that may move them to reserved.
CREATE OR REPLACE FUNCTION public.normalize_frame_manufacturing_material_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.issued_quantity < NEW.required_quantity
     AND EXISTS (
       SELECT 1
       FROM public.manufacturing_orders production_order
       WHERE production_order.id = NEW.manufacturing_order_id
         AND production_order.frame_job_order_id IS NOT NULL
         AND production_order.deleted_at IS NULL
     ) THEN
    NEW.material_status := 'required';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER normalize_frame_manufacturing_material_insert
  BEFORE INSERT ON public.manufacturing_order_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_frame_manufacturing_material_insert();

-- Residual materials may satisfy production demand. Starting and completing
-- production therefore do not require a material request or full warehouse issue.
-- Completion closes unissued requests and releases commitments, never stock.
CREATE OR REPLACE FUNCTION public.finalize_frame_job_order_completion_transaction(
  p_job_order_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  v_business_unit_id UUID := public.get_current_business_unit_id();
  v_job_order RECORD;
BEGIN
  SELECT user_row.company_id INTO v_company_id
  FROM public.users user_row
  WHERE user_row.id = v_user_id
    AND user_row.is_active IS TRUE
    AND user_row.deleted_at IS NULL;

  IF v_user_id IS NULL OR v_company_id IS NULL OR v_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_business_unit_access access_row
    WHERE access_row.user_id = v_user_id
      AND access_row.business_unit_id = v_business_unit_id
  ) OR NOT (
    public.user_has_permission(v_user_id, 'manufacturing', 'edit', v_business_unit_id)
    OR public.user_has_permission(v_user_id, 'stock_transformations', 'edit', v_business_unit_id)
  ) THEN
    RAISE EXCEPTION 'FRAME_JOB_ORDER_PERMISSION_DENIED';
  END IF;

  SELECT job_order.id, job_order.status
  INTO v_job_order
  FROM public.frame_job_orders job_order
  WHERE job_order.id = p_job_order_id
    AND job_order.company_id = v_company_id
    AND job_order.business_unit_id = v_business_unit_id
    AND job_order.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
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
  IF NOT EXISTS (
    SELECT 1 FROM public.manufacturing_orders production_order
    WHERE production_order.frame_job_order_id = p_job_order_id
      AND production_order.company_id = v_company_id
      AND production_order.business_unit_id = v_business_unit_id
      AND production_order.status = 'completed'
      AND production_order.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Production must be completed before the job order can be completed';
  END IF;

  PERFORM public.close_unissued_production_material_request(p_job_order_id, v_user_id);

  UPDATE public.frame_job_orders
  SET status = 'completed',
      completed_at = COALESCE(completed_at, NOW()),
      updated_by = v_user_id,
      updated_at = NOW()
  WHERE id = p_job_order_id;

  RETURN p_job_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_frame_job_order_completion_transaction(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_frame_job_order_completion_transaction(UUID)
  TO authenticated;

-- The latest floor-action RPC writes manufacturing status directly. Keep both
-- bulk completion and the final complete_step in the same transaction as the
-- frame-job transition and reservation release. Scope strictly to this job:
-- sibling jobs belonging to the same sales order remain independent.
CREATE OR REPLACE FUNCTION public.sync_frame_job_order_production_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job_status TEXT;
BEGIN
  IF NEW.frame_job_order_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'completed' THEN
    PERFORM public.finalize_frame_job_order_completion_transaction(NEW.frame_job_order_id);
  ELSE
    v_job_status := CASE
      WHEN NEW.status IN ('ready', 'queued') THEN 'queued'
      WHEN NEW.status IN ('in_progress', 'quality_check') THEN 'in_progress'
      WHEN NEW.status = 'on_hold' THEN 'on_hold'
      ELSE NULL
    END;
    IF v_job_status IS NOT NULL THEN
      UPDATE public.frame_job_orders
      SET status = v_job_status, updated_by = auth.uid(), updated_at = NOW()
      WHERE id = NEW.frame_job_order_id
        AND deleted_at IS NULL
        AND status NOT IN ('completed', 'cancelled');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_frame_job_order_production_status
  AFTER UPDATE OF status ON public.manufacturing_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_frame_job_order_production_status();

COMMIT;
