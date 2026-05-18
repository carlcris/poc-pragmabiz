ALTER TABLE public.sales_order_items
  ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES public.sales_quotations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quotation_item_id UUID REFERENCES public.sales_quotation_items(id) ON DELETE SET NULL;

ALTER TABLE public.sales_order_items
  DROP CONSTRAINT IF EXISTS sales_order_items_quotation_link_consistency;

ALTER TABLE public.sales_order_items
  ADD CONSTRAINT sales_order_items_quotation_link_consistency
  CHECK (quotation_item_id IS NULL OR quotation_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_sales_order_items_quotation
  ON public.sales_order_items(quotation_id)
  WHERE quotation_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_order_items_quotation_item
  ON public.sales_order_items(quotation_item_id)
  WHERE quotation_item_id IS NOT NULL AND deleted_at IS NULL;

DROP INDEX IF EXISTS public.idx_sales_orders_quotation;
ALTER TABLE public.sales_orders DROP CONSTRAINT IF EXISTS sales_orders_quotation_id_fkey;
ALTER TABLE public.sales_orders DROP COLUMN IF EXISTS quotation_id;

DROP INDEX IF EXISTS public.idx_quotations_sales_order;
ALTER TABLE public.sales_quotations DROP CONSTRAINT IF EXISTS sales_quotations_sales_order_id_fkey;
ALTER TABLE public.sales_quotations DROP COLUMN IF EXISTS sales_order_id;

COMMENT ON COLUMN public.sales_order_items.quotation_id IS
  'Quotation fulfilled by this sales order line. Inventory-only lines leave this null.';
COMMENT ON COLUMN public.sales_order_items.quotation_item_id IS
  'Specific quotation line fulfilled by this sales order line.';
COMMENT ON COLUMN public.sales_quotations.status IS
  'Status: draft, sent, accepted, partially_ordered, ordered, rejected, expired';

CREATE OR REPLACE FUNCTION public.recalculate_sales_quotation_order_status(p_quotation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total_lines INTEGER;
  v_served_lines INTEGER;
  v_any_served BOOLEAN;
  v_current_status TEXT;
BEGIN
  IF p_quotation_id IS NULL THEN
    RETURN;
  END IF;

  SELECT status
  INTO v_current_status
  FROM public.sales_quotations
  WHERE id = p_quotation_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_current_status IS NULL OR v_current_status NOT IN ('accepted', 'partially_ordered', 'ordered') THEN
    RETURN;
  END IF;

  WITH line_fulfillment AS (
    SELECT
      qi.id,
      COALESCE(qi.quantity, 0) AS quoted_quantity,
      LEAST(
        COALESCE(qi.quantity, 0),
        COALESCE(SUM(soi.quantity) FILTER (
          WHERE so.id IS NOT NULL
            AND so.deleted_at IS NULL
            AND COALESCE(so.status, 'draft') <> 'cancelled'
            AND soi.deleted_at IS NULL
        ), 0)
      ) AS served_quantity
    FROM public.sales_quotation_items qi
    LEFT JOIN public.sales_order_items soi
      ON soi.quotation_item_id = qi.id
     AND soi.quotation_id = qi.quotation_id
    LEFT JOIN public.sales_orders so
      ON so.id = soi.order_id
    WHERE qi.quotation_id = p_quotation_id
      AND qi.deleted_at IS NULL
    GROUP BY qi.id, qi.quantity
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE served_quantity >= quoted_quantity AND quoted_quantity > 0),
    COALESCE(BOOL_OR(served_quantity > 0), FALSE)
  INTO v_total_lines, v_served_lines, v_any_served
  FROM line_fulfillment;

  IF COALESCE(v_total_lines, 0) = 0 THEN
    RETURN;
  END IF;

  UPDATE public.sales_quotations
  SET
    status = CASE
      WHEN v_served_lines = v_total_lines THEN 'ordered'
      WHEN v_any_served THEN 'partially_ordered'
      ELSE 'accepted'
    END,
    updated_at = NOW()
  WHERE id = p_quotation_id
    AND deleted_at IS NULL
    AND status IN ('accepted', 'partially_ordered', 'ordered');
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_sales_order_linked_quotation_statuses(p_sales_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_quotation_id UUID;
BEGIN
  FOR v_quotation_id IN
    SELECT DISTINCT quotation_id
    FROM public.sales_order_items
    WHERE order_id = p_sales_order_id
      AND quotation_id IS NOT NULL
  LOOP
    PERFORM public.recalculate_sales_quotation_order_status(v_quotation_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_recalculate_sales_quotation_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.quotation_id IS NOT NULL THEN
    PERFORM public.recalculate_sales_quotation_order_status(OLD.quotation_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.quotation_id IS NOT NULL THEN
    PERFORM public.recalculate_sales_quotation_order_status(NEW.quotation_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS recalculate_sales_quotation_order_status_on_item_change
  ON public.sales_order_items;

CREATE TRIGGER recalculate_sales_quotation_order_status_on_item_change
AFTER INSERT OR UPDATE OR DELETE ON public.sales_order_items
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recalculate_sales_quotation_order_status();

CREATE OR REPLACE FUNCTION public.trigger_recalculate_sales_order_quotation_statuses()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
  ) THEN
    PERFORM public.recalculate_sales_order_linked_quotation_statuses(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recalculate_sales_order_quotation_statuses_on_order_change
  ON public.sales_orders;

CREATE TRIGGER recalculate_sales_order_quotation_statuses_on_order_change
AFTER UPDATE OF status, deleted_at ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recalculate_sales_order_quotation_statuses();

CREATE OR REPLACE FUNCTION public.confirm_sales_quotation_transaction(
  p_quotation_id UUID,
  p_warehouse_id UUID DEFAULT NULL
)
RETURNS TABLE (
  quotation_id UUID,
  status TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_quotation RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO v_quotation
  FROM public.sales_quotations
  WHERE id = p_quotation_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_quotation.id IS NULL THEN
    RAISE EXCEPTION 'Quotation not found';
  END IF;

  IF COALESCE(v_quotation.status, 'draft') NOT IN ('draft', 'sent', 'accepted') THEN
    RAISE EXCEPTION 'Only draft, sent, or accepted quotations can be confirmed';
  END IF;

  UPDATE public.sales_quotations
  SET
    status = 'accepted',
    updated_by = v_user_id,
    updated_at = NOW()
  WHERE id = p_quotation_id;

  quotation_id := p_quotation_id;
  status := 'accepted';
  RETURN NEXT;
END;
$$;

DROP FUNCTION IF EXISTS public.convert_sales_quotation_to_order_transaction(UUID, UUID);

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
    NULL,
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

CREATE OR REPLACE FUNCTION public.get_available_sales_quotation_lines(
  p_customer_id UUID,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  quotation_id UUID,
  quotation_code TEXT,
  quotation_item_id UUID,
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  item_description TEXT,
  quantity NUMERIC,
  ordered_quantity NUMERIC,
  remaining_quantity NUMERIC,
  uom_id UUID,
  uom_code TEXT,
  uom_name TEXT,
  rate NUMERIC,
  discount_percent NUMERIC,
  tax_percent NUMERIC,
  line_total NUMERIC,
  quotation_date DATE,
  valid_until DATE
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH fulfilled AS (
    SELECT
      soi.quotation_item_id,
      SUM(soi.quantity) AS ordered_quantity
    FROM public.sales_order_items soi
    JOIN public.sales_orders so ON so.id = soi.order_id
    WHERE soi.quotation_item_id IS NOT NULL
      AND soi.deleted_at IS NULL
      AND so.deleted_at IS NULL
      AND COALESCE(so.status, 'draft') <> 'cancelled'
    GROUP BY soi.quotation_item_id
  ),
  lines AS (
    SELECT
      q.id AS quotation_id,
      q.quotation_code,
      qi.id AS quotation_item_id,
      qi.item_id,
      i.item_code,
      i.item_name,
      qi.item_description,
      qi.quantity,
      LEAST(qi.quantity, COALESCE(f.ordered_quantity, 0)) AS ordered_quantity,
      GREATEST(qi.quantity - LEAST(qi.quantity, COALESCE(f.ordered_quantity, 0)), 0) AS remaining_quantity,
      qi.uom_id,
      uom.code AS uom_code,
      uom.name AS uom_name,
      qi.rate,
      COALESCE(qi.discount_percent, 0) AS discount_percent,
      COALESCE(qi.tax_percent, 0) AS tax_percent,
      qi.line_total,
      q.quotation_date,
      q.valid_until
    FROM public.sales_quotations q
    JOIN public.sales_quotation_items qi ON qi.quotation_id = q.id
    JOIN public.items i ON i.id = qi.item_id
    LEFT JOIN public.units_of_measure uom ON uom.id = qi.uom_id
    LEFT JOIN fulfilled f ON f.quotation_item_id = qi.id
    WHERE q.customer_id = p_customer_id
      AND q.status IN ('accepted', 'partially_ordered')
      AND q.deleted_at IS NULL
      AND qi.deleted_at IS NULL
      AND (
        NULLIF(BTRIM(COALESCE(p_search, '')), '') IS NULL
        OR q.quotation_code ILIKE '%' || BTRIM(p_search) || '%'
        OR i.item_code ILIKE '%' || BTRIM(p_search) || '%'
        OR i.item_name ILIKE '%' || BTRIM(p_search) || '%'
        OR qi.item_description ILIKE '%' || BTRIM(p_search) || '%'
      )
  )
  SELECT *
  FROM lines
  WHERE remaining_quantity > 0
  ORDER BY quotation_date DESC, quotation_code DESC, item_code ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;
