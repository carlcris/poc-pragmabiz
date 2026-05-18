ALTER TABLE public.sales_quotation_items
  ADD COLUMN IF NOT EXISTS fulfilled_qty NUMERIC(15, 4) NOT NULL DEFAULT 0;

ALTER TABLE public.sales_order_items
  ADD COLUMN IF NOT EXISTS quotation_fulfilled_qty NUMERIC(15, 4) NOT NULL DEFAULT 0;

ALTER TABLE public.sales_quotation_items
  DROP CONSTRAINT IF EXISTS sales_quotation_items_fulfilled_qty_non_negative,
  DROP CONSTRAINT IF EXISTS sales_quotation_items_fulfilled_qty_not_over_quantity;

ALTER TABLE public.sales_quotation_items
  ADD CONSTRAINT sales_quotation_items_fulfilled_qty_non_negative
  CHECK (fulfilled_qty >= 0),
  ADD CONSTRAINT sales_quotation_items_fulfilled_qty_not_over_quantity
  CHECK (fulfilled_qty <= quantity);

ALTER TABLE public.sales_order_items
  DROP CONSTRAINT IF EXISTS sales_order_items_quotation_fulfilled_qty_non_negative,
  DROP CONSTRAINT IF EXISTS sales_order_items_quotation_fulfilled_qty_not_over_quantity;

ALTER TABLE public.sales_order_items
  ADD CONSTRAINT sales_order_items_quotation_fulfilled_qty_non_negative
  CHECK (quotation_fulfilled_qty >= 0),
  ADD CONSTRAINT sales_order_items_quotation_fulfilled_qty_not_over_quantity
  CHECK (quotation_fulfilled_qty <= quantity);

CREATE INDEX IF NOT EXISTS idx_sales_quotation_items_fulfillment
  ON public.sales_quotation_items(quotation_id, fulfilled_qty)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.sales_quotation_items.fulfilled_qty IS
  'Persisted quantity fulfilled by active linked sales order lines. Maintained by database triggers.';
COMMENT ON COLUMN public.sales_order_items.quotation_fulfilled_qty IS
  'Quantity from this sales order line that was applied to the linked quotation line fulfillment.';

