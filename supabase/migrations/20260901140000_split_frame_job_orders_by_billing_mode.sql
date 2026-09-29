-- Step 6 — job order handoff, split by billing mode.
--
-- A quotation can mix chop & join and framing lines. They are different work:
-- chop & join is a cutting service billed per part, framing produces a finished
-- frame. The shop runs them as separate jobs, so one sales order must be able to
-- spawn one job order per mode present — up to two.
--
-- The previous version created exactly one job order for the whole order and
-- rejected any second attempt outright, so a mixed order silently filed its
-- chop & join work under a framing job.
--
-- `ux_frame_job_orders_active_sales_order_mode` (added in Step 1) already allows
-- one active job order per (sales_order_id, billing_mode); this brings the
-- function in line with that constraint.

-- Separate frame jobs may enter production for the same sales order. Keep the
-- sales-order uniqueness rule for orders without a frame job; the existing
-- ux_manufacturing_orders_active_frame_job_order index prevents duplicate
-- production orders for each individual frame job.
DROP INDEX IF EXISTS public.ux_manufacturing_orders_active_sales_order;
CREATE UNIQUE INDEX ux_manufacturing_orders_active_sales_order
  ON public.manufacturing_orders(sales_order_id)
  WHERE sales_order_id IS NOT NULL
    AND frame_job_order_id IS NULL
    AND status <> 'cancelled'
    AND deleted_at IS NULL;

-- The return type gains a `billing_mode` column, so the old signature must go
-- first: CREATE OR REPLACE cannot change a function's OUT parameters.
DROP FUNCTION IF EXISTS public.create_frame_job_order_from_sales_order_transaction(uuid, uuid);

CREATE OR REPLACE FUNCTION public.create_frame_job_order_from_sales_order_transaction(
  p_sales_order_id uuid,
  p_warehouse_id uuid
)
RETURNS TABLE(job_order_id uuid, job_order_code text, billing_mode text)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_sales_order RECORD;
  v_mode RECORD;
  v_job_order_id UUID;
  v_job_order_code TEXT;
  v_component RECORD;
  v_stock RECORD;
  v_available NUMERIC;
  v_created INTEGER := 0;
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.sales_order_item_configurations cfg
    JOIN public.sales_order_items soi ON soi.id = cfg.order_item_id
    WHERE soi.order_id = p_sales_order_id
      AND soi.deleted_at IS NULL
      AND cfg.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Sales order has no frame-configured items';
  END IF;

  -- One job order per billing mode present on the order. A mode that already has
  -- an active job order is skipped rather than raising, so adding a second mode
  -- later still works without a way to re-create the first.
  FOR v_mode IN
    SELECT DISTINCT cfg.billing_mode
    FROM public.sales_order_item_configurations cfg
    JOIN public.sales_order_items soi ON soi.id = cfg.order_item_id
    WHERE soi.order_id = p_sales_order_id
      AND soi.deleted_at IS NULL
      AND cfg.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.frame_job_orders existing
        WHERE existing.sales_order_id = p_sales_order_id
          AND existing.billing_mode = cfg.billing_mode
          AND existing.status <> 'cancelled'
          AND existing.deleted_at IS NULL
      )
    ORDER BY cfg.billing_mode
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
    RETURNING id, frame_job_orders.job_order_code INTO v_job_order_id, v_job_order_code;

    -- Only the components belonging to this mode's lines.
    FOR v_component IN
      SELECT c.*
      FROM public.sales_order_item_components c
      JOIN public.sales_order_items soi ON soi.id = c.order_item_id
      JOIN public.sales_order_item_configurations cfg ON cfg.order_item_id = soi.id
      WHERE soi.order_id = p_sales_order_id
        AND soi.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND cfg.deleted_at IS NULL
        AND cfg.billing_mode = v_mode.billing_mode
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
        NULL,
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

    v_created := v_created + 1;

    job_order_id := v_job_order_id;
    job_order_code := v_job_order_code;
    billing_mode := v_mode.billing_mode;
    RETURN NEXT;
  END LOOP;

  -- Every mode on the order already had an active job order. Raising keeps the
  -- old contract: the caller asked for work to be created and none was.
  IF v_created = 0 THEN
    RAISE EXCEPTION 'This sales order already has a frame job order for every billing mode';
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.create_frame_job_order_from_sales_order_transaction(uuid, uuid) IS
  'Creates one frame job order per billing mode present on the sales order (up to two: framing and chop_join), reserving stock per component. Modes that already have an active job order are skipped.';
