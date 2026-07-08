BEGIN;

ALTER TABLE public.item_warehouse
  DROP COLUMN IF EXISTS available_stock;

ALTER TABLE public.item_warehouse
  ADD COLUMN putaway_qty NUMERIC(20, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.item_warehouse
  ADD COLUMN available_stock NUMERIC(20, 4)
  GENERATED ALWAYS AS (
    COALESCE(current_stock, 0) - COALESCE(reserved_stock, 0) - COALESCE(putaway_qty, 0)
  ) STORED;

ALTER TABLE public.item_warehouse
  ADD CONSTRAINT item_warehouse_putaway_qty_nonnegative CHECK (putaway_qty >= 0);

CREATE TABLE IF NOT EXISTS public.putaway_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_unit_id UUID REFERENCES public.business_units(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  item_id UUID NOT NULL REFERENCES public.items(id),
  uom_id UUID REFERENCES public.units_of_measure(id),
  source_type VARCHAR(50) NOT NULL,
  source_id UUID NOT NULL,
  source_line_id UUID NOT NULL,
  source_reference VARCHAR(100),
  source_batch_code VARCHAR(150),
  quantity NUMERIC(20, 2) NOT NULL,
  pending_quantity NUMERIC(20, 2) NOT NULL,
  posted_quantity NUMERIC(20, 2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(20, 2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT putaway_tasks_quantity_positive CHECK (quantity > 0),
  CONSTRAINT putaway_tasks_pending_nonnegative CHECK (pending_quantity >= 0),
  CONSTRAINT putaway_tasks_posted_nonnegative CHECK (posted_quantity >= 0),
  CONSTRAINT putaway_tasks_quantity_balanced CHECK ((pending_quantity + posted_quantity) = quantity),
  CONSTRAINT putaway_tasks_status_check CHECK (status IN ('pending', 'partial', 'completed', 'cancelled')),
  CONSTRAINT putaway_tasks_source_unique UNIQUE (company_id, source_type, source_line_id)
);

CREATE INDEX IF NOT EXISTS idx_putaway_tasks_company_status
  ON public.putaway_tasks(company_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_putaway_tasks_bu_status
  ON public.putaway_tasks(business_unit_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_putaway_tasks_warehouse_status
  ON public.putaway_tasks(company_id, warehouse_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_warehouse_putaway_qty
  ON public.item_warehouse(company_id, warehouse_id, item_id)
  WHERE deleted_at IS NULL AND putaway_qty > 0;

DROP TRIGGER IF EXISTS trigger_putaway_tasks_updated_at ON public.putaway_tasks;
CREATE TRIGGER trigger_putaway_tasks_updated_at
  BEFORE UPDATE ON public.putaway_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.putaway_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS putaway_tasks_select ON public.putaway_tasks;
CREATE POLICY putaway_tasks_select ON public.putaway_tasks
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND (
      business_unit_id IS NULL
      OR business_unit_id = public.get_current_business_unit_id()
      OR EXISTS (
        SELECT 1
        FROM public.user_business_unit_access ubua
        WHERE ubua.user_id = auth.uid()
          AND ubua.business_unit_id = putaway_tasks.business_unit_id
      )
    )
  );

DROP POLICY IF EXISTS putaway_tasks_insert ON public.putaway_tasks;
CREATE POLICY putaway_tasks_insert ON public.putaway_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND (
      business_unit_id IS NULL
      OR business_unit_id = public.get_current_business_unit_id()
      OR EXISTS (
        SELECT 1
        FROM public.user_business_unit_access ubua
        WHERE ubua.user_id = auth.uid()
          AND ubua.business_unit_id = putaway_tasks.business_unit_id
      )
    )
  );

DROP POLICY IF EXISTS putaway_tasks_update ON public.putaway_tasks;
CREATE POLICY putaway_tasks_update ON public.putaway_tasks
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND (
      business_unit_id IS NULL
      OR business_unit_id = public.get_current_business_unit_id()
      OR EXISTS (
        SELECT 1
        FROM public.user_business_unit_access ubua
        WHERE ubua.user_id = auth.uid()
          AND ubua.business_unit_id = putaway_tasks.business_unit_id
      )
    )
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND (
      business_unit_id IS NULL
      OR business_unit_id = public.get_current_business_unit_id()
      OR EXISTS (
        SELECT 1
        FROM public.user_business_unit_access ubua
        WHERE ubua.user_id = auth.uid()
          AND ubua.business_unit_id = putaway_tasks.business_unit_id
      )
    )
  );

CREATE OR REPLACE FUNCTION public.create_putaway_task(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_warehouse_id UUID,
  p_item_id UUID,
  p_uom_id UUID,
  p_source_type TEXT,
  p_source_id UUID,
  p_source_line_id UUID,
  p_source_reference TEXT,
  p_quantity NUMERIC,
  p_unit_cost NUMERIC,
  p_user_id UUID,
  p_source_batch_code TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_task_id UUID;
BEGIN
  IF p_source_line_id IS NULL THEN
    RAISE EXCEPTION 'Putaway source line is required';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Putaway quantity must be greater than zero';
  END IF;

  INSERT INTO public.item_warehouse (
    company_id,
    item_id,
    warehouse_id,
    current_stock,
    reserved_stock,
    putaway_qty,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    p_item_id,
    p_warehouse_id,
    p_quantity,
    0,
    p_quantity,
    p_user_id,
    p_user_id
  )
  ON CONFLICT (company_id, item_id, warehouse_id)
  DO UPDATE SET
    current_stock = COALESCE(public.item_warehouse.current_stock, 0) + EXCLUDED.current_stock,
    putaway_qty = COALESCE(public.item_warehouse.putaway_qty, 0) + EXCLUDED.putaway_qty,
    deleted_at = NULL,
    updated_by = p_user_id,
    updated_at = NOW();

  INSERT INTO public.putaway_tasks (
    company_id,
    business_unit_id,
    warehouse_id,
    item_id,
    uom_id,
    source_type,
    source_id,
    source_line_id,
    source_reference,
    source_batch_code,
    quantity,
    pending_quantity,
    unit_cost,
    status,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    p_business_unit_id,
    p_warehouse_id,
    p_item_id,
    p_uom_id,
    p_source_type,
    p_source_id,
    p_source_line_id,
    p_source_reference,
    p_source_batch_code,
    p_quantity,
    p_quantity,
    COALESCE(p_unit_cost, 0),
    'pending',
    p_notes,
    p_user_id,
    p_user_id
  )
  ON CONFLICT (company_id, source_type, source_line_id)
  DO UPDATE SET
    quantity = public.putaway_tasks.quantity + EXCLUDED.quantity,
    pending_quantity = public.putaway_tasks.pending_quantity + EXCLUDED.pending_quantity,
    unit_cost = EXCLUDED.unit_cost,
    status = CASE
      WHEN public.putaway_tasks.posted_quantity > 0 THEN 'partial'
      ELSE 'pending'
    END,
    updated_by = p_user_id,
    updated_at = NOW()
  RETURNING id INTO v_task_id;

  RETURN v_task_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_putaway_task(
  p_task_id UUID,
  p_location_id UUID,
  p_quantity NUMERIC,
  p_batch_code TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  transaction_id UUID,
  batch_location_id UUID,
  batch_location_sku TEXT,
  batch_code TEXT,
  posted_quantity NUMERIC,
  posted_date DATE,
  location_id UUID
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_task public.putaway_tasks%ROWTYPE;
  v_batch_id UUID;
  v_transaction_id UUID;
  v_batch_location_id UUID;
  v_batch_location_sku TEXT;
  v_batch_code TEXT;
  v_current_stock NUMERIC;
  v_next_pending NUMERIC;
  v_next_posted NUMERIC;
BEGIN
  SELECT *
  INTO v_task
  FROM public.putaway_tasks
  WHERE id = p_task_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Putaway task not found';
  END IF;

  IF v_task.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Putaway task is not open';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Putaway quantity must be greater than zero';
  END IF;

  IF p_quantity > v_task.pending_quantity THEN
    RAISE EXCEPTION 'Putaway quantity exceeds pending quantity';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.warehouse_locations wl
    WHERE wl.id = p_location_id
      AND wl.company_id = v_task.company_id
      AND wl.warehouse_id = v_task.warehouse_id
      AND wl.is_active IS TRUE
      AND wl.is_storable IS TRUE
      AND wl.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Selected location is not valid for putaway';
  END IF;

  v_batch_code := COALESCE(NULLIF(BTRIM(p_batch_code), ''), v_task.source_batch_code);

  IF v_batch_code IS NULL OR BTRIM(v_batch_code) = '' THEN
    RAISE EXCEPTION 'Batch code is required';
  END IF;

  SELECT COALESCE(current_stock, 0)
  INTO v_current_stock
  FROM public.item_warehouse
  WHERE company_id = v_task.company_id
    AND item_id = v_task.item_id
    AND warehouse_id = v_task.warehouse_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item warehouse stock not found';
  END IF;

  INSERT INTO public.item_batches (
    company_id,
    item_id,
    warehouse_id,
    batch_code,
    received_at,
    qty_on_hand,
    qty_reserved,
    created_by,
    updated_by
  )
  VALUES (
    v_task.company_id,
    v_task.item_id,
    v_task.warehouse_id,
    v_batch_code,
    NOW(),
    p_quantity,
    0,
    p_user_id,
    p_user_id
  )
  ON CONFLICT ON CONSTRAINT item_batches_company_item_warehouse_batch_code_key
  DO UPDATE SET
    qty_on_hand = COALESCE(public.item_batches.qty_on_hand, 0) + EXCLUDED.qty_on_hand,
    deleted_at = NULL,
    updated_by = p_user_id,
    updated_at = NOW()
  RETURNING id INTO v_batch_id;

  INSERT INTO public.item_batch_locations (
    company_id,
    item_id,
    warehouse_id,
    location_id,
    item_batch_id,
    qty_on_hand,
    qty_reserved,
    created_by,
    updated_by
  )
  VALUES (
    v_task.company_id,
    v_task.item_id,
    v_task.warehouse_id,
    p_location_id,
    v_batch_id,
    p_quantity,
    0,
    p_user_id,
    p_user_id
  )
  ON CONFLICT ON CONSTRAINT item_batch_locations_company_item_warehouse_location_batch_key
  DO UPDATE SET
    qty_on_hand = public.item_batch_locations.qty_on_hand + EXCLUDED.qty_on_hand,
    deleted_at = NULL,
    updated_by = p_user_id,
    updated_at = NOW()
  RETURNING public.item_batch_locations.id, public.item_batch_locations.batch_location_sku
  INTO v_batch_location_id, v_batch_location_sku;

  UPDATE public.item_warehouse
  SET putaway_qty = COALESCE(putaway_qty, 0) - p_quantity,
      default_location_id = COALESCE(default_location_id, p_location_id),
      updated_by = p_user_id,
      updated_at = NOW()
  WHERE company_id = v_task.company_id
    AND item_id = v_task.item_id
    AND warehouse_id = v_task.warehouse_id
    AND deleted_at IS NULL;

  INSERT INTO public.stock_transactions (
    company_id,
    business_unit_id,
    transaction_type,
    transaction_date,
    warehouse_id,
    to_location_id,
    reference_type,
    reference_id,
    reference_code,
    notes,
    status,
    created_by,
    updated_by
  )
  VALUES (
    v_task.company_id,
    v_task.business_unit_id,
    'transfer',
    CURRENT_DATE,
    v_task.warehouse_id,
    p_location_id,
    'putaway_task',
    v_task.id,
    v_task.source_reference,
    'Putaway posted',
    'posted',
    p_user_id,
    p_user_id
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
  )
  VALUES (
    v_task.company_id,
    v_transaction_id,
    v_task.item_id,
    p_quantity,
    v_task.uom_id,
    v_task.unit_cost,
    v_task.unit_cost * p_quantity,
    v_batch_code,
    v_current_stock,
    v_current_stock,
    v_task.unit_cost,
    v_current_stock * v_task.unit_cost,
    v_current_stock * v_task.unit_cost,
    CURRENT_DATE,
    CURRENT_TIME,
    p_user_id,
    p_user_id
  );

  v_next_pending := v_task.pending_quantity - p_quantity;
  v_next_posted := v_task.posted_quantity + p_quantity;

  UPDATE public.putaway_tasks
  SET pending_quantity = v_next_pending,
      posted_quantity = v_next_posted,
      status = CASE WHEN v_next_pending = 0 THEN 'completed' ELSE 'partial' END,
      updated_by = p_user_id,
      updated_at = NOW()
  WHERE id = v_task.id;

  RETURN QUERY
  SELECT
    v_transaction_id,
    v_batch_location_id,
    v_batch_location_sku,
    v_batch_code,
    p_quantity,
    CURRENT_DATE,
    p_location_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_transformation_output_putaway(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_order_id UUID,
  p_output_line_id UUID,
  p_item_id UUID,
  p_warehouse_id UUID,
  p_uom_id UUID,
  p_order_code TEXT,
  p_transaction_date DATE,
  p_produced_quantity NUMERIC,
  p_wasted_quantity NUMERIC,
  p_waste_reason TEXT,
  p_unit_cost NUMERIC,
  p_total_cost NUMERIC,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
  v_current_stock NUMERIC := 0;
  v_next_stock NUMERIC := 0;
BEGIN
  IF p_produced_quantity <= 0 THEN
    RAISE EXCEPTION 'Produced quantity must be greater than zero';
  END IF;

  PERFORM 1
  FROM public.transformation_order_outputs too
  WHERE too.id = p_output_line_id
    AND too.order_id = p_order_id
    AND too.item_id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transformation output line not found';
  END IF;

  SELECT COALESCE(iw.current_stock, 0)
  INTO v_current_stock
  FROM public.item_warehouse iw
  WHERE iw.company_id = p_company_id
    AND iw.item_id = p_item_id
    AND iw.warehouse_id = p_warehouse_id
    AND iw.deleted_at IS NULL
  FOR UPDATE;

  v_current_stock := COALESCE(v_current_stock, 0);
  v_next_stock := v_current_stock + p_produced_quantity;

  INSERT INTO public.stock_transactions (
    company_id,
    business_unit_id,
    transaction_type,
    transaction_date,
    warehouse_id,
    reference_type,
    reference_id,
    reference_code,
    notes,
    status,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    p_business_unit_id,
    'in',
    COALESCE(p_transaction_date, CURRENT_DATE),
    p_warehouse_id,
    'transformation_order',
    p_order_id,
    p_order_code,
    'Transformation output production pending putaway - ' || p_order_code,
    'posted',
    p_user_id,
    p_user_id
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
    qty_before,
    qty_after,
    valuation_rate,
    stock_value_before,
    stock_value_after,
    posting_date,
    posting_time,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    v_transaction_id,
    p_item_id,
    p_produced_quantity,
    p_uom_id,
    COALESCE(p_unit_cost, 0),
    COALESCE(p_total_cost, 0),
    v_current_stock,
    v_next_stock,
    COALESCE(p_unit_cost, 0),
    v_current_stock * COALESCE(p_unit_cost, 0),
    v_next_stock * COALESCE(p_unit_cost, 0),
    COALESCE(p_transaction_date, CURRENT_DATE),
    CURRENT_TIME,
    p_user_id,
    p_user_id
  );

  PERFORM public.create_putaway_task(
    p_company_id,
    p_business_unit_id,
    p_warehouse_id,
    p_item_id,
    p_uom_id,
    'transformation_order',
    p_order_id,
    p_output_line_id,
    p_order_code,
    p_produced_quantity,
    p_unit_cost,
    p_user_id,
    NULL,
    'Transformation output production pending putaway - ' || p_order_code
  );

  UPDATE public.transformation_order_outputs
  SET produced_quantity = p_produced_quantity,
      wasted_quantity = COALESCE(p_wasted_quantity, 0),
      waste_reason = NULLIF(BTRIM(COALESCE(p_waste_reason, '')), ''),
      allocated_cost_per_unit = COALESCE(p_unit_cost, 0),
      total_allocated_cost = COALESCE(p_total_cost, 0),
      stock_transaction_id = v_transaction_id,
      updated_by = p_user_id,
      updated_at = NOW()
  WHERE id = p_output_line_id;

  RETURN v_transaction_id;
END;
$$;

COMMENT ON TABLE public.putaway_tasks IS
  'Shared queue for stock that is physically in the warehouse but not yet assigned to final batch/location inventory.';

COMMENT ON COLUMN public.item_warehouse.putaway_qty IS
  'Physical stock pending putaway. Included in current_stock and excluded from available_stock.';

CREATE OR REPLACE VIEW public.v_inventory_recon_item_warehouse_vs_batch AS
WITH batch_totals AS (
  SELECT
    company_id,
    item_id,
    warehouse_id,
    SUM(COALESCE(qty_on_hand, 0))::NUMERIC AS batch_qty
  FROM public.item_batches
  WHERE deleted_at IS NULL
  GROUP BY company_id, item_id, warehouse_id
)
SELECT
  iw.company_id,
  iw.item_id,
  iw.warehouse_id,
  (COALESCE(iw.current_stock, 0) - COALESCE(iw.putaway_qty, 0))::NUMERIC AS warehouse_qty,
  COALESCE(bt.batch_qty, 0)::NUMERIC AS batch_qty,
  (
    COALESCE(iw.current_stock, 0)
    - COALESCE(iw.putaway_qty, 0)
    - COALESCE(bt.batch_qty, 0)
  )::NUMERIC AS qty_diff
FROM public.item_warehouse iw
LEFT JOIN batch_totals bt
  ON bt.company_id = iw.company_id
 AND bt.item_id = iw.item_id
 AND bt.warehouse_id = iw.warehouse_id
WHERE iw.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.v_inventory_recon_item_warehouse_vs_batch_location AS
WITH batch_location_totals AS (
  SELECT
    company_id,
    item_id,
    warehouse_id,
    SUM(COALESCE(qty_on_hand, 0))::NUMERIC AS batch_location_qty
  FROM public.item_batch_locations
  WHERE deleted_at IS NULL
  GROUP BY company_id, item_id, warehouse_id
)
SELECT
  iw.company_id,
  iw.item_id,
  iw.warehouse_id,
  NULL::UUID AS location_id,
  (COALESCE(iw.current_stock, 0) - COALESCE(iw.putaway_qty, 0))::NUMERIC AS warehouse_qty,
  COALESCE(blt.batch_location_qty, 0)::NUMERIC AS batch_location_qty,
  (
    COALESCE(iw.current_stock, 0)
    - COALESCE(iw.putaway_qty, 0)
    - COALESCE(blt.batch_location_qty, 0)
  )::NUMERIC AS qty_diff
FROM public.item_warehouse iw
LEFT JOIN batch_location_totals blt
  ON blt.company_id = iw.company_id
 AND blt.item_id = iw.item_id
 AND blt.warehouse_id = iw.warehouse_id
WHERE iw.deleted_at IS NULL;

COMMENT ON VIEW public.v_inventory_recon_item_warehouse_vs_batch IS
  'Reconciles final placed warehouse stock against item_batches, excluding item_warehouse.putaway_qty because pending putaway stock is not yet in final batch records.';

COMMENT ON VIEW public.v_inventory_recon_item_warehouse_vs_batch_location IS
  'Reconciles final placed warehouse stock against item_batch_locations, excluding item_warehouse.putaway_qty because pending putaway stock is not yet in final batch-location records.';

DROP FUNCTION IF EXISTS public.get_items_enhanced_page(
  UUID,
  TEXT,
  UUID,
  UUID,
  TEXT,
  TEXT,
  UUID,
  INTEGER,
  INTEGER
);

CREATE OR REPLACE FUNCTION public.get_items_enhanced_page(
  p_company_id UUID,
  p_search TEXT DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_warehouse_id UUID DEFAULT NULL,
  p_item_type TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_business_unit_id UUID DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  item_code TEXT,
  supplier_code TEXT,
  item_name TEXT,
  item_name_cn TEXT,
  category_id UUID,
  category_name TEXT,
  uom_id UUID,
  uom_code TEXT,
  purchase_price NUMERIC,
  import_cost NUMERIC,
  import_currency TEXT,
  sales_price NUMERIC,
  item_type TEXT,
  custom_fields JSONB,
  is_active BOOLEAN,
  image_url TEXT,
  on_hand NUMERIC,
  allocated NUMERIC,
  available NUMERIC,
  putaway_qty NUMERIC,
  reorder_point NUMERIC,
  max_stock_level NUMERIC,
  in_transit NUMERIC,
  estimated_arrival_date TIMESTAMP,
  status TEXT,
  total_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
WITH filtered_items AS (
  SELECT
    i.id,
    i.item_code,
    i.supplier_code,
    i.item_name,
    i.item_name_cn,
    i.category_id,
    ic.name AS category_name,
    i.uom_id,
    u.code AS uom_code,
    i.purchase_price,
    i.import_cost,
    i.import_currency,
    i.sales_price,
    i.item_type,
    i.custom_fields,
    COALESCE(i.is_active, true) AS is_active,
    i.image_url,
    COALESCE(i.reorder_level, 0) AS reorder_point
  FROM public.items i
  LEFT JOIN public.item_categories ic ON ic.id = i.category_id
  LEFT JOIN public.units_of_measure u ON u.id = i.uom_id
  WHERE i.company_id = p_company_id
    AND i.deleted_at IS NULL
    AND (
      p_search IS NULL
      OR p_search = ''
      OR i.item_code ILIKE ('%' || p_search || '%')
      OR COALESCE(i.supplier_code, '') ILIKE ('%' || p_search || '%')
      OR i.item_name ILIKE ('%' || p_search || '%')
      OR COALESCE(i.item_name_cn, '') ILIKE ('%' || p_search || '%')
      OR EXISTS (
        SELECT 1
        FROM public.item_unit_options iuo
        WHERE iuo.company_id = i.company_id
          AND iuo.item_id = i.id
          AND iuo.deleted_at IS NULL
          AND COALESCE(iuo.barcode, '') ILIKE ('%' || p_search || '%')
      )
    )
    AND (p_category_id IS NULL OR i.category_id = p_category_id)
    AND (p_item_type IS NULL OR i.item_type = p_item_type)
),
warehouse_scope AS (
  SELECT
    iw.item_id,
    iw.current_stock,
    iw.reserved_stock,
    iw.available_stock AS available,
    iw.putaway_qty,
    iw.max_quantity,
    iw.in_transit,
    iw.estimated_arrival_date
  FROM public.item_warehouse iw
  INNER JOIN public.warehouses w ON w.id = iw.warehouse_id
  WHERE iw.company_id = p_company_id
    AND iw.deleted_at IS NULL
    AND w.deleted_at IS NULL
    AND (p_warehouse_id IS NULL OR iw.warehouse_id = p_warehouse_id)
    AND (
      p_warehouse_id IS NOT NULL
      OR p_business_unit_id IS NULL
      OR w.business_unit_id = p_business_unit_id
    )
),
stock_agg AS (
  SELECT
    ws.item_id,
    SUM(COALESCE(ws.current_stock, 0)) AS on_hand,
    SUM(COALESCE(ws.reserved_stock, 0)) AS allocated,
    SUM(COALESCE(ws.available, 0)) AS available,
    SUM(COALESCE(ws.putaway_qty, 0)) AS putaway_qty,
    SUM(COALESCE(ws.max_quantity, 0)) AS max_stock_level,
    SUM(COALESCE(ws.in_transit, 0)) AS in_transit,
    MIN(ws.estimated_arrival_date) FILTER (WHERE ws.estimated_arrival_date IS NOT NULL)
      AS estimated_arrival_date
  FROM warehouse_scope ws
  GROUP BY ws.item_id
),
enriched AS (
  SELECT
    fi.id,
    fi.item_code,
    fi.supplier_code,
    fi.item_name,
    fi.item_name_cn,
    fi.category_id,
    fi.category_name,
    fi.uom_id,
    fi.uom_code,
    fi.purchase_price,
    fi.import_cost,
    fi.import_currency,
    fi.sales_price,
    fi.item_type,
    fi.custom_fields,
    fi.is_active,
    fi.image_url,
    COALESCE(sa.on_hand, 0) AS on_hand,
    COALESCE(sa.allocated, 0) AS allocated,
    COALESCE(sa.available, 0) AS available,
    COALESCE(sa.putaway_qty, 0) AS putaway_qty,
    COALESCE(fi.reorder_point, 0) AS reorder_point,
    COALESCE(sa.max_stock_level, 0) AS max_stock_level,
    COALESCE(sa.in_transit, 0) AS in_transit,
    sa.estimated_arrival_date,
    CASE
      WHEN NOT fi.is_active THEN 'discontinued'
      WHEN COALESCE(sa.available, 0) <= 0 THEN 'out_of_stock'
      WHEN COALESCE(fi.reorder_point, 0) > 0
        AND COALESCE(sa.available, 0) <= COALESCE(fi.reorder_point, 0)
        THEN 'low_stock'
      WHEN COALESCE(sa.max_stock_level, 0) > 0
        AND COALESCE(sa.available, 0) > COALESCE(sa.max_stock_level, 0)
        THEN 'overstock'
      ELSE 'normal'
    END AS status
  FROM filtered_items fi
  LEFT JOIN stock_agg sa ON sa.item_id = fi.id
),
status_filtered AS (
  SELECT *
  FROM enriched e
  WHERE p_status IS NULL
    OR p_status = ''
    OR p_status = 'all'
    OR e.status = p_status
)
SELECT
  sf.id,
  sf.item_code,
  sf.supplier_code,
  sf.item_name,
  sf.item_name_cn,
  sf.category_id,
  sf.category_name,
  sf.uom_id,
  sf.uom_code,
  sf.purchase_price,
  sf.import_cost,
  sf.import_currency,
  sf.sales_price,
  sf.item_type,
  sf.custom_fields,
  sf.is_active,
  sf.image_url,
  sf.on_hand,
  sf.allocated,
  sf.available,
  sf.putaway_qty,
  sf.reorder_point,
  sf.max_stock_level,
  sf.in_transit,
  sf.estimated_arrival_date,
  sf.status,
  COUNT(*) OVER() AS total_count
FROM status_filtered sf
ORDER BY sf.item_name ASC
OFFSET (GREATEST(p_page, 1) - 1) * GREATEST(p_limit, 1)
LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_items_enhanced_page(UUID, TEXT, UUID, UUID, TEXT, TEXT, UUID, INTEGER, INTEGER) TO authenticated;

COMMIT;
