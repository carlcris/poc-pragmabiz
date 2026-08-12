BEGIN;

ALTER TABLE public.inventory_reservations
  DROP CONSTRAINT chk_inventory_reservation_type,
  DROP CONSTRAINT chk_inventory_reservation_qty,
  DROP CONSTRAINT inventory_reservations_effective_quantity_check,
  DROP COLUMN active_quantity_base,
  ADD COLUMN transformation_order_id UUID
    REFERENCES public.transformation_orders(id) ON DELETE CASCADE,
  ADD COLUMN transformation_order_input_id UUID
    REFERENCES public.transformation_order_inputs(id) ON DELETE CASCADE,
  ADD CONSTRAINT chk_inventory_reservation_type CHECK (
    reservation_type IN (
      'frame_job_order',
      'delivery_note',
      'sales_order',
      'transformation_order'
    )
  ),
  ADD CONSTRAINT chk_inventory_reservation_qty CHECK (quantity >= 0),
  ADD CONSTRAINT inventory_reservations_effective_quantity_check CHECK (
    quantity + transferred_in_base >=
      transferred_out_base + consumed_base + released_base
  ),
  ADD CONSTRAINT inventory_reservations_sales_order_ownership_check CHECK (
    reservation_type <> 'sales_order'
    OR (
      business_unit_id IS NOT NULL
      AND sales_order_id IS NOT NULL
      AND sales_order_item_id IS NOT NULL
      AND source_type = 'sales_order_item'
      AND source_id = sales_order_item_id
    )
  ),
  ADD CONSTRAINT inventory_reservations_transformation_ownership_check CHECK (
    reservation_type <> 'transformation_order'
    OR (
      business_unit_id IS NOT NULL
      AND transformation_order_id IS NOT NULL
      AND transformation_order_input_id IS NOT NULL
      AND source_type = 'transformation_order_input'
      AND source_id = transformation_order_input_id
    )
  ),
  ADD COLUMN active_quantity_base NUMERIC(20,2) GENERATED ALWAYS AS (
    CASE
      WHEN reservation_type = 'frame_job_order' THEN
        CASE WHEN status = 'active' THEN quantity ELSE 0 END
      ELSE quantity + transferred_in_base - transferred_out_base - consumed_base - released_base
    END
  ) STORED;

CREATE UNIQUE INDEX inventory_reservations_sales_order_item_warehouse_key
  ON public.inventory_reservations (sales_order_item_id, warehouse_id)
  WHERE reservation_type = 'sales_order' AND deleted_at IS NULL;

CREATE UNIQUE INDEX inventory_reservations_transformation_input_warehouse_key
  ON public.inventory_reservations (transformation_order_input_id, warehouse_id)
  WHERE reservation_type = 'transformation_order' AND deleted_at IS NULL;

CREATE INDEX inventory_reservations_source_page_idx
  ON public.inventory_reservations (
    company_id,
    business_unit_id,
    reservation_type,
    updated_at DESC,
    id
  )
  WHERE deleted_at IS NULL;

ALTER TABLE public.inventory_reservation_allocations
  ALTER COLUMN pick_list_id DROP NOT NULL,
  ALTER COLUMN pick_list_item_id DROP NOT NULL,
  ADD COLUMN transformation_order_id UUID
    REFERENCES public.transformation_orders(id) ON DELETE CASCADE,
  ADD COLUMN transformation_order_input_id UUID
    REFERENCES public.transformation_order_inputs(id) ON DELETE CASCADE,
  ADD CONSTRAINT inventory_reservation_allocations_owner_check CHECK (
    (
      pick_list_id IS NOT NULL
      AND pick_list_item_id IS NOT NULL
      AND transformation_order_id IS NULL
      AND transformation_order_input_id IS NULL
    )
    OR (
      pick_list_id IS NULL
      AND pick_list_item_id IS NULL
      AND transformation_order_id IS NOT NULL
      AND transformation_order_input_id IS NOT NULL
    )
  );

CREATE UNIQUE INDEX inventory_reservation_allocations_transformation_source_key
  ON public.inventory_reservation_allocations (
    transformation_order_input_id,
    item_batch_location_id
  )
  WHERE transformation_order_input_id IS NOT NULL;

CREATE INDEX inventory_reservation_allocations_transformation_owner_idx
  ON public.inventory_reservation_allocations (
    company_id,
    business_unit_id,
    transformation_order_id
  )
  WHERE transformation_order_id IS NOT NULL;

ALTER TABLE public.sales_orders
  ADD COLUMN fulfilling_warehouse_id UUID REFERENCES public.warehouses(id);

CREATE INDEX sales_orders_fulfilling_warehouse_idx
  ON public.sales_orders (company_id, business_unit_id, fulfilling_warehouse_id)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.sales_orders.fulfilling_warehouse_id IS
  'Warehouse that owns ordinary inventory commitments for this sales order.';

COMMENT ON TABLE public.inventory_reservations IS
  'Source-neutral warehouse commitments for delivery notes, sales orders, transformations, and frame job orders.';
COMMENT ON TABLE public.inventory_reservation_allocations IS
  'Exact batch-location allocations owned by either a pick-list line or a transformation input line.';

DROP INDEX IF EXISTS public.inventory_reservations_ledger_page_idx;

DROP POLICY inventory_reservations_select ON public.inventory_reservations;
CREATE POLICY inventory_reservations_select
  ON public.inventory_reservations
  FOR SELECT TO authenticated
  USING (
    company_id = (SELECT users.company_id FROM public.users WHERE users.id = auth.uid())
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_business_unit_access access_row
        WHERE access_row.user_id = auth.uid()
          AND access_row.business_unit_id = inventory_reservations.business_unit_id
      )
      OR (
        inventory_reservations.reservation_type = 'frame_job_order'
        AND EXISTS (
          SELECT 1
          FROM public.frame_job_orders job_order
          JOIN public.user_business_unit_access access_row
            ON access_row.business_unit_id = job_order.business_unit_id
           AND access_row.user_id = auth.uid()
          WHERE job_order.id = inventory_reservations.job_order_id
        )
      )
    )
  );