CREATE OR REPLACE FUNCTION public.release_sales_order_item_quotation_fulfillment(
  p_quotation_item_id UUID,
  p_fulfilled_qty NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_quotation_item_id IS NULL OR COALESCE(p_fulfilled_qty, 0) <= 0 THEN
    RETURN;
  END IF;

  UPDATE public.sales_quotation_items
  SET
    fulfilled_qty = GREATEST(COALESCE(fulfilled_qty, 0) - p_fulfilled_qty, 0),
    updated_at = NOW()
  WHERE id = p_quotation_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.allocate_sales_order_item_quotation_fulfillment(
  p_quotation_item_id UUID,
  p_order_quantity NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_quote_line RECORD;
  v_applied_qty NUMERIC := 0;
BEGIN
  IF p_quotation_item_id IS NULL OR COALESCE(p_order_quantity, 0) <= 0 THEN
    RETURN 0;
  END IF;

  SELECT id, quantity, fulfilled_qty
  INTO v_quote_line
  FROM public.sales_quotation_items
  WHERE id = p_quotation_item_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_quote_line.id IS NULL THEN
    RETURN 0;
  END IF;

  v_applied_qty := LEAST(
    COALESCE(p_order_quantity, 0),
    GREATEST(COALESCE(v_quote_line.quantity, 0) - COALESCE(v_quote_line.fulfilled_qty, 0), 0)
  );

  IF v_applied_qty > 0 THEN
    UPDATE public.sales_quotation_items
    SET
      fulfilled_qty = fulfilled_qty + v_applied_qty,
      updated_at = NOW()
    WHERE id = p_quotation_item_id;
  END IF;

  RETURN v_applied_qty;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_sync_sales_order_item_quotation_fulfillment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order_is_active BOOLEAN := FALSE;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE')
    AND OLD.quotation_item_id IS NOT NULL
    AND COALESCE(OLD.quotation_fulfilled_qty, 0) > 0 THEN
    PERFORM public.release_sales_order_item_quotation_fulfillment(
      OLD.quotation_item_id,
      OLD.quotation_fulfilled_qty
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  NEW.quotation_fulfilled_qty := 0;

  IF NEW.quotation_item_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
    SELECT so.deleted_at IS NULL AND COALESCE(so.status, 'draft') <> 'cancelled'
    INTO v_order_is_active
    FROM public.sales_orders so
    WHERE so.id = NEW.order_id;

    IF COALESCE(v_order_is_active, FALSE) THEN
      NEW.quotation_fulfilled_qty :=
        public.allocate_sales_order_item_quotation_fulfillment(
          NEW.quotation_item_id,
          NEW.quantity
        );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_sales_order_item_quotation_fulfillment
  ON public.sales_order_items;

CREATE TRIGGER sync_sales_order_item_quotation_fulfillment
BEFORE INSERT OR UPDATE OF order_id, quotation_id, quotation_item_id, quantity, deleted_at OR DELETE
ON public.sales_order_items
FOR EACH ROW
EXECUTE FUNCTION public.trigger_sync_sales_order_item_quotation_fulfillment();

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

  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE COALESCE(fulfilled_qty, 0) >= COALESCE(quantity, 0)
        AND COALESCE(quantity, 0) > 0
    ),
    COALESCE(BOOL_OR(COALESCE(fulfilled_qty, 0) > 0), FALSE)
  INTO v_total_lines, v_served_lines, v_any_served
  FROM public.sales_quotation_items
  WHERE quotation_id = p_quotation_id
    AND deleted_at IS NULL;

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

CREATE OR REPLACE FUNCTION public.trigger_recalculate_sales_order_quotation_statuses()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_line RECORD;
  v_order_was_active BOOLEAN;
  v_order_is_active BOOLEAN;
  v_applied_qty NUMERIC;
BEGIN
  v_order_was_active := OLD.deleted_at IS NULL AND COALESCE(OLD.status, 'draft') <> 'cancelled';
  v_order_is_active := NEW.deleted_at IS NULL AND COALESCE(NEW.status, 'draft') <> 'cancelled';

  IF v_order_was_active IS DISTINCT FROM v_order_is_active THEN
    IF NOT v_order_is_active THEN
      FOR v_line IN
        SELECT id, quotation_item_id, quotation_fulfilled_qty
        FROM public.sales_order_items
        WHERE order_id = NEW.id
          AND quotation_item_id IS NOT NULL
          AND deleted_at IS NULL
          AND quotation_fulfilled_qty > 0
        ORDER BY sort_order NULLS LAST, id
      LOOP
        PERFORM public.release_sales_order_item_quotation_fulfillment(
          v_line.quotation_item_id,
          v_line.quotation_fulfilled_qty
        );

        UPDATE public.sales_order_items
        SET quotation_fulfilled_qty = 0
        WHERE id = v_line.id;
      END LOOP;
    ELSE
      FOR v_line IN
        SELECT id, quotation_item_id, quantity
        FROM public.sales_order_items
        WHERE order_id = NEW.id
          AND quotation_item_id IS NOT NULL
          AND deleted_at IS NULL
        ORDER BY sort_order NULLS LAST, id
      LOOP
        v_applied_qty := public.allocate_sales_order_item_quotation_fulfillment(
          v_line.quotation_item_id,
          v_line.quantity
        );

        UPDATE public.sales_order_items
        SET quotation_fulfilled_qty = v_applied_qty
        WHERE id = v_line.id;
      END LOOP;
    END IF;
  END IF;

  PERFORM public.recalculate_sales_order_linked_quotation_statuses(NEW.id);

  RETURN NEW;
END;
$$;

UPDATE public.sales_quotation_items
SET fulfilled_qty = 0;

UPDATE public.sales_order_items
SET quotation_fulfilled_qty = 0;

DO $$
DECLARE
  v_line RECORD;
  v_applied_qty NUMERIC;
BEGIN
  FOR v_line IN
    SELECT
      soi.id,
      soi.quotation_item_id,
      soi.quantity
    FROM public.sales_order_items soi
    JOIN public.sales_orders so ON so.id = soi.order_id
    WHERE soi.quotation_item_id IS NOT NULL
      AND soi.deleted_at IS NULL
      AND so.deleted_at IS NULL
      AND COALESCE(so.status, 'draft') <> 'cancelled'
    ORDER BY so.created_at, so.id, soi.sort_order NULLS LAST, soi.id
  LOOP
    v_applied_qty := public.allocate_sales_order_item_quotation_fulfillment(
      v_line.quotation_item_id,
      v_line.quantity
    );

    UPDATE public.sales_order_items
    SET quotation_fulfilled_qty = v_applied_qty
    WHERE id = v_line.id;
  END LOOP;
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
  WITH lines AS (
    SELECT
      q.id AS quotation_id,
      q.quotation_code,
      qi.id AS quotation_item_id,
      qi.item_id,
      i.item_code,
      i.item_name,
      qi.item_description,
      qi.quantity,
      LEAST(qi.quantity, COALESCE(qi.fulfilled_qty, 0)) AS ordered_quantity,
      GREATEST(qi.quantity - LEAST(qi.quantity, COALESCE(qi.fulfilled_qty, 0)), 0) AS remaining_quantity,
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