CREATE OR REPLACE FUNCTION public.inventory_base_quantity(
  p_company_id UUID,
  p_item_id UUID,
  p_uom_id UUID,
  p_quantity NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_base_uom_id UUID;
  v_qty_per_unit NUMERIC;
BEGIN
  IF COALESCE(p_quantity, 0) < 0 THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_INVALID_QUANTITY';
  END IF;

  SELECT item.uom_id
  INTO v_base_uom_id
  FROM public.items item
  WHERE item.id = p_item_id
    AND item.company_id = p_company_id
    AND item.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_ITEM_UNAVAILABLE';
  END IF;

  IF p_uom_id = v_base_uom_id THEN
    RETURN ROUND(p_quantity, 2);
  END IF;

  SELECT unit_option.qty_per_unit
  INTO v_qty_per_unit
  FROM public.item_unit_options unit_option
  WHERE unit_option.company_id = p_company_id
    AND unit_option.item_id = p_item_id
    AND unit_option.uom_id = p_uom_id
    AND unit_option.is_active IS TRUE
    AND unit_option.deleted_at IS NULL
  ORDER BY unit_option.is_default DESC, unit_option.sort_order, unit_option.id
  LIMIT 1;

  IF v_qty_per_unit IS NULL THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_UNIT_CONVERSION_MISSING';
  END IF;

  RETURN ROUND(p_quantity * v_qty_per_unit, 2);
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_base_quantity(UUID, UUID, UUID, NUMERIC)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_warehouse_inventory_commitment(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_reservation_type TEXT,
  p_source_type TEXT,
  p_source_id UUID,
  p_item_id UUID,
  p_warehouse_id UUID,
  p_quantity_base NUMERIC,
  p_uom_id UUID,
  p_actor_id UUID,
  p_sales_order_id UUID DEFAULT NULL,
  p_sales_order_item_id UUID DEFAULT NULL,
  p_transformation_order_id UUID DEFAULT NULL,
  p_transformation_order_input_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stock RECORD;
  v_reservation_id UUID;
BEGIN
  IF p_reservation_type NOT IN ('sales_order', 'transformation_order')
     OR COALESCE(p_quantity_base, 0) <= 0 THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_INVALID_COMMITMENT';
  END IF;

  SELECT stock.id, stock.current_stock, stock.reserved_stock
  INTO v_stock
  FROM public.item_warehouse stock
  JOIN public.warehouses warehouse
    ON warehouse.id = stock.warehouse_id
   AND warehouse.company_id = p_company_id
   AND warehouse.business_unit_id = p_business_unit_id
   AND warehouse.is_active IS TRUE
   AND warehouse.deleted_at IS NULL
  WHERE stock.company_id = p_company_id
    AND stock.item_id = p_item_id
    AND stock.warehouse_id = p_warehouse_id
    AND stock.is_active IS TRUE
    AND stock.deleted_at IS NULL
  FOR UPDATE OF stock;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_STOCK_UNAVAILABLE';
  END IF;

  IF COALESCE(v_stock.current_stock, 0) - COALESCE(v_stock.reserved_stock, 0)
      < p_quantity_base THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_INSUFFICIENT_STOCK';
  END IF;

  INSERT INTO public.inventory_reservations (
    company_id,
    business_unit_id,
    reservation_type,
    source_type,
    source_id,
    sales_order_id,
    sales_order_item_id,
    transformation_order_id,
    transformation_order_input_id,
    item_id,
    warehouse_id,
    quantity,
    uom_id,
    status,
    created_by,
    updated_by
  ) VALUES (
    p_company_id,
    p_business_unit_id,
    p_reservation_type,
    p_source_type,
    p_source_id,
    p_sales_order_id,
    p_sales_order_item_id,
    p_transformation_order_id,
    p_transformation_order_input_id,
    p_item_id,
    p_warehouse_id,
    p_quantity_base,
    p_uom_id,
    'active',
    p_actor_id,
    p_actor_id
  )
  RETURNING id INTO v_reservation_id;

  UPDATE public.item_warehouse stock
  SET reserved_stock = COALESCE(stock.reserved_stock, 0) + p_quantity_base,
      updated_by = p_actor_id,
      updated_at = NOW()
  WHERE stock.id = v_stock.id;

  RETURN v_reservation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_warehouse_inventory_commitment(
  UUID, UUID, TEXT, TEXT, UUID, UUID, UUID, NUMERIC, UUID, UUID,
  UUID, UUID, UUID, UUID
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_transformation_input_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order RECORD;
  v_base_uom_id UUID;
  v_base_quantity NUMERIC;
BEGIN
  SELECT
    transformation_order.company_id,
    transformation_order.business_unit_id,
    transformation_order.source_warehouse_id,
    transformation_order.created_by
  INTO v_order
  FROM public.transformation_orders transformation_order
  WHERE transformation_order.id = NEW.order_id
    AND transformation_order.deleted_at IS NULL;

  SELECT item.uom_id
  INTO v_base_uom_id
  FROM public.items item
  WHERE item.id = NEW.item_id
    AND item.company_id = v_order.company_id
    AND item.deleted_at IS NULL;

  v_base_quantity := public.inventory_base_quantity(
    v_order.company_id,
    NEW.item_id,
    NEW.uom_id,
    NEW.planned_quantity
  );

  PERFORM public.reserve_warehouse_inventory_commitment(
    v_order.company_id,
    v_order.business_unit_id,
    'transformation_order',
    'transformation_order_input',
    NEW.id,
    NEW.item_id,
    v_order.source_warehouse_id,
    v_base_quantity,
    v_base_uom_id,
    COALESCE(NEW.created_by, v_order.created_by),
    NULL,
    NULL,
    NEW.order_id,
    NEW.id
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_transformation_input_reservation()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER transformation_order_inputs_create_reservation
  AFTER INSERT ON public.transformation_order_inputs
  FOR EACH ROW
  EXECUTE FUNCTION public.create_transformation_input_reservation();

ALTER FUNCTION public.create_transformation_order_transaction(
  UUID, UUID, NUMERIC, DATE, DATE, TEXT, TEXT, UUID
) RENAME TO create_transformation_order_inventory_core;

REVOKE ALL ON FUNCTION public.create_transformation_order_inventory_core(
  UUID, UUID, NUMERIC, DATE, DATE, TEXT, TEXT, UUID
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_transformation_order_transaction(
  p_template_id UUID,
  p_warehouse_id UUID,
  p_planned_quantity NUMERIC,
  p_order_date DATE DEFAULT CURRENT_DATE,
  p_planned_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  -- Lock every warehouse projection in a stable order before the core function
  -- inserts input lines. Their insert trigger creates the source reservations.
  PERFORM stock.id
  FROM public.item_warehouse stock
  JOIN public.transformation_template_inputs template_input
    ON template_input.item_id = stock.item_id
   AND template_input.template_id = p_template_id
  WHERE stock.warehouse_id = p_warehouse_id
    AND stock.deleted_at IS NULL
    AND stock.is_active IS TRUE
  ORDER BY stock.item_id, stock.id
  FOR UPDATE OF stock;

  v_order_id := public.create_transformation_order_inventory_core(
    p_template_id,
    p_warehouse_id,
    p_planned_quantity,
    p_order_date,
    p_planned_date,
    p_notes,
    p_reference_type,
    p_reference_id
  );

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_transformation_order_transaction(
  UUID, UUID, NUMERIC, DATE, DATE, TEXT, TEXT, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_transformation_order_transaction(
  UUID, UUID, NUMERIC, DATE, DATE, TEXT, TEXT, UUID
) TO authenticated;

CREATE OR REPLACE FUNCTION public.allocate_transformation_reservations(
  p_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_company_id UUID;
  v_business_unit_id UUID := public.get_current_business_unit_id();
  v_order RECORD;
  v_reservation RECORD;
  v_source RECORD;
  v_remaining NUMERIC;
  v_available NUMERIC;
  v_take NUMERIC;
BEGIN
  SELECT user_row.company_id
  INTO v_company_id
  FROM public.users user_row
  WHERE user_row.id = v_actor_id
    AND user_row.is_active IS TRUE
    AND user_row.deleted_at IS NULL;

  IF v_actor_id IS NULL OR v_company_id IS NULL OR v_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'TRANSFORMATION_CONTEXT_INVALID';
  END IF;

  IF NOT public.user_has_permission(
    v_actor_id,
    'stock_transformations',
    'edit',
    v_business_unit_id
  ) THEN
    RAISE EXCEPTION 'TRANSFORMATION_PERMISSION_DENIED';
  END IF;

  SELECT transformation_order.id,
         transformation_order.status,
         transformation_order.template_id
  INTO v_order
  FROM public.transformation_orders transformation_order
  WHERE transformation_order.id = p_order_id
    AND transformation_order.company_id = v_company_id
    AND transformation_order.business_unit_id = v_business_unit_id
    AND transformation_order.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSFORMATION_ORDER_NOT_FOUND';
  END IF;

  IF v_order.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'TRANSFORMATION_ORDER_STATUS_CHANGED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.transformation_templates template
    WHERE template.id = v_order.template_id
      AND template.company_id = v_company_id
      AND template.business_unit_id = v_business_unit_id
      AND template.is_active IS TRUE
      AND template.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'TRANSFORMATION_TEMPLATE_UNAVAILABLE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inventory_reservations reservation
    LEFT JOIN public.items item
      ON item.id = reservation.item_id
     AND item.company_id = v_company_id
     AND item.is_active IS TRUE
     AND item.deleted_at IS NULL
    WHERE reservation.transformation_order_id = p_order_id
      AND reservation.reservation_type = 'transformation_order'
      AND reservation.deleted_at IS NULL
      AND item.id IS NULL
  ) THEN
    RAISE EXCEPTION 'TRANSFORMATION_INPUT_ITEM_UNAVAILABLE';
  END IF;

  FOR v_reservation IN
    SELECT
      reservation.id,
      reservation.transformation_order_input_id,
      reservation.item_id,
      reservation.warehouse_id,
      reservation.active_quantity_base
    FROM public.inventory_reservations reservation
    WHERE reservation.transformation_order_id = p_order_id
      AND reservation.reservation_type = 'transformation_order'
      AND reservation.deleted_at IS NULL
      AND reservation.active_quantity_base > 0
    ORDER BY reservation.item_id, reservation.id
    FOR UPDATE
  LOOP
    v_remaining := v_reservation.active_quantity_base;

    FOR v_source IN
      SELECT
        batch_location.id AS item_batch_location_id,
        batch_location.item_batch_id,
        batch_location.qty_on_hand,
        batch_location.qty_reserved
      FROM public.item_batch_locations batch_location
      JOIN public.item_batches item_batch
        ON item_batch.id = batch_location.item_batch_id
       AND item_batch.company_id = v_company_id
       AND item_batch.deleted_at IS NULL
      WHERE batch_location.company_id = v_company_id
        AND batch_location.item_id = v_reservation.item_id
        AND batch_location.warehouse_id = v_reservation.warehouse_id
        AND batch_location.deleted_at IS NULL
      ORDER BY item_batch.received_at, batch_location.created_at, batch_location.id
      FOR UPDATE OF batch_location, item_batch
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_available := GREATEST(
        0,
        COALESCE(v_source.qty_on_hand, 0) - COALESCE(v_source.qty_reserved, 0)
      );
      CONTINUE WHEN v_available <= 0;
      v_take := LEAST(v_available, v_remaining);

      UPDATE public.item_batch_locations
      SET qty_reserved = COALESCE(qty_reserved, 0) + v_take,
          updated_by = v_actor_id,
          updated_at = NOW()
      WHERE id = v_source.item_batch_location_id;

      UPDATE public.item_batches
      SET qty_reserved = COALESCE(qty_reserved, 0) + v_take,
          updated_by = v_actor_id,
          updated_at = NOW()
      WHERE id = v_source.item_batch_id;

      INSERT INTO public.inventory_reservation_allocations (
        company_id,
        business_unit_id,
        reservation_id,
        transformation_order_id,
        transformation_order_input_id,
        item_id,
        warehouse_id,
        item_batch_id,
        item_batch_location_id,
        quantity_base,
        status,
        created_by,
        updated_by
      ) VALUES (
        v_company_id,
        v_business_unit_id,
        v_reservation.id,
        p_order_id,
        v_reservation.transformation_order_input_id,
        v_reservation.item_id,
        v_reservation.warehouse_id,
        v_source.item_batch_id,
        v_source.item_batch_location_id,
        v_take,
        'active',
        v_actor_id,
        v_actor_id
      );

      v_remaining := v_remaining - v_take;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'TRANSFORMATION_INPUT_BATCH_STOCK_INSUFFICIENT';
    END IF;
  END LOOP;

  UPDATE public.transformation_orders
  SET status = 'PREPARING',
      updated_by = v_actor_id,
      updated_at = NOW()
  WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_transformation_reservations(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allocate_transformation_reservations(UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.release_inventory_reservation_owner(
  p_reservation_type TEXT,
  p_owner_id UUID,
  p_actor_id UUID,
  p_disposition TEXT DEFAULT 'released'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allocation RECORD;
  v_reservation RECORD;
BEGIN
  IF p_disposition NOT IN ('released', 'consumed') THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_INVALID_DISPOSITION';
  END IF;

  FOR v_allocation IN
    SELECT allocation.id,
           allocation.item_batch_id,
           allocation.item_batch_location_id,
           allocation.active_quantity_base
    FROM public.inventory_reservation_allocations allocation
    JOIN public.inventory_reservations reservation
      ON reservation.id = allocation.reservation_id
    WHERE reservation.reservation_type = p_reservation_type
      AND (
        (p_reservation_type = 'transformation_order'
          AND reservation.transformation_order_id = p_owner_id)
        OR (p_reservation_type = 'sales_order'
          AND reservation.sales_order_id = p_owner_id)
      )
      AND reservation.deleted_at IS NULL
      AND allocation.active_quantity_base > 0
    ORDER BY allocation.item_batch_id, allocation.item_batch_location_id, allocation.id
    FOR UPDATE OF allocation
  LOOP
    UPDATE public.item_batch_locations
    SET qty_reserved = COALESCE(qty_reserved, 0) - v_allocation.active_quantity_base,
        updated_by = p_actor_id,
        updated_at = NOW()
    WHERE id = v_allocation.item_batch_location_id
      AND COALESCE(qty_reserved, 0) >= v_allocation.active_quantity_base;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVENTORY_RESERVATION_LOCATION_PROJECTION_CONFLICT';
    END IF;

    UPDATE public.item_batches
    SET qty_reserved = COALESCE(qty_reserved, 0) - v_allocation.active_quantity_base,
        updated_by = p_actor_id,
        updated_at = NOW()
    WHERE id = v_allocation.item_batch_id
      AND COALESCE(qty_reserved, 0) >= v_allocation.active_quantity_base;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVENTORY_RESERVATION_BATCH_PROJECTION_CONFLICT';
    END IF;

    UPDATE public.inventory_reservation_allocations
    SET consumed_base = consumed_base
          + CASE WHEN p_disposition = 'consumed' THEN v_allocation.active_quantity_base ELSE 0 END,
        released_base = released_base
          + CASE WHEN p_disposition = 'released' THEN v_allocation.active_quantity_base ELSE 0 END,
        status = p_disposition,
        updated_by = p_actor_id,
        updated_at = NOW(),
        version = version + 1
    WHERE id = v_allocation.id;
  END LOOP;

  FOR v_reservation IN
    SELECT reservation.id,
           reservation.item_id,
           reservation.warehouse_id,
           reservation.active_quantity_base
    FROM public.inventory_reservations reservation
    WHERE reservation.reservation_type = p_reservation_type
      AND (
        (p_reservation_type = 'transformation_order'
          AND reservation.transformation_order_id = p_owner_id)
        OR (p_reservation_type = 'sales_order'
          AND reservation.sales_order_id = p_owner_id)
      )
      AND reservation.deleted_at IS NULL
      AND reservation.active_quantity_base > 0
    ORDER BY reservation.item_id, reservation.warehouse_id, reservation.id
    FOR UPDATE
  LOOP
    UPDATE public.item_warehouse stock
    SET reserved_stock = COALESCE(stock.reserved_stock, 0) - v_reservation.active_quantity_base,
        updated_by = p_actor_id,
        updated_at = NOW()
    WHERE stock.company_id = (
        SELECT reservation.company_id
        FROM public.inventory_reservations reservation
        WHERE reservation.id = v_reservation.id
      )
      AND stock.item_id = v_reservation.item_id
      AND stock.warehouse_id = v_reservation.warehouse_id
      AND stock.deleted_at IS NULL
      AND COALESCE(stock.reserved_stock, 0) >= v_reservation.active_quantity_base;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVENTORY_RESERVATION_WAREHOUSE_PROJECTION_CONFLICT';
    END IF;

    UPDATE public.inventory_reservations
    SET consumed_base = consumed_base
          + CASE WHEN p_disposition = 'consumed' THEN v_reservation.active_quantity_base ELSE 0 END,
        released_base = released_base
          + CASE WHEN p_disposition = 'released' THEN v_reservation.active_quantity_base ELSE 0 END,
        status = p_disposition,
        consumed_at = CASE WHEN p_disposition = 'consumed' THEN NOW() ELSE consumed_at END,
        released_at = CASE WHEN p_disposition = 'released' THEN NOW() ELSE released_at END,
        updated_by = p_actor_id,
        updated_at = NOW(),
        version = version + 1
    WHERE id = v_reservation.id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.release_inventory_reservation_owner(TEXT, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancel_transformation_order_transaction(
  p_order_id UUID
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
  v_status TEXT;
BEGIN
  SELECT user_row.company_id
  INTO v_company_id
  FROM public.users user_row
  WHERE user_row.id = v_actor_id
    AND user_row.is_active IS TRUE
    AND user_row.deleted_at IS NULL;

  IF NOT public.user_has_permission(
    v_actor_id,
    'stock_transformations',
    'edit',
    v_business_unit_id
  ) THEN
    RAISE EXCEPTION 'TRANSFORMATION_PERMISSION_DENIED';
  END IF;

  SELECT transformation_order.status
  INTO v_status
  FROM public.transformation_orders transformation_order
  WHERE transformation_order.id = p_order_id
    AND transformation_order.company_id = v_company_id
    AND transformation_order.business_unit_id = v_business_unit_id
    AND transformation_order.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSFORMATION_ORDER_NOT_FOUND';
  END IF;

  IF v_status NOT IN ('DRAFT', 'PREPARING') THEN
    RAISE EXCEPTION 'TRANSFORMATION_ORDER_STATUS_CHANGED';
  END IF;

  PERFORM public.release_inventory_reservation_owner(
    'transformation_order',
    p_order_id,
    v_actor_id,
    'released'
  );

  UPDATE public.transformation_orders
  SET status = 'CANCELLED',
      updated_by = v_actor_id,
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_transformation_order_transaction(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_transformation_order_transaction(UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_transformation_order_transaction(
  p_order_id UUID
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
  v_status TEXT;
BEGIN
  SELECT user_row.company_id
  INTO v_company_id
  FROM public.users user_row
  WHERE user_row.id = v_actor_id
    AND user_row.is_active IS TRUE
    AND user_row.deleted_at IS NULL;

  IF NOT public.user_has_permission(
    v_actor_id,
    'stock_transformations',
    'delete',
    v_business_unit_id
  ) THEN
    RAISE EXCEPTION 'TRANSFORMATION_PERMISSION_DENIED';
  END IF;

  SELECT transformation_order.status
  INTO v_status
  FROM public.transformation_orders transformation_order
  WHERE transformation_order.id = p_order_id
    AND transformation_order.company_id = v_company_id
    AND transformation_order.business_unit_id = v_business_unit_id
    AND transformation_order.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSFORMATION_ORDER_NOT_FOUND';
  END IF;

  IF v_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'TRANSFORMATION_ORDER_STATUS_CHANGED';
  END IF;

  PERFORM public.release_inventory_reservation_owner(
    'transformation_order',
    p_order_id,
    v_actor_id,
    'released'
  );

  UPDATE public.transformation_orders
  SET deleted_at = NOW(),
      updated_by = v_actor_id,
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_transformation_order_transaction(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_transformation_order_transaction(UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.update_transformation_order_transaction(
  p_order_id UUID,
  p_planned_quantity NUMERIC DEFAULT NULL,
  p_planned_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
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
  v_order RECORD;
  v_line RECORD;
  v_new_quantity NUMERIC;
  v_new_base_quantity NUMERIC;
  v_delta NUMERIC;
BEGIN
  SELECT user_row.company_id
  INTO v_company_id
  FROM public.users user_row
  WHERE user_row.id = v_actor_id
    AND user_row.is_active IS TRUE
    AND user_row.deleted_at IS NULL;

  IF NOT public.user_has_permission(
    v_actor_id,
    'stock_transformations',
    'edit',
    v_business_unit_id
  ) THEN
    RAISE EXCEPTION 'TRANSFORMATION_PERMISSION_DENIED';
  END IF;

  SELECT transformation_order.id,
         transformation_order.template_id,
         transformation_order.status,
         transformation_order.source_warehouse_id,
         transformation_order.planned_quantity
  INTO v_order
  FROM public.transformation_orders transformation_order
  WHERE transformation_order.id = p_order_id
    AND transformation_order.company_id = v_company_id
    AND transformation_order.business_unit_id = v_business_unit_id
    AND transformation_order.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSFORMATION_ORDER_NOT_FOUND';
  END IF;

  IF v_order.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'TRANSFORMATION_ORDER_STATUS_CHANGED';
  END IF;

  v_new_quantity := COALESCE(p_planned_quantity, v_order.planned_quantity);
  IF v_new_quantity <= 0 THEN
    RAISE EXCEPTION 'TRANSFORMATION_QUANTITY_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT template_input.quantity
      FROM public.transformation_template_inputs template_input
      WHERE template_input.template_id = v_order.template_id
      UNION ALL
      SELECT template_output.quantity
      FROM public.transformation_template_outputs template_output
      WHERE template_output.template_id = v_order.template_id
      UNION ALL
      SELECT additional_output.quantity
      FROM public.transformation_template_additional_outputs additional_output
      WHERE additional_output.template_id = v_order.template_id
    ) template_line
    WHERE template_line.quantity * v_new_quantity
      <> TRUNC(template_line.quantity * v_new_quantity)
  ) THEN
    RAISE EXCEPTION 'TRANSFORMATION_QUANTITY_NOT_WHOLE';
  END IF;

  FOR v_line IN
    SELECT input_line.id,
           input_line.item_id,
           input_line.uom_id,
           input_line.planned_quantity,
           template_input.quantity AS template_quantity,
           reservation.id AS reservation_id,
           reservation.active_quantity_base
    FROM public.transformation_order_inputs input_line
    JOIN public.transformation_template_inputs template_input
      ON template_input.template_id = v_order.template_id
     AND template_input.item_id = input_line.item_id
    JOIN public.inventory_reservations reservation
      ON reservation.transformation_order_input_id = input_line.id
     AND reservation.reservation_type = 'transformation_order'
     AND reservation.deleted_at IS NULL
    WHERE input_line.order_id = p_order_id
    ORDER BY input_line.item_id, input_line.id
    FOR UPDATE OF input_line, reservation
  LOOP
    v_new_base_quantity := public.inventory_base_quantity(
      v_company_id,
      v_line.item_id,
      v_line.uom_id,
      v_line.template_quantity * v_new_quantity
    );
    v_delta := v_new_base_quantity - v_line.active_quantity_base;

    IF v_delta > 0 THEN
      UPDATE public.item_warehouse stock
      SET reserved_stock = COALESCE(stock.reserved_stock, 0) + v_delta,
          updated_by = v_actor_id,
          updated_at = NOW()
      WHERE stock.company_id = v_company_id
        AND stock.item_id = v_line.item_id
        AND stock.warehouse_id = v_order.source_warehouse_id
        AND stock.deleted_at IS NULL
        AND COALESCE(stock.current_stock, 0) - COALESCE(stock.reserved_stock, 0) >= v_delta;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'INVENTORY_RESERVATION_INSUFFICIENT_STOCK';
      END IF;
    ELSIF v_delta < 0 THEN
      UPDATE public.item_warehouse stock
      SET reserved_stock = COALESCE(stock.reserved_stock, 0) + v_delta,
          updated_by = v_actor_id,
          updated_at = NOW()
      WHERE stock.company_id = v_company_id
        AND stock.item_id = v_line.item_id
        AND stock.warehouse_id = v_order.source_warehouse_id
        AND stock.deleted_at IS NULL
        AND COALESCE(stock.reserved_stock, 0) >= ABS(v_delta);
      IF NOT FOUND THEN
        RAISE EXCEPTION 'INVENTORY_RESERVATION_WAREHOUSE_PROJECTION_CONFLICT';
      END IF;
    END IF;

    UPDATE public.inventory_reservations
    SET quantity = v_new_base_quantity,
        updated_by = v_actor_id,
        updated_at = NOW(),
        version = version + 1
    WHERE id = v_line.reservation_id;

    UPDATE public.transformation_order_inputs
    SET planned_quantity = v_line.template_quantity * v_new_quantity,
        total_cost = unit_cost * v_line.template_quantity * v_new_quantity,
        updated_by = v_actor_id,
        updated_at = NOW()
    WHERE id = v_line.id;
  END LOOP;

  UPDATE public.transformation_order_outputs output_line
  SET planned_quantity = source_line.quantity * v_new_quantity,
      total_allocated_cost = CASE
        WHEN output_line.is_scrap THEN 0
        ELSE output_line.allocated_cost_per_unit * source_line.quantity * v_new_quantity
      END,
      updated_by = v_actor_id,
      updated_at = NOW()
  FROM (
    SELECT template_output.item_id,
           template_output.quantity,
           'template_primary'::TEXT AS output_origin
    FROM public.transformation_template_outputs template_output
    WHERE template_output.template_id = v_order.template_id
    UNION ALL
    SELECT additional_output.item_id,
           additional_output.quantity,
           'planned_additional'::TEXT AS output_origin
    FROM public.transformation_template_additional_outputs additional_output
    WHERE additional_output.template_id = v_order.template_id
  ) source_line
  WHERE output_line.order_id = p_order_id
    AND output_line.item_id = source_line.item_id
    AND output_line.output_origin = source_line.output_origin;

  UPDATE public.transformation_orders
  SET planned_quantity = v_new_quantity,
      planned_date = p_planned_date,
      notes = NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
      total_input_cost = (
        SELECT COALESCE(SUM(input_line.total_cost), 0)
        FROM public.transformation_order_inputs input_line
        WHERE input_line.order_id = p_order_id
      ),
      total_output_cost = (
        SELECT COALESCE(SUM(output_line.total_allocated_cost), 0)
        FROM public.transformation_order_outputs output_line
        WHERE output_line.order_id = p_order_id
      ),
      updated_by = v_actor_id,
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_transformation_order_transaction(
  UUID, NUMERIC, DATE, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_transformation_order_transaction(
  UUID, NUMERIC, DATE, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_sales_order_with_inventory(
  p_sales_order_id UUID,
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
  v_order RECORD;
  v_line RECORD;
  v_base_uom_id UUID;
  v_base_quantity NUMERIC;
BEGIN
  SELECT user_row.company_id
  INTO v_company_id
  FROM public.users user_row
  WHERE user_row.id = v_actor_id
    AND user_row.is_active IS TRUE
    AND user_row.deleted_at IS NULL;

  IF v_actor_id IS NULL OR v_company_id IS NULL OR v_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'SALES_ORDER_CONTEXT_INVALID';
  END IF;

  IF NOT public.user_has_permission(v_actor_id, 'sales_orders', 'edit', v_business_unit_id) THEN
    RAISE EXCEPTION 'SALES_ORDER_PERMISSION_DENIED';
  END IF;

  SELECT sales_order.id, sales_order.status
  INTO v_order
  FROM public.sales_orders sales_order
  WHERE sales_order.id = p_sales_order_id
    AND sales_order.company_id = v_company_id
    AND sales_order.business_unit_id = v_business_unit_id
    AND sales_order.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SALES_ORDER_NOT_FOUND';
  END IF;

  IF v_order.status <> 'draft' THEN
    RAISE EXCEPTION 'SALES_ORDER_STATUS_CHANGED';
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
    RAISE EXCEPTION 'SALES_ORDER_WAREHOUSE_INVALID';
  END IF;

  FOR v_line IN
    SELECT sales_order_item.id,
           sales_order_item.item_id,
           sales_order_item.uom_id,
           sales_order_item.quantity
    FROM public.sales_order_items sales_order_item
    JOIN public.items item
      ON item.id = sales_order_item.item_id
     AND item.company_id = v_company_id
     AND item.is_stock_item IS TRUE
     AND item.deleted_at IS NULL
    WHERE sales_order_item.order_id = p_sales_order_id
      AND sales_order_item.company_id = v_company_id
      AND sales_order_item.skip_inventory IS FALSE
      AND sales_order_item.deleted_at IS NULL
    ORDER BY sales_order_item.item_id, sales_order_item.id
    FOR UPDATE OF sales_order_item
  LOOP
    SELECT item.uom_id
    INTO v_base_uom_id
    FROM public.items item
    WHERE item.id = v_line.item_id;

    v_base_quantity := public.inventory_base_quantity(
      v_company_id,
      v_line.item_id,
      v_line.uom_id,
      v_line.quantity
    );

    PERFORM public.reserve_warehouse_inventory_commitment(
      v_company_id,
      v_business_unit_id,
      'sales_order',
      'sales_order_item',
      v_line.id,
      v_line.item_id,
      p_warehouse_id,
      v_base_quantity,
      v_base_uom_id,
      v_actor_id,
      p_sales_order_id,
      v_line.id,
      NULL,
      NULL
    );
  END LOOP;

  UPDATE public.sales_orders
  SET fulfilling_warehouse_id = p_warehouse_id,
      status = 'confirmed',
      updated_by = v_actor_id,
      updated_at = NOW()
  WHERE id = p_sales_order_id;

  RETURN p_sales_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_sales_order_with_inventory(UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_sales_order_with_inventory(UUID, UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.convert_sales_order_to_invoice_transaction(
  p_sales_order_id UUID,
  p_warehouse_id UUID,
  p_location_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_company_id UUID;
  v_business_unit_id UUID := public.get_current_business_unit_id();
  v_order RECORD;
  v_customer RECORD;
  v_line RECORD;
  v_reservation RECORD;
  v_warehouse_stock RECORD;
  v_batch_source RECORD;
  v_invoice_id UUID;
  v_invoice_code TEXT;
  v_invoice_date DATE := CURRENT_DATE;
  v_location_id UUID;
  v_stock_transaction_id UUID;
  v_base_quantity NUMERIC;
  v_remaining NUMERIC;
  v_available NUMERIC;
  v_take NUMERIC;
  v_next_stock NUMERIC;
  v_stock_items JSONB := '[]'::JSONB;
BEGIN
  SELECT user_row.company_id
  INTO v_company_id
  FROM public.users user_row
  WHERE user_row.id = v_actor_id
    AND user_row.is_active IS TRUE
    AND user_row.deleted_at IS NULL;

  IF v_actor_id IS NULL OR v_company_id IS NULL OR v_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'SALES_ORDER_CONTEXT_INVALID';
  END IF;

  IF NOT public.user_has_permission(v_actor_id, 'sales_orders', 'edit', v_business_unit_id) THEN
    RAISE EXCEPTION 'SALES_ORDER_PERMISSION_DENIED';
  END IF;

  SELECT
    sales_order.id,
    sales_order.company_id,
    sales_order.business_unit_id,
    sales_order.order_code,
    sales_order.customer_id,
    sales_order.status,
    sales_order.fulfilling_warehouse_id,
    sales_order.subtotal,
    sales_order.discount_amount,
    sales_order.tax_amount,
    sales_order.total_amount,
    sales_order.payment_terms,
    sales_order.notes
  INTO v_order
  FROM public.sales_orders sales_order
  WHERE sales_order.id = p_sales_order_id
    AND sales_order.company_id = v_company_id
    AND sales_order.business_unit_id = v_business_unit_id
    AND sales_order.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SALES_ORDER_NOT_FOUND';
  END IF;

  IF v_order.status NOT IN ('confirmed', 'in_progress') THEN
    RAISE EXCEPTION 'SALES_ORDER_STATUS_CHANGED';
  END IF;

  IF v_order.fulfilling_warehouse_id IS DISTINCT FROM p_warehouse_id THEN
    RAISE EXCEPTION 'SALES_ORDER_WAREHOUSE_MISMATCH';
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
    RAISE EXCEPTION 'SALES_ORDER_WAREHOUSE_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sales_invoices invoice
    WHERE invoice.sales_order_id = p_sales_order_id
      AND invoice.company_id = v_company_id
      AND invoice.status <> 'cancelled'
      AND invoice.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'SALES_ORDER_ALREADY_INVOICED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sales_order_items sales_order_item
    WHERE sales_order_item.order_id = p_sales_order_id
      AND sales_order_item.company_id = v_company_id
      AND sales_order_item.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'SALES_ORDER_ITEMS_REQUIRED';
  END IF;

  SELECT
    customer.billing_address_line1,
    customer.billing_address_line2,
    customer.billing_city,
    customer.billing_state,
    customer.billing_country,
    customer.billing_postal_code
  INTO v_customer
  FROM public.customers customer
  WHERE customer.id = v_order.customer_id
    AND customer.company_id = v_company_id
    AND customer.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SALES_ORDER_CUSTOMER_NOT_FOUND';
  END IF;

  IF p_location_id IS NOT NULL THEN
    SELECT location.id
    INTO v_location_id
    FROM public.warehouse_locations location
    WHERE location.id = p_location_id
      AND location.company_id = v_company_id
      AND location.warehouse_id = p_warehouse_id
      AND location.is_active IS TRUE
      AND location.is_storable IS TRUE
      AND location.deleted_at IS NULL
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'SALES_ORDER_LOCATION_INVALID';
    END IF;
  ELSE
    INSERT INTO public.warehouse_locations (
      company_id,
      warehouse_id,
      code,
      name,
      location_type,
      is_pickable,
      is_storable,
      is_active,
      created_by,
      updated_by
    ) VALUES (
      v_company_id,
      p_warehouse_id,
      'MAIN',
      'Main',
      'rack',
      TRUE,
      TRUE,
      TRUE,
      v_actor_id,
      v_actor_id
    )
    ON CONFLICT (company_id, warehouse_id, code) DO UPDATE
    SET is_active = TRUE,
        is_pickable = TRUE,
        is_storable = TRUE,
        deleted_at = NULL,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    RETURNING id INTO v_location_id;
  END IF;

  INSERT INTO public.sales_invoices (
    company_id,
    business_unit_id,
    customer_id,
    warehouse_id,
    custom_fields,
    sales_order_id,
    invoice_date,
    due_date,
    status,
    subtotal,
    discount_amount,
    tax_amount,
    total_amount,
    amount_paid,
    amount_due,
    billing_address_line1,
    billing_address_line2,
    billing_city,
    billing_state,
    billing_country,
    billing_postal_code,
    payment_terms,
    notes,
    commission_total,
    commission_split_count,
    created_by,
    updated_by
  ) VALUES (
    v_company_id,
    v_business_unit_id,
    v_order.customer_id,
    p_warehouse_id,
    CASE
      WHEN p_location_id IS NOT NULL THEN jsonb_build_object('locationId', v_location_id)
      ELSE NULL
    END,
    p_sales_order_id,
    v_invoice_date,
    v_invoice_date + 30,
    'sent',
    v_order.subtotal,
    v_order.discount_amount,
    v_order.tax_amount,
    v_order.total_amount,
    0,
    v_order.total_amount,
    COALESCE(v_customer.billing_address_line1, ''),
    COALESCE(v_customer.billing_address_line2, ''),
    COALESCE(v_customer.billing_city, ''),
    COALESCE(v_customer.billing_state, ''),
    COALESCE(v_customer.billing_country, ''),
    COALESCE(v_customer.billing_postal_code, ''),
    COALESCE(v_order.payment_terms, 'Payment due within 30 days'),
    COALESCE(v_order.notes, ''),
    0,
    0,
    v_actor_id,
    v_actor_id
  )
  RETURNING id, invoice_code INTO v_invoice_id, v_invoice_code;

  INSERT INTO public.sales_invoice_items (
    company_id,
    invoice_id,
    item_id,
    skip_inventory,
    item_description,
    quantity,
    uom_id,
    pricing_tier,
    pricing_tier_name,
    rate,
    discount_percent,
    discount_amount,
    tax_percent,
    tax_amount,
    line_total,
    sort_order,
    created_by,
    updated_by
  )
  SELECT
    sales_order_item.company_id,
    v_invoice_id,
    sales_order_item.item_id,
    sales_order_item.skip_inventory,
    sales_order_item.item_description,
    sales_order_item.quantity,
    sales_order_item.uom_id,
    sales_order_item.pricing_tier,
    sales_order_item.pricing_tier_name,
    sales_order_item.rate,
    COALESCE(sales_order_item.discount_percent, 0),
    COALESCE(sales_order_item.discount_amount, 0),
    COALESCE(sales_order_item.tax_percent, 0),
    COALESCE(sales_order_item.tax_amount, 0),
    sales_order_item.line_total,
    COALESCE(sales_order_item.sort_order, 0),
    v_actor_id,
    v_actor_id
  FROM public.sales_order_items sales_order_item
  WHERE sales_order_item.order_id = p_sales_order_id
    AND sales_order_item.company_id = v_company_id
    AND sales_order_item.deleted_at IS NULL
  ORDER BY sales_order_item.sort_order, sales_order_item.id;

  IF EXISTS (
    SELECT 1
    FROM public.sales_order_items sales_order_item
    JOIN public.items item
      ON item.id = sales_order_item.item_id
     AND item.company_id = v_company_id
     AND item.is_stock_item IS TRUE
     AND item.deleted_at IS NULL
    WHERE sales_order_item.order_id = p_sales_order_id
      AND sales_order_item.company_id = v_company_id
      AND sales_order_item.skip_inventory IS FALSE
      AND sales_order_item.deleted_at IS NULL
  ) THEN
    INSERT INTO public.stock_transactions (
      company_id,
      business_unit_id,
      transaction_type,
      transaction_date,
      warehouse_id,
      from_location_id,
      reference_type,
      reference_id,
      reference_code,
      notes,
      status,
      created_by,
      updated_by
    ) VALUES (
      v_company_id,
      v_business_unit_id,
      'out',
      v_invoice_date,
      p_warehouse_id,
      v_location_id,
      'sales_invoice',
      v_invoice_id,
      v_invoice_code,
      'Stock deduction for invoice ' || v_invoice_code || ' (from SO '
        || v_order.order_code || ')',
      'posted',
      v_actor_id,
      v_actor_id
    )
    RETURNING id INTO v_stock_transaction_id;
  END IF;

  FOR v_line IN
    SELECT
      sales_order_item.id,
      sales_order_item.item_id,
      sales_order_item.uom_id,
      sales_order_item.quantity,
      item.uom_id AS base_uom_id,
      COALESCE(item.purchase_price, 0) AS unit_cost
    FROM public.sales_order_items sales_order_item
    JOIN public.items item
      ON item.id = sales_order_item.item_id
     AND item.company_id = v_company_id
     AND item.is_stock_item IS TRUE
     AND item.deleted_at IS NULL
    WHERE sales_order_item.order_id = p_sales_order_id
      AND sales_order_item.company_id = v_company_id
      AND sales_order_item.skip_inventory IS FALSE
      AND sales_order_item.deleted_at IS NULL
    ORDER BY sales_order_item.item_id, sales_order_item.id
    FOR UPDATE OF sales_order_item
  LOOP
    v_base_quantity := public.inventory_base_quantity(
      v_company_id,
      v_line.item_id,
      v_line.uom_id,
      v_line.quantity
    );

    SELECT reservation.id, reservation.active_quantity_base
    INTO v_reservation
    FROM public.inventory_reservations reservation
    WHERE reservation.reservation_type = 'sales_order'
      AND reservation.sales_order_id = p_sales_order_id
      AND reservation.sales_order_item_id = v_line.id
      AND reservation.item_id = v_line.item_id
      AND reservation.warehouse_id = p_warehouse_id
      AND reservation.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND OR v_reservation.active_quantity_base <> v_base_quantity THEN
      RAISE EXCEPTION 'SALES_ORDER_RESERVATION_CONFLICT';
    END IF;

    SELECT stock.id, stock.current_stock, stock.reserved_stock
    INTO v_warehouse_stock
    FROM public.item_warehouse stock
    WHERE stock.company_id = v_company_id
      AND stock.item_id = v_line.item_id
      AND stock.warehouse_id = p_warehouse_id
      AND stock.is_active IS TRUE
      AND stock.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND
       OR COALESCE(v_warehouse_stock.current_stock, 0) < v_base_quantity
       OR COALESCE(v_warehouse_stock.reserved_stock, 0) < v_base_quantity THEN
      RAISE EXCEPTION 'SALES_ORDER_WAREHOUSE_PROJECTION_CONFLICT';
    END IF;

    v_remaining := v_base_quantity;
    v_next_stock := COALESCE(v_warehouse_stock.current_stock, 0);

    FOR v_batch_source IN
      SELECT
        batch_location.id AS item_batch_location_id,
        batch_location.item_batch_id,
        batch_location.qty_on_hand,
        batch_location.qty_reserved,
        item_batch.batch_code
      FROM public.item_batch_locations batch_location
      JOIN public.item_batches item_batch
        ON item_batch.id = batch_location.item_batch_id
       AND item_batch.company_id = v_company_id
       AND item_batch.deleted_at IS NULL
      WHERE batch_location.company_id = v_company_id
        AND batch_location.item_id = v_line.item_id
        AND batch_location.warehouse_id = p_warehouse_id
        AND batch_location.location_id = v_location_id
        AND batch_location.deleted_at IS NULL
      ORDER BY item_batch.received_at, batch_location.created_at, batch_location.id
      FOR UPDATE OF batch_location, item_batch
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_available := GREATEST(
        0,
        COALESCE(v_batch_source.qty_on_hand, 0)
          - COALESCE(v_batch_source.qty_reserved, 0)
      );
      CONTINUE WHEN v_available <= 0;
      v_take := LEAST(v_available, v_remaining);

      UPDATE public.item_batch_locations
      SET qty_on_hand = qty_on_hand - v_take,
          updated_by = v_actor_id,
          updated_at = NOW()
      WHERE id = v_batch_source.item_batch_location_id
        AND qty_on_hand - COALESCE(qty_reserved, 0) >= v_take;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'SALES_ORDER_LOCATION_STOCK_CONFLICT';
      END IF;

      UPDATE public.item_batches
      SET qty_on_hand = qty_on_hand - v_take,
          updated_by = v_actor_id,
          updated_at = NOW()
      WHERE id = v_batch_source.item_batch_id
        AND qty_on_hand >= v_take;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'SALES_ORDER_BATCH_STOCK_CONFLICT';
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
        qty_before,
        qty_after,
        valuation_rate,
        stock_value_before,
        stock_value_after,
        posting_date,
        posting_time,
        created_by,
        updated_by
      ) VALUES (
        v_company_id,
        v_stock_transaction_id,
        v_line.item_id,
        v_take,
        v_line.base_uom_id,
        v_line.unit_cost,
        v_line.unit_cost * v_take,
        v_batch_source.batch_code,
        v_next_stock,
        v_next_stock - v_take,
        v_line.unit_cost,
        v_next_stock * v_line.unit_cost,
        (v_next_stock - v_take) * v_line.unit_cost,
        v_invoice_date,
        CURRENT_TIME,
        v_actor_id,
        v_actor_id
      );

      v_next_stock := v_next_stock - v_take;
      v_remaining := v_remaining - v_take;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'SALES_ORDER_LOCATION_STOCK_INSUFFICIENT';
    END IF;

    UPDATE public.item_warehouse stock
    SET current_stock = v_next_stock,
        default_location_id = COALESCE(stock.default_location_id, v_location_id),
        updated_by = v_actor_id,
        updated_at = NOW()
    WHERE stock.id = v_warehouse_stock.id;

    v_stock_items := v_stock_items || jsonb_build_array(
      jsonb_build_object('itemId', v_line.item_id, 'quantity', v_base_quantity)
    );
  END LOOP;

  UPDATE public.sales_orders
  SET status = 'invoiced',
      updated_by = v_actor_id,
      updated_at = NOW()
  WHERE id = p_sales_order_id;

  RETURN jsonb_build_object(
    'invoiceId', v_invoice_id,
    'invoiceCode', v_invoice_code,
    'companyId', v_company_id,
    'customerId', v_order.customer_id,
    'invoiceDate', v_invoice_date,
    'totalAmount', v_order.total_amount,
    'warehouseId', p_warehouse_id,
    'orderCode', v_order.order_code,
    'stockItems', v_stock_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.convert_sales_order_to_invoice_transaction(UUID, UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_sales_order_to_invoice_transaction(UUID, UUID, UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_sales_order_transaction(
  p_sales_order_id UUID
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
  v_order RECORD;
BEGIN
  SELECT user_row.company_id
  INTO v_company_id
  FROM public.users user_row
  WHERE user_row.id = v_actor_id
    AND user_row.is_active IS TRUE
    AND user_row.deleted_at IS NULL;

  IF v_actor_id IS NULL OR v_company_id IS NULL OR v_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'SALES_ORDER_CONTEXT_INVALID';
  END IF;

  IF NOT public.user_has_permission(v_actor_id, 'sales_orders', 'delete', v_business_unit_id) THEN
    RAISE EXCEPTION 'SALES_ORDER_PERMISSION_DENIED';
  END IF;

  SELECT sales_order.id, sales_order.status
  INTO v_order
  FROM public.sales_orders sales_order
  WHERE sales_order.id = p_sales_order_id
    AND sales_order.company_id = v_company_id
    AND sales_order.business_unit_id = v_business_unit_id
    AND sales_order.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SALES_ORDER_NOT_FOUND';
  END IF;

  IF v_order.status NOT IN ('draft', 'confirmed') THEN
    RAISE EXCEPTION 'SALES_ORDER_DELETE_STATUS_INVALID';
  END IF;

  IF v_order.status = 'confirmed' THEN
    PERFORM public.release_inventory_reservation_owner(
      'sales_order',
      p_sales_order_id,
      v_actor_id,
      'released'
    );
  END IF;

  UPDATE public.sales_order_item_components component
  SET deleted_at = NOW(),
      updated_by = v_actor_id,
      updated_at = NOW()
  FROM public.sales_order_items order_item
  WHERE order_item.id = component.order_item_id
    AND order_item.order_id = p_sales_order_id
    AND component.deleted_at IS NULL;

  UPDATE public.sales_order_item_configurations configuration
  SET deleted_at = NOW(),
      updated_by = v_actor_id,
      updated_at = NOW()
  FROM public.sales_order_items order_item
  WHERE order_item.id = configuration.order_item_id
    AND order_item.order_id = p_sales_order_id
    AND configuration.deleted_at IS NULL;

  UPDATE public.sales_order_items
  SET deleted_at = NOW(),
      updated_by = v_actor_id,
      updated_at = NOW()
  WHERE order_id = p_sales_order_id
    AND deleted_at IS NULL;

  UPDATE public.sales_orders
  SET deleted_at = NOW(),
      updated_by = v_actor_id,
      updated_at = NOW()
  WHERE id = p_sales_order_id;

  RETURN p_sales_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_sales_order_transaction(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_sales_order_transaction(UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_sales_order_inventory_reservations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('cancelled', 'invoiced') THEN
    PERFORM public.release_inventory_reservation_owner(
      'sales_order',
      NEW.id,
      COALESCE(NEW.updated_by, auth.uid()),
      CASE WHEN NEW.status = 'invoiced' THEN 'consumed' ELSE 'released' END
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_sales_order_inventory_reservations()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER sales_orders_finalize_inventory_reservations
  AFTER UPDATE OF status ON public.sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.finalize_sales_order_inventory_reservations();

DROP FUNCTION public.complete_transformation_order_transaction(
  UUID, JSONB, JSONB, DATE, TEXT
);

CREATE OR REPLACE FUNCTION public.complete_transformation_input_from_allocations(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_actor_id UUID,
  p_order_id UUID,
  p_order_code TEXT,
  p_input_line_id UUID,
  p_consumed_quantity NUMERIC,
  p_execution_date DATE,
  p_default_location_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_input RECORD;
  v_reservation RECORD;
  v_reservation_id UUID;
  v_warehouse_stock RECORD;
  v_source RECORD;
  v_allocation RECORD;
  v_base_quantity NUMERIC;
  v_extra_quantity NUMERIC;
  v_remaining NUMERIC;
  v_available NUMERIC;
  v_take NUMERIC;
  v_consume NUMERIC;
  v_next_stock NUMERIC;
  v_transaction_id UUID;
  v_first_transaction_id UUID;
  v_first_location_id UUID;
  v_transaction_ids JSONB := '[]'::JSONB;
BEGIN
  SELECT
    input_line.item_id,
    input_line.uom_id,
    input_line.warehouse_id,
    item.uom_id AS base_uom_id,
    COALESCE(item.purchase_price, 0) AS unit_cost
  INTO v_input
  FROM public.transformation_order_inputs input_line
  JOIN public.items item
    ON item.id = input_line.item_id
   AND item.company_id = p_company_id
   AND item.is_active IS TRUE
   AND item.deleted_at IS NULL
  WHERE input_line.id = p_input_line_id
    AND input_line.order_id = p_order_id;

  IF NOT FOUND OR COALESCE(p_consumed_quantity, 0) <= 0 THEN
    RAISE EXCEPTION 'Invalid execution quantities' USING ERRCODE = 'P0001';
  END IF;

  v_base_quantity := public.inventory_base_quantity(
    p_company_id,
    v_input.item_id,
    v_input.uom_id,
    p_consumed_quantity
  );

  SELECT
    reservation.id,
    reservation.active_quantity_base
  INTO v_reservation
  FROM public.inventory_reservations reservation
  WHERE reservation.transformation_order_input_id = p_input_line_id
    AND reservation.transformation_order_id = p_order_id
    AND reservation.reservation_type = 'transformation_order'
    AND reservation.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_NOT_FOUND';
  END IF;

  v_reservation_id := v_reservation.id;

  IF v_base_quantity > v_reservation.active_quantity_base THEN
    v_extra_quantity := v_base_quantity - v_reservation.active_quantity_base;

    UPDATE public.item_warehouse stock
    SET reserved_stock = COALESCE(stock.reserved_stock, 0) + v_extra_quantity,
        updated_by = p_actor_id,
        updated_at = NOW()
    WHERE stock.company_id = p_company_id
      AND stock.item_id = v_input.item_id
      AND stock.warehouse_id = v_input.warehouse_id
      AND stock.is_active IS TRUE
      AND stock.deleted_at IS NULL
      AND COALESCE(stock.current_stock, 0) - COALESCE(stock.reserved_stock, 0)
        >= v_extra_quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient input stock' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.inventory_reservations reservation
    SET quantity = reservation.quantity + v_extra_quantity,
        updated_by = p_actor_id,
        updated_at = NOW(),
        version = reservation.version + 1
    WHERE reservation.id = v_reservation_id;

    v_remaining := v_extra_quantity;
    FOR v_source IN
      SELECT
        batch_location.id AS item_batch_location_id,
        batch_location.item_batch_id,
        batch_location.qty_on_hand,
        batch_location.qty_reserved
      FROM public.item_batch_locations batch_location
      JOIN public.item_batches item_batch
        ON item_batch.id = batch_location.item_batch_id
       AND item_batch.company_id = p_company_id
       AND item_batch.deleted_at IS NULL
      WHERE batch_location.company_id = p_company_id
        AND batch_location.item_id = v_input.item_id
        AND batch_location.warehouse_id = v_input.warehouse_id
        AND batch_location.deleted_at IS NULL
      ORDER BY item_batch.received_at, batch_location.created_at, batch_location.id
      FOR UPDATE OF batch_location, item_batch
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_available := GREATEST(
        0,
        COALESCE(v_source.qty_on_hand, 0) - COALESCE(v_source.qty_reserved, 0)
      );
      CONTINUE WHEN v_available <= 0;
      v_take := LEAST(v_available, v_remaining);

      UPDATE public.item_batch_locations
      SET qty_reserved = COALESCE(qty_reserved, 0) + v_take,
          updated_by = p_actor_id,
          updated_at = NOW()
      WHERE id = v_source.item_batch_location_id;

      UPDATE public.item_batches
      SET qty_reserved = COALESCE(qty_reserved, 0) + v_take,
          updated_by = p_actor_id,
          updated_at = NOW()
      WHERE id = v_source.item_batch_id;

      INSERT INTO public.inventory_reservation_allocations (
        company_id,
        business_unit_id,
        reservation_id,
        transformation_order_id,
        transformation_order_input_id,
        item_id,
        warehouse_id,
        item_batch_id,
        item_batch_location_id,
        quantity_base,
        status,
        created_by,
        updated_by
      ) VALUES (
        p_company_id,
        p_business_unit_id,
        v_reservation_id,
        p_order_id,
        p_input_line_id,
        v_input.item_id,
        v_input.warehouse_id,
        v_source.item_batch_id,
        v_source.item_batch_location_id,
        v_take,
        'active',
        p_actor_id,
        p_actor_id
      )
      ON CONFLICT (
        transformation_order_input_id,
        item_batch_location_id
      ) WHERE transformation_order_input_id IS NOT NULL
      DO UPDATE
      SET quantity_base = inventory_reservation_allocations.quantity_base + EXCLUDED.quantity_base,
          status = 'active',
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW(),
          version = inventory_reservation_allocations.version + 1;

      v_remaining := v_remaining - v_take;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Insufficient input batch stock' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT
    reservation.id,
    reservation.active_quantity_base
  INTO v_reservation
  FROM public.inventory_reservations reservation
  WHERE reservation.id = v_reservation_id
  FOR UPDATE;

  SELECT
    stock.id,
    stock.current_stock,
    stock.reserved_stock,
    stock.default_location_id
  INTO v_warehouse_stock
  FROM public.item_warehouse stock
  WHERE stock.company_id = p_company_id
    AND stock.item_id = v_input.item_id
    AND stock.warehouse_id = v_input.warehouse_id
    AND stock.is_active IS TRUE
    AND stock.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND
     OR COALESCE(v_warehouse_stock.current_stock, 0) < v_base_quantity
     OR COALESCE(v_warehouse_stock.reserved_stock, 0)
        < v_reservation.active_quantity_base THEN
    RAISE EXCEPTION 'Insufficient input stock' USING ERRCODE = 'P0001';
  END IF;

  v_remaining := v_base_quantity;
  v_next_stock := COALESCE(v_warehouse_stock.current_stock, 0);

  FOR v_allocation IN
    SELECT
      allocation.id,
      allocation.item_batch_id,
      allocation.item_batch_location_id,
      allocation.active_quantity_base,
      batch_location.location_id,
      item_batch.batch_code
    FROM public.inventory_reservation_allocations allocation
    JOIN public.item_batch_locations batch_location
      ON batch_location.id = allocation.item_batch_location_id
     AND batch_location.company_id = p_company_id
     AND batch_location.deleted_at IS NULL
    JOIN public.item_batches item_batch
      ON item_batch.id = allocation.item_batch_id
     AND item_batch.company_id = p_company_id
     AND item_batch.deleted_at IS NULL
    WHERE allocation.transformation_order_input_id = p_input_line_id
      AND allocation.transformation_order_id = p_order_id
      AND allocation.active_quantity_base > 0
    ORDER BY allocation.created_at, allocation.id
    FOR UPDATE OF allocation, batch_location, item_batch
  LOOP
    v_consume := LEAST(v_allocation.active_quantity_base, v_remaining);

    UPDATE public.item_batch_locations
    SET qty_on_hand = COALESCE(qty_on_hand, 0) - v_consume,
        qty_reserved = COALESCE(qty_reserved, 0) - v_allocation.active_quantity_base,
        updated_by = p_actor_id,
        updated_at = NOW()
    WHERE id = v_allocation.item_batch_location_id
      AND COALESCE(qty_on_hand, 0) >= v_consume
      AND COALESCE(qty_reserved, 0) >= v_allocation.active_quantity_base;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVENTORY_RESERVATION_LOCATION_PROJECTION_CONFLICT';
    END IF;

    UPDATE public.item_batches
    SET qty_on_hand = COALESCE(qty_on_hand, 0) - v_consume,
        qty_reserved = COALESCE(qty_reserved, 0) - v_allocation.active_quantity_base,
        updated_by = p_actor_id,
        updated_at = NOW()
    WHERE id = v_allocation.item_batch_id
      AND COALESCE(qty_on_hand, 0) >= v_consume
      AND COALESCE(qty_reserved, 0) >= v_allocation.active_quantity_base;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVENTORY_RESERVATION_BATCH_PROJECTION_CONFLICT';
    END IF;

    IF v_consume > 0 THEN
      INSERT INTO public.stock_transactions (
        company_id,
        business_unit_id,
        transaction_type,
        transaction_date,
        warehouse_id,
        from_location_id,
        reference_type,
        reference_id,
        reference_code,
        notes,
        status,
        created_by,
        updated_by
      ) VALUES (
        p_company_id,
        p_business_unit_id,
        'out',
        COALESCE(p_execution_date, CURRENT_DATE),
        v_input.warehouse_id,
        v_allocation.location_id,
        'transformation_order',
        p_order_id,
        p_order_code,
        'Transformation input consumption - batch '
          || v_allocation.batch_code || ' - ' || p_order_code,
        'posted',
        p_actor_id,
        p_actor_id
      )
      RETURNING id INTO v_transaction_id;

      INSERT INTO public.stock_transaction_items (
        company_id,
        transaction_id,
        item_id,
        quantity,
        uom_id,
        unit_cost,
        total_cost,
        batch_no,
        qty_before,
        qty_after,
        valuation_rate,
        stock_value_before,
        stock_value_after,
        posting_date,
        posting_time,
        created_by,
        updated_by
      ) VALUES (
        p_company_id,
        v_transaction_id,
        v_input.item_id,
        v_consume,
        v_input.base_uom_id,
        v_input.unit_cost,
        v_input.unit_cost * v_consume,
        v_allocation.batch_code,
        v_next_stock,
        v_next_stock - v_consume,
        v_input.unit_cost,
        v_next_stock * v_input.unit_cost,
        (v_next_stock - v_consume) * v_input.unit_cost,
        COALESCE(p_execution_date, CURRENT_DATE),
        CURRENT_TIME,
        p_actor_id,
        p_actor_id
      );

      v_first_transaction_id := COALESCE(v_first_transaction_id, v_transaction_id);
      v_first_location_id := COALESCE(v_first_location_id, v_allocation.location_id);
      v_transaction_ids := v_transaction_ids || jsonb_build_array(v_transaction_id);
      v_next_stock := v_next_stock - v_consume;
      v_remaining := v_remaining - v_consume;
    END IF;

    UPDATE public.inventory_reservation_allocations allocation
    SET consumed_base = allocation.consumed_base + v_consume,
        released_base = allocation.released_base
          + (v_allocation.active_quantity_base - v_consume),
        status = public.inventory_reservation_status(
          0,
          allocation.consumed_base + v_consume,
          allocation.released_base + (v_allocation.active_quantity_base - v_consume),
          allocation.transferred_out_base
        ),
        updated_by = p_actor_id,
        updated_at = NOW(),
        version = allocation.version + 1
    WHERE allocation.id = v_allocation.id;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Insufficient input batch stock' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.item_warehouse stock
  SET current_stock = v_next_stock,
      reserved_stock = COALESCE(stock.reserved_stock, 0)
        - v_reservation.active_quantity_base,
      default_location_id = COALESCE(
        stock.default_location_id,
        v_first_location_id,
        p_default_location_id
      ),
      updated_by = p_actor_id,
      updated_at = NOW()
  WHERE stock.id = v_warehouse_stock.id
    AND COALESCE(stock.reserved_stock, 0) >= v_reservation.active_quantity_base;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_WAREHOUSE_PROJECTION_CONFLICT';
  END IF;

  UPDATE public.inventory_reservations reservation
  SET consumed_base = reservation.consumed_base + v_base_quantity,
      released_base = reservation.released_base
        + (v_reservation.active_quantity_base - v_base_quantity),
      status = public.inventory_reservation_status(
        0,
        reservation.consumed_base + v_base_quantity,
        reservation.released_base + (v_reservation.active_quantity_base - v_base_quantity),
        reservation.transferred_out_base
      ),
      consumed_at = NOW(),
      released_at = CASE
        WHEN v_reservation.active_quantity_base > v_base_quantity THEN NOW()
        ELSE reservation.released_at
      END,
      updated_by = p_actor_id,
      updated_at = NOW(),
      version = reservation.version + 1
  WHERE reservation.id = v_reservation_id;

  UPDATE public.transformation_order_inputs input_line
  SET consumed_quantity = p_consumed_quantity,
      unit_cost = v_input.unit_cost,
      total_cost = v_input.unit_cost * v_base_quantity,
      stock_transaction_id = v_first_transaction_id,
      updated_by = p_actor_id,
      updated_at = NOW()
  WHERE input_line.id = p_input_line_id;

  RETURN jsonb_build_object(
    'transactions', v_transaction_ids,
    'total_cost', v_input.unit_cost * v_base_quantity
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_transformation_input_from_allocations(
  UUID, UUID, UUID, UUID, TEXT, UUID, NUMERIC, DATE, UUID
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.complete_transformation_order_transaction(
  p_order_id UUID,
  p_inputs JSONB,
  p_outputs JSONB,
  p_execution_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_company_id UUID;
  v_business_unit_id UUID := public.get_current_business_unit_id();
  v_order RECORD;
  v_input RECORD;
  v_output RECORD;
  v_default_location_id UUID;
  v_input_result JSONB;
  v_transaction_id UUID;
  v_waste_transaction_id UUID;
  v_total_input_cost NUMERIC := 0;
  v_total_output_quantity NUMERIC := 0;
  v_cost_per_unit NUMERIC := 0;
  v_total_output_cost NUMERIC := 0;
  v_total_waste_cost NUMERIC := 0;
  v_actual_quantity NUMERIC := 0;
  v_input_transaction_ids JSONB := '[]'::JSONB;
  v_output_transaction_ids JSONB := '[]'::JSONB;
  v_waste_transaction_ids JSONB := '[]'::JSONB;
BEGIN
  SELECT user_row.company_id
  INTO v_company_id
  FROM public.users user_row
  WHERE user_row.id = v_actor_id
    AND user_row.is_active IS TRUE
    AND user_row.deleted_at IS NULL;

  IF v_actor_id IS NULL OR v_company_id IS NULL OR v_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.user_has_permission(
    v_actor_id,
    'stock_transformations',
    'edit',
    v_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT
    transformation_order.id,
    transformation_order.order_code,
    transformation_order.source_warehouse_id,
    transformation_order.status
  INTO v_order
  FROM public.transformation_orders transformation_order
  WHERE transformation_order.id = p_order_id
    AND transformation_order.company_id = v_company_id
    AND transformation_order.business_unit_id = v_business_unit_id
    AND transformation_order.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_order.status <> 'PREPARING' THEN
    RAISE EXCEPTION 'Order must be preparing' USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(COALESCE(p_inputs, 'null'::JSONB)) <> 'array'
     OR jsonb_typeof(COALESCE(p_outputs, 'null'::JSONB)) <> 'array'
     OR jsonb_array_length(p_inputs) > 100
     OR jsonb_array_length(p_outputs) > 100 THEN
    RAISE EXCEPTION 'Invalid execution lines' USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_array_length(p_inputs) <> (
    SELECT COUNT(*)
    FROM public.transformation_order_inputs input_line
    WHERE input_line.order_id = p_order_id
  ) OR jsonb_array_length(p_outputs) <> (
    SELECT COUNT(*)
    FROM public.transformation_order_outputs output_line
    WHERE output_line.order_id = p_order_id
  ) THEN
    RAISE EXCEPTION 'All order lines must be supplied' USING ERRCODE = 'P0001';
  END IF;

  IF (
    SELECT COUNT(DISTINCT entry ->> 'inputLineId')
    FROM jsonb_array_elements(p_inputs) entry
  ) <> jsonb_array_length(p_inputs)
  OR (
    SELECT COUNT(DISTINCT entry ->> 'outputLineId')
    FROM jsonb_array_elements(p_outputs) entry
  ) <> jsonb_array_length(p_outputs) THEN
    RAISE EXCEPTION 'Execution lines must be unique' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_inputs) entry
    LEFT JOIN public.transformation_order_inputs input_line
      ON input_line.id = (entry ->> 'inputLineId')::UUID
     AND input_line.order_id = p_order_id
    WHERE input_line.id IS NULL
      OR COALESCE((entry ->> 'consumedQuantity')::NUMERIC, 0) <= 0
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_outputs) entry
    LEFT JOIN public.transformation_order_outputs output_line
      ON output_line.id = (entry ->> 'outputLineId')::UUID
     AND output_line.order_id = p_order_id
    WHERE output_line.id IS NULL
      OR COALESCE((entry ->> 'producedQuantity')::NUMERIC, -1) < 0
      OR COALESCE((entry ->> 'wastedQuantity')::NUMERIC, 0) < 0
      OR COALESCE((entry ->> 'producedQuantity')::NUMERIC, 0)
         + COALESCE((entry ->> 'wastedQuantity')::NUMERIC, 0)
         <> output_line.planned_quantity
      OR (
        COALESCE((entry ->> 'wastedQuantity')::NUMERIC, 0) > 0
        AND NULLIF(BTRIM(COALESCE(entry ->> 'wasteReason', '')), '') IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'Invalid execution quantities' USING ERRCODE = 'P0001';
  END IF;

  PERFORM item.id
  FROM public.items item
  WHERE item.id IN (
    SELECT input_line.item_id
    FROM public.transformation_order_inputs input_line
    WHERE input_line.order_id = p_order_id

    UNION

    SELECT output_line.item_id
    FROM public.transformation_order_outputs output_line
    WHERE output_line.order_id = p_order_id
  )
  ORDER BY item.id
  FOR SHARE;

  PERFORM unit.id
  FROM public.units_of_measure unit
  WHERE unit.id IN (
    SELECT input_line.uom_id
    FROM public.transformation_order_inputs input_line
    WHERE input_line.order_id = p_order_id

    UNION

    SELECT output_line.uom_id
    FROM public.transformation_order_outputs output_line
    WHERE output_line.order_id = p_order_id

    UNION

    SELECT item.uom_id
    FROM public.items item
    WHERE item.id IN (
      SELECT input_line.item_id
      FROM public.transformation_order_inputs input_line
      WHERE input_line.order_id = p_order_id

      UNION

      SELECT output_line.item_id
      FROM public.transformation_order_outputs output_line
      WHERE output_line.order_id = p_order_id
    )
  )
  ORDER BY unit.id
  FOR SHARE;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT input_line.item_id, input_line.uom_id
      FROM public.transformation_order_inputs input_line
      WHERE input_line.order_id = p_order_id

      UNION ALL

      SELECT output_line.item_id, output_line.uom_id
      FROM public.transformation_order_outputs output_line
      WHERE output_line.order_id = p_order_id
    ) referenced
    LEFT JOIN public.items item
      ON item.id = referenced.item_id
    LEFT JOIN public.units_of_measure line_uom
      ON line_uom.id = referenced.uom_id
    LEFT JOIN public.units_of_measure base_uom
      ON base_uom.id = item.uom_id
    WHERE item.id IS NULL
      OR item.company_id IS DISTINCT FROM v_company_id
      OR item.is_active IS NOT TRUE
      OR item.deleted_at IS NOT NULL
      OR line_uom.id IS NULL
      OR line_uom.company_id IS DISTINCT FROM v_company_id
      OR line_uom.is_active IS NOT TRUE
      OR line_uom.deleted_at IS NOT NULL
      OR base_uom.id IS NULL
      OR base_uom.company_id IS DISTINCT FROM v_company_id
      OR base_uom.is_active IS NOT TRUE
      OR base_uom.deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Transformation order contains an unavailable input or output item'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.warehouse_locations (
    company_id,
    warehouse_id,
    code,
    name,
    location_type,
    is_pickable,
    is_storable,
    is_active,
    created_by,
    updated_by
  ) VALUES (
    v_company_id,
    v_order.source_warehouse_id,
    'MAIN',
    'Main',
    'rack',
    TRUE,
    TRUE,
    TRUE,
    v_actor_id,
    v_actor_id
  )
  ON CONFLICT (company_id, warehouse_id, code) DO UPDATE
  SET is_active = TRUE,
      is_pickable = TRUE,
      is_storable = TRUE,
      deleted_at = NULL,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
  RETURNING id INTO v_default_location_id;

  FOR v_input IN
    SELECT
      input_line.id,
      (entry.value ->> 'consumedQuantity')::NUMERIC AS consumed_quantity
    FROM jsonb_array_elements(p_inputs) WITH ORDINALITY entry(value, ordinality)
    JOIN public.transformation_order_inputs input_line
      ON input_line.id = (entry.value ->> 'inputLineId')::UUID
     AND input_line.order_id = p_order_id
    ORDER BY entry.ordinality
  LOOP
    v_input_result := public.complete_transformation_input_from_allocations(
      v_company_id,
      v_business_unit_id,
      v_actor_id,
      p_order_id,
      v_order.order_code,
      v_input.id,
      v_input.consumed_quantity,
      COALESCE(p_execution_date, CURRENT_DATE),
      v_default_location_id
    );

    v_input_transaction_ids := v_input_transaction_ids
      || COALESCE(v_input_result -> 'transactions', '[]'::JSONB);
    v_total_input_cost := v_total_input_cost
      + COALESCE((v_input_result ->> 'total_cost')::NUMERIC, 0);
  END LOOP;

  SELECT COALESCE(
    SUM(
      CASE
        WHEN output_line.is_scrap THEN 0
        ELSE COALESCE((entry ->> 'producedQuantity')::NUMERIC, 0)
          + COALESCE((entry ->> 'wastedQuantity')::NUMERIC, 0)
      END
    ),
    0
  )
  INTO v_total_output_quantity
  FROM jsonb_array_elements(p_outputs) entry
  JOIN public.transformation_order_outputs output_line
    ON output_line.id = (entry ->> 'outputLineId')::UUID
   AND output_line.order_id = p_order_id;

  v_cost_per_unit := CASE
    WHEN v_total_output_quantity > 0
      THEN v_total_input_cost / v_total_output_quantity
    ELSE 0
  END;

  FOR v_output IN
    SELECT
      output_line.id,
      output_line.item_id,
      output_line.is_scrap,
      item.uom_id,
      COALESCE((entry.value ->> 'producedQuantity')::NUMERIC, 0) AS produced_quantity,
      COALESCE((entry.value ->> 'wastedQuantity')::NUMERIC, 0) AS wasted_quantity,
      NULLIF(BTRIM(COALESCE(entry.value ->> 'wasteReason', '')), '') AS waste_reason
    FROM jsonb_array_elements(p_outputs) WITH ORDINALITY entry(value, ordinality)
    JOIN public.transformation_order_outputs output_line
      ON output_line.id = (entry.value ->> 'outputLineId')::UUID
     AND output_line.order_id = p_order_id
    JOIN public.items item
      ON item.id = output_line.item_id
     AND item.company_id = v_company_id
     AND item.deleted_at IS NULL
    ORDER BY entry.ordinality
  LOOP
    IF v_output.produced_quantity > 0 THEN
      v_transaction_id := public.create_transformation_output_putaway(
        v_company_id,
        v_business_unit_id,
        p_order_id,
        v_output.id,
        v_output.item_id,
        v_order.source_warehouse_id,
        v_output.uom_id,
        v_order.order_code,
        COALESCE(p_execution_date, CURRENT_DATE),
        v_output.produced_quantity,
        v_output.wasted_quantity,
        v_output.waste_reason,
        CASE WHEN v_output.is_scrap THEN 0 ELSE v_cost_per_unit END,
        CASE
          WHEN v_output.is_scrap THEN 0
          ELSE v_cost_per_unit * v_output.produced_quantity
        END,
        v_actor_id
      );

      v_output_transaction_ids := v_output_transaction_ids
        || jsonb_build_array(v_transaction_id);
    ELSE
      UPDATE public.transformation_order_outputs output_line
      SET produced_quantity = 0,
          wasted_quantity = v_output.wasted_quantity,
          waste_reason = v_output.waste_reason,
          allocated_cost_per_unit = CASE
            WHEN v_output.is_scrap THEN 0
            ELSE v_cost_per_unit
          END,
          total_allocated_cost = 0,
          stock_transaction_id = NULL,
          updated_by = v_actor_id,
          updated_at = NOW()
      WHERE output_line.id = v_output.id;
    END IF;

    IF v_output.wasted_quantity > 0 THEN
      INSERT INTO public.stock_transactions (
        company_id,
        business_unit_id,
        transaction_type,
        transaction_date,
        warehouse_id,
        from_location_id,
        reference_type,
        reference_id,
        reference_code,
        notes,
        status,
        created_by,
        updated_by
      ) VALUES (
        v_company_id,
        v_business_unit_id,
        'out',
        COALESCE(p_execution_date, CURRENT_DATE),
        v_order.source_warehouse_id,
        v_default_location_id,
        'transformation_order',
        p_order_id,
        v_order.order_code,
        'Transformation waste - ' || v_output.waste_reason || ' - ' || v_order.order_code,
        'posted',
        v_actor_id,
        v_actor_id
      )
      RETURNING id INTO v_waste_transaction_id;

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
        created_by,
        updated_by
      ) VALUES (
        v_company_id,
        v_waste_transaction_id,
        v_output.item_id,
        v_output.wasted_quantity,
        v_output.uom_id,
        CASE WHEN v_output.is_scrap THEN 0 ELSE v_cost_per_unit END,
        CASE
          WHEN v_output.is_scrap THEN 0
          ELSE v_cost_per_unit * v_output.wasted_quantity
        END,
        0,
        0,
        CASE WHEN v_output.is_scrap THEN 0 ELSE v_cost_per_unit END,
        0,
        0,
        COALESCE(p_execution_date, CURRENT_DATE),
        CURRENT_TIME,
        v_actor_id,
        v_actor_id
      );

      UPDATE public.transformation_order_outputs output_line
      SET stock_transaction_waste_id = v_waste_transaction_id,
          updated_by = v_actor_id,
          updated_at = NOW()
      WHERE output_line.id = v_output.id;

      v_waste_transaction_ids := v_waste_transaction_ids
        || jsonb_build_array(v_waste_transaction_id);
    END IF;

    IF v_output.produced_quantity > 0 THEN
      INSERT INTO public.transformation_lineage (
        order_id,
        input_line_id,
        output_line_id,
        input_quantity_used,
        output_quantity_from,
        cost_attributed
      )
      SELECT
        p_order_id,
        input_line.id,
        v_output.id,
        input_line.consumed_quantity,
        v_output.produced_quantity,
        CASE
          WHEN v_output.is_scrap OR v_total_input_cost <= 0 THEN 0
          ELSE (
            v_cost_per_unit
              * v_output.produced_quantity
              * (input_line.total_cost / v_total_input_cost)
          )
        END
      FROM public.transformation_order_inputs input_line
      WHERE input_line.order_id = p_order_id;
    END IF;

    IF v_output.is_scrap IS FALSE THEN
      v_total_output_cost := v_total_output_cost
        + (v_cost_per_unit * v_output.produced_quantity);
      v_total_waste_cost := v_total_waste_cost
        + (v_cost_per_unit * v_output.wasted_quantity);
    END IF;

    v_actual_quantity := v_actual_quantity + v_output.produced_quantity;
  END LOOP;

  UPDATE public.transformation_orders transformation_order
  SET status = 'COMPLETED',
      execution_date = COALESCE(p_execution_date, CURRENT_DATE),
      completion_date = CURRENT_DATE,
      actual_quantity = v_actual_quantity,
      total_input_cost = v_total_input_cost,
      total_output_cost = v_total_output_cost,
      cost_variance = v_total_waste_cost,
      notes = COALESCE(NULLIF(BTRIM(COALESCE(p_notes, '')), ''), transformation_order.notes),
      updated_by = v_actor_id,
      updated_at = NOW()
  WHERE transformation_order.id = p_order_id;

  RETURN jsonb_build_object(
    'inputs', v_input_transaction_ids,
    'outputs', v_output_transaction_ids,
    'waste', v_waste_transaction_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_transformation_order_transaction(
  UUID, JSONB, JSONB, DATE, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_transformation_order_transaction(
  UUID, JSONB, JSONB, DATE, TEXT
) TO authenticated;

DROP FUNCTION public.get_inventory_reservations_page(
  UUID, UUID, UUID, TEXT, TEXT, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER
);

CREATE OR REPLACE FUNCTION public.get_inventory_reservations_page(
  p_company_id UUID,
  p_user_id UUID,
  p_business_unit_id UUID,
  p_search TEXT DEFAULT NULL,
  p_source_type TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_item_id UUID DEFAULT NULL,
  p_warehouse_id UUID DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'updated_at',
  p_sort_order TEXT DEFAULT 'desc',
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offset INTEGER;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users user_row
    WHERE user_row.id = p_user_id
      AND user_row.company_id = p_company_id
      AND user_row.deleted_at IS NULL
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.user_business_unit_access access_row
    WHERE access_row.user_id = p_user_id
      AND access_row.business_unit_id = p_business_unit_id
  ) OR NOT public.user_has_permission(
    p_user_id,
    'inventory_reservations',
    'view',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_PERMISSION_DENIED';
  END IF;

  IF p_page < 1 OR p_limit < 10 OR p_limit > 50 THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_INVALID_PAGINATION';
  END IF;

  IF length(COALESCE(p_search, '')) > 100 THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_SEARCH_TOO_LONG';
  END IF;

  IF COALESCE(p_source_type, 'all') NOT IN (
    'all', 'delivery_note', 'sales_order', 'transformation_order', 'frame_job_order'
  ) THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_INVALID_SOURCE_TYPE';
  END IF;

  IF COALESCE(p_status, 'all') NOT IN (
    'all', 'active', 'partial', 'consumed', 'released', 'transferred', 'closed'
  ) THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_INVALID_STATUS';
  END IF;

  IF p_sort_by NOT IN (
    'updated_at',
    'source_reference',
    'item_code',
    'warehouse_code',
    'active_quantity_base',
    'status'
  ) OR p_sort_order NOT IN ('asc', 'desc') THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_INVALID_SORT';
  END IF;

  v_offset := (p_page - 1) * p_limit;

  WITH filtered_reservations AS MATERIALIZED (
    SELECT
      reservation.id AS reservation_id,
      reservation.reservation_type AS source_type,
      COALESCE(
        reservation.delivery_note_id,
        reservation.sales_order_id,
        reservation.transformation_order_id,
        reservation.job_order_id,
        reservation.source_id
      ) AS source_id,
      CASE reservation.reservation_type
        WHEN 'delivery_note' THEN delivery_note.dn_no
        WHEN 'sales_order' THEN sales_order.order_code
        WHEN 'transformation_order' THEN transformation_order.order_code
        WHEN 'frame_job_order' THEN frame_job_order.job_order_code
      END AS source_reference,
      reservation.item_id,
      item.item_code,
      item.item_name,
      reservation.uom_id,
      unit.code AS uom_code,
      reservation.warehouse_id,
      warehouse.warehouse_code,
      warehouse.warehouse_name,
      reservation.quantity + reservation.transferred_in_base AS committed_quantity_base,
      reservation.active_quantity_base,
      reservation.consumed_base,
      reservation.released_base,
      reservation.transferred_out_base,
      reservation.status,
      reservation.updated_at
    FROM public.inventory_reservations reservation
    LEFT JOIN public.delivery_notes delivery_note
      ON delivery_note.id = reservation.delivery_note_id
     AND delivery_note.company_id = reservation.company_id
     AND delivery_note.deleted_at IS NULL
    LEFT JOIN public.sales_orders sales_order
      ON sales_order.id = reservation.sales_order_id
     AND sales_order.company_id = reservation.company_id
    LEFT JOIN public.transformation_orders transformation_order
      ON transformation_order.id = reservation.transformation_order_id
     AND transformation_order.company_id = reservation.company_id
    LEFT JOIN public.frame_job_orders frame_job_order
      ON frame_job_order.id = reservation.job_order_id
     AND frame_job_order.company_id = reservation.company_id
     AND frame_job_order.deleted_at IS NULL
    JOIN public.items item
      ON item.id = reservation.item_id
     AND item.company_id = reservation.company_id
    JOIN public.units_of_measure unit
      ON unit.id = reservation.uom_id
    JOIN public.warehouses warehouse
      ON warehouse.id = reservation.warehouse_id
     AND warehouse.company_id = reservation.company_id
    WHERE reservation.company_id = p_company_id
      AND COALESCE(
        reservation.business_unit_id,
        frame_job_order.business_unit_id
      ) = p_business_unit_id
      AND reservation.deleted_at IS NULL
      AND (
        COALESCE(p_source_type, 'all') = 'all'
        OR reservation.reservation_type = p_source_type
      )
      AND (COALESCE(p_status, 'all') = 'all' OR reservation.status = p_status)
      AND (p_item_id IS NULL OR reservation.item_id = p_item_id)
      AND (p_warehouse_id IS NULL OR reservation.warehouse_id = p_warehouse_id)
      AND (
        NULLIF(BTRIM(COALESCE(p_search, '')), '') IS NULL
        OR CASE reservation.reservation_type
          WHEN 'delivery_note' THEN delivery_note.dn_no
          WHEN 'sales_order' THEN sales_order.order_code
          WHEN 'transformation_order' THEN transformation_order.order_code
          WHEN 'frame_job_order' THEN frame_job_order.job_order_code
        END ILIKE '%' || BTRIM(p_search) || '%'
        OR item.item_code ILIKE '%' || BTRIM(p_search) || '%'
        OR item.item_name ILIKE '%' || BTRIM(p_search) || '%'
      )
  ),
  ordered_rows AS (
    SELECT
      filtered.reservation_id,
      filtered.source_type,
      filtered.source_id,
      filtered.source_reference,
      filtered.item_id,
      filtered.item_code,
      filtered.item_name,
      filtered.uom_id,
      filtered.uom_code,
      filtered.warehouse_id,
      filtered.warehouse_code,
      filtered.warehouse_name,
      filtered.committed_quantity_base,
      filtered.active_quantity_base,
      filtered.consumed_base,
      filtered.released_base,
      filtered.transferred_out_base,
      filtered.status,
      filtered.updated_at,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE WHEN p_sort_by = 'updated_at' AND p_sort_order = 'asc'
            THEN filtered.updated_at END ASC,
          CASE WHEN p_sort_by = 'updated_at' AND p_sort_order = 'desc'
            THEN filtered.updated_at END DESC,
          CASE WHEN p_sort_by = 'source_reference' AND p_sort_order = 'asc'
            THEN filtered.source_reference END ASC,
          CASE WHEN p_sort_by = 'source_reference' AND p_sort_order = 'desc'
            THEN filtered.source_reference END DESC,
          CASE WHEN p_sort_by = 'item_code' AND p_sort_order = 'asc'
            THEN filtered.item_code END ASC,
          CASE WHEN p_sort_by = 'item_code' AND p_sort_order = 'desc'
            THEN filtered.item_code END DESC,
          CASE WHEN p_sort_by = 'warehouse_code' AND p_sort_order = 'asc'
            THEN filtered.warehouse_code END ASC,
          CASE WHEN p_sort_by = 'warehouse_code' AND p_sort_order = 'desc'
            THEN filtered.warehouse_code END DESC,
          CASE WHEN p_sort_by = 'active_quantity_base' AND p_sort_order = 'asc'
            THEN filtered.active_quantity_base END ASC,
          CASE WHEN p_sort_by = 'active_quantity_base' AND p_sort_order = 'desc'
            THEN filtered.active_quantity_base END DESC,
          CASE WHEN p_sort_by = 'status' AND p_sort_order = 'asc'
            THEN filtered.status END ASC,
          CASE WHEN p_sort_by = 'status' AND p_sort_order = 'desc'
            THEN filtered.status END DESC,
          filtered.reservation_id
      ) AS sort_position
    FROM filtered_reservations filtered
  ),
  page_rows AS (
    SELECT
      ordered.reservation_id,
      ordered.source_type,
      ordered.source_id,
      ordered.source_reference,
      ordered.item_id,
      ordered.item_code,
      ordered.item_name,
      ordered.uom_id,
      ordered.uom_code,
      ordered.warehouse_id,
      ordered.warehouse_code,
      ordered.warehouse_name,
      ordered.committed_quantity_base,
      ordered.active_quantity_base,
      ordered.consumed_base,
      ordered.released_base,
      ordered.transferred_out_base,
      ordered.status,
      ordered.updated_at,
      ordered.sort_position
    FROM ordered_rows ordered
    WHERE ordered.sort_position > v_offset
      AND ordered.sort_position <= v_offset + p_limit
  ),
  page_allocations AS (
    SELECT allocation.reservation_id,
           COALESCE(SUM(allocation.active_quantity_base), 0) AS allocated_base
    FROM public.inventory_reservation_allocations allocation
    WHERE allocation.reservation_id IN (SELECT page_rows.reservation_id FROM page_rows)
    GROUP BY allocation.reservation_id
  )
  SELECT jsonb_build_object(
    'data', COALESCE(
      (
        SELECT jsonb_agg(
          (to_jsonb(page_rows) - 'sort_position')
          || jsonb_build_object(
            'physically_allocated_base', COALESCE(page_allocations.allocated_base, 0)
          )
          ORDER BY page_rows.sort_position
        )
        FROM page_rows
        LEFT JOIN page_allocations
          ON page_allocations.reservation_id = page_rows.reservation_id
      ),
      '[]'::JSONB
    ),
    'total', (SELECT COUNT(*) FROM filtered_reservations)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_inventory_reservations_page(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inventory_reservations_page(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER
) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_inventory_reservation_allocations_page(
  p_company_id UUID,
  p_user_id UUID,
  p_business_unit_id UUID,
  p_reservation_id UUID,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offset INTEGER;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_business_unit_access access_row
    WHERE access_row.user_id = p_user_id
      AND access_row.business_unit_id = p_business_unit_id
  ) OR NOT public.user_has_permission(
    p_user_id,
    'inventory_reservations',
    'view',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_PERMISSION_DENIED';
  END IF;

  IF p_page < 1 OR p_limit < 10 OR p_limit > 50 THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_INVALID_PAGINATION';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.inventory_reservations reservation
    LEFT JOIN public.frame_job_orders frame_job_order
      ON frame_job_order.id = reservation.job_order_id
    WHERE reservation.id = p_reservation_id
      AND reservation.company_id = p_company_id
      AND COALESCE(reservation.business_unit_id, frame_job_order.business_unit_id)
        = p_business_unit_id
      AND reservation.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_NOT_FOUND';
  END IF;

  v_offset := (p_page - 1) * p_limit;

  WITH filtered_allocations AS MATERIALIZED (
    SELECT
      allocation.id AS allocation_id,
      CASE
        WHEN allocation.pick_list_id IS NOT NULL THEN 'pick_list'
        ELSE 'transformation_order'
      END AS owner_type,
      COALESCE(allocation.pick_list_id, allocation.transformation_order_id) AS owner_id,
      COALESCE(pick_list.pick_list_no, transformation_order.order_code) AS owner_reference,
      allocation.warehouse_id,
      warehouse.warehouse_code,
      warehouse.warehouse_name,
      allocation.item_batch_id,
      item_batch.batch_code,
      allocation.item_batch_location_id,
      batch_location.batch_location_sku AS location_sku,
      warehouse_location.id AS location_id,
      warehouse_location.code AS location_code,
      warehouse_location.name AS location_name,
      allocation.quantity_base,
      allocation.transferred_in_base,
      allocation.transferred_out_base,
      allocation.active_quantity_base,
      allocation.consumed_base,
      allocation.released_base,
      allocation.status,
      allocation.updated_at
    FROM public.inventory_reservation_allocations allocation
    LEFT JOIN public.pick_lists pick_list
      ON pick_list.id = allocation.pick_list_id
     AND pick_list.company_id = allocation.company_id
    LEFT JOIN public.transformation_orders transformation_order
      ON transformation_order.id = allocation.transformation_order_id
     AND transformation_order.company_id = allocation.company_id
    JOIN public.warehouses warehouse
      ON warehouse.id = allocation.warehouse_id
     AND warehouse.company_id = allocation.company_id
    JOIN public.item_batches item_batch
      ON item_batch.id = allocation.item_batch_id
     AND item_batch.company_id = allocation.company_id
    JOIN public.item_batch_locations batch_location
      ON batch_location.id = allocation.item_batch_location_id
     AND batch_location.company_id = allocation.company_id
    JOIN public.warehouse_locations warehouse_location
      ON warehouse_location.id = batch_location.location_id
     AND warehouse_location.company_id = allocation.company_id
    WHERE allocation.company_id = p_company_id
      AND allocation.business_unit_id = p_business_unit_id
      AND allocation.reservation_id = p_reservation_id
  ),
  page_rows AS (
    SELECT
      filtered.allocation_id,
      filtered.owner_type,
      filtered.owner_id,
      filtered.owner_reference,
      filtered.warehouse_id,
      filtered.warehouse_code,
      filtered.warehouse_name,
      filtered.item_batch_id,
      filtered.batch_code,
      filtered.item_batch_location_id,
      filtered.location_sku,
      filtered.location_id,
      filtered.location_code,
      filtered.location_name,
      filtered.quantity_base,
      filtered.transferred_in_base,
      filtered.transferred_out_base,
      filtered.active_quantity_base,
      filtered.consumed_base,
      filtered.released_base,
      filtered.status,
      filtered.updated_at
    FROM filtered_allocations filtered
    ORDER BY filtered.updated_at DESC, filtered.allocation_id
    OFFSET v_offset
    LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'data', COALESCE(
      (SELECT jsonb_agg(to_jsonb(page_rows)) FROM page_rows),
      '[]'::JSONB
    ),
    'total', (SELECT COUNT(*) FROM filtered_allocations)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_inventory_reservation_allocations_page(
  UUID, UUID, UUID, UUID, INTEGER, INTEGER
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inventory_reservation_allocations_page(
  UUID, UUID, UUID, UUID, INTEGER, INTEGER
) TO authenticated;

COMMIT;
