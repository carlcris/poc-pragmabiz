-- Add item-level reorder defaults and seasonal reorder policy overrides.

BEGIN;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS reorder_level NUMERIC(20, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_quantity NUMERIC(20, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_reorder_level_non_negative'
      AND conrelid = 'public.items'::regclass
  ) THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_reorder_level_non_negative CHECK (reorder_level >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_reorder_quantity_non_negative'
      AND conrelid = 'public.items'::regclass
  ) THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_reorder_quantity_non_negative CHECK (reorder_quantity >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.items.reorder_level IS
  'Default company-wide reorder alert threshold in the item base unit.';
COMMENT ON COLUMN public.items.reorder_quantity IS
  'Default company-wide suggested reorder quantity in the item base unit.';

CREATE TABLE IF NOT EXISTS public.reorder_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMP NULL,
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT reorder_seasons_effective_range_valid CHECK (effective_from <= effective_to)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reorder_seasons_company_code_active
  ON public.reorder_seasons(company_id, lower(code))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reorder_seasons_company_effective
  ON public.reorder_seasons(company_id, effective_from, effective_to)
  WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_reorder_seasons_company_priority
  ON public.reorder_seasons(company_id, priority)
  WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE TRIGGER trigger_reorder_seasons_updated_at
  BEFORE UPDATE ON public.reorder_seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.reorder_season_item_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  season_id UUID NOT NULL REFERENCES public.reorder_seasons(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  item_unit_option_id UUID REFERENCES public.item_unit_options(id) ON DELETE SET NULL,
  uom_id UUID NOT NULL REFERENCES public.units_of_measure(id),
  qty_per_unit NUMERIC(20, 2) NOT NULL,
  reorder_level NUMERIC(20, 2) NOT NULL,
  reorder_quantity NUMERIC(20, 2) NOT NULL,
  base_reorder_level NUMERIC(20, 2)
    GENERATED ALWAYS AS (reorder_level * qty_per_unit) STORED,
  base_reorder_quantity NUMERIC(20, 2)
    GENERATED ALWAYS AS (reorder_quantity * qty_per_unit) STORED,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMP NULL,
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT reorder_season_item_policies_level_non_negative CHECK (reorder_level >= 0),
  CONSTRAINT reorder_season_item_policies_quantity_non_negative CHECK (reorder_quantity >= 0),
  CONSTRAINT reorder_season_item_policies_qty_per_unit_positive CHECK (qty_per_unit > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reorder_season_item_policies_season_item_active
  ON public.reorder_season_item_policies(season_id, item_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reorder_season_item_policies_company
  ON public.reorder_season_item_policies(company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reorder_season_item_policies_item
  ON public.reorder_season_item_policies(item_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reorder_season_item_policies_unit_option
  ON public.reorder_season_item_policies(item_unit_option_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_reorder_season_item_policies_updated_at
  BEFORE UPDATE ON public.reorder_season_item_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.reorder_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reorder_season_item_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read reorder_seasons" ON public.reorder_seasons;
CREATE POLICY "Allow authenticated users to read reorder_seasons"
  ON public.reorder_seasons FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to write reorder_seasons" ON public.reorder_seasons;
CREATE POLICY "Allow authenticated users to write reorder_seasons"
  ON public.reorder_seasons FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to read reorder_season_item_policies" ON public.reorder_season_item_policies;
CREATE POLICY "Allow authenticated users to read reorder_season_item_policies"
  ON public.reorder_season_item_policies FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to write reorder_season_item_policies" ON public.reorder_season_item_policies;
CREATE POLICY "Allow authenticated users to write reorder_season_item_policies"
  ON public.reorder_season_item_policies FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.reorder_seasons_prevent_same_priority_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL OR COALESCE(NEW.is_active, FALSE) = FALSE THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.company_id::TEXT), NEW.priority);

  IF EXISTS (
    SELECT 1
    FROM public.reorder_seasons rs
    WHERE rs.company_id = NEW.company_id
      AND rs.priority = NEW.priority
      AND rs.is_active = TRUE
      AND rs.deleted_at IS NULL
      AND rs.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND daterange(rs.effective_from, rs.effective_to, '[]')
        && daterange(NEW.effective_from, NEW.effective_to, '[]')
  ) THEN
    RAISE EXCEPTION 'An active reorder season with the same priority already overlaps this effective date range'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_reorder_seasons_prevent_same_priority_overlap ON public.reorder_seasons;
CREATE TRIGGER trigger_reorder_seasons_prevent_same_priority_overlap
  BEFORE INSERT OR UPDATE OF company_id, effective_from, effective_to, priority, is_active, deleted_at
  ON public.reorder_seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.reorder_seasons_prevent_same_priority_overlap();

CREATE OR REPLACE FUNCTION public.reorder_season_item_policies_validate_company()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_season_company_id UUID;
  v_item_company_id UUID;
  v_item_uom_id UUID;
  v_unit_option_company_id UUID;
  v_unit_option_item_id UUID;
  v_unit_option_uom_id UUID;
  v_unit_option_qty_per_unit NUMERIC;
BEGIN
  SELECT rs.company_id
    INTO v_season_company_id
  FROM public.reorder_seasons rs
  WHERE rs.id = NEW.season_id
    AND rs.deleted_at IS NULL;

  IF v_season_company_id IS NULL THEN
    RAISE EXCEPTION 'Reorder season not found' USING ERRCODE = '23503';
  END IF;

  SELECT i.company_id, i.uom_id
    INTO v_item_company_id, v_item_uom_id
  FROM public.items i
  WHERE i.id = NEW.item_id
    AND i.deleted_at IS NULL;

  IF v_item_company_id IS NULL THEN
    RAISE EXCEPTION 'Item not found' USING ERRCODE = '23503';
  END IF;

  IF NEW.company_id <> v_season_company_id OR NEW.company_id <> v_item_company_id THEN
    RAISE EXCEPTION 'Seasonal reorder policy company does not match season and item'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.item_unit_option_id IS NOT NULL THEN
    SELECT iuo.company_id, iuo.item_id, iuo.uom_id, iuo.qty_per_unit
      INTO v_unit_option_company_id, v_unit_option_item_id, v_unit_option_uom_id, v_unit_option_qty_per_unit
    FROM public.item_unit_options iuo
    WHERE iuo.id = NEW.item_unit_option_id
      AND iuo.deleted_at IS NULL
      AND iuo.is_active = TRUE;

    IF v_unit_option_company_id IS NULL THEN
      RAISE EXCEPTION 'Item unit option not found' USING ERRCODE = '23503';
    END IF;

    IF v_unit_option_company_id <> NEW.company_id OR v_unit_option_item_id <> NEW.item_id THEN
      RAISE EXCEPTION 'Seasonal reorder policy unit option does not match item'
        USING ERRCODE = '23514';
    END IF;

    IF v_unit_option_uom_id <> NEW.uom_id OR v_unit_option_qty_per_unit <> NEW.qty_per_unit THEN
      RAISE EXCEPTION 'Seasonal reorder policy unit snapshot does not match selected unit option'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.uom_id <> v_item_uom_id OR NEW.qty_per_unit <> 1 THEN
      RAISE EXCEPTION 'Seasonal reorder policy without unit option must use item base unit'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_reorder_season_item_policies_validate_company ON public.reorder_season_item_policies;
CREATE TRIGGER trigger_reorder_season_item_policies_validate_company
  BEFORE INSERT OR UPDATE OF company_id, season_id, item_id, item_unit_option_id, uom_id, qty_per_unit
  ON public.reorder_season_item_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.reorder_season_item_policies_validate_company();

CREATE OR REPLACE FUNCTION public.get_effective_reorder_alerts(
  p_company_id UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE,
  p_search TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  total_current_stock NUMERIC,
  total_available_stock NUMERIC,
  reorder_point NUMERIC,
  reorder_quantity NUMERIC,
  minimum_level NUMERIC,
  severity TEXT,
  message TEXT,
  policy_source TEXT,
  season_id UUID,
  season_code TEXT,
  season_name TEXT,
  warehouse_breakdown JSONB,
  total_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
WITH active_season AS (
  SELECT rs.id, rs.code, rs.name
  FROM public.reorder_seasons rs
  WHERE rs.company_id = p_company_id
    AND rs.is_active = TRUE
    AND rs.deleted_at IS NULL
    AND p_as_of_date BETWEEN rs.effective_from AND rs.effective_to
  ORDER BY rs.priority DESC, rs.effective_from DESC, rs.created_at DESC
  LIMIT 1
),
stock_agg AS (
  SELECT
    iw.item_id,
    SUM(COALESCE(iw.current_stock, 0)) AS total_current_stock,
    SUM(COALESCE(iw.available_stock, COALESCE(iw.current_stock, 0) - COALESCE(iw.reserved_stock, 0))) AS total_available_stock,
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'warehouseId', iw.warehouse_id,
        'warehouseCode', w.warehouse_code,
        'warehouseName', w.warehouse_name,
        'currentStock', COALESCE(iw.current_stock, 0),
        'availableStock', COALESCE(iw.available_stock, COALESCE(iw.current_stock, 0) - COALESCE(iw.reserved_stock, 0))
      )
      ORDER BY w.warehouse_name
    ) AS warehouse_breakdown
  FROM public.item_warehouse iw
  INNER JOIN public.warehouses w ON w.id = iw.warehouse_id
  WHERE iw.company_id = p_company_id
    AND iw.deleted_at IS NULL
    AND w.deleted_at IS NULL
  GROUP BY iw.item_id
),
effective_items AS (
  SELECT
    i.id,
    i.item_code,
    i.item_name,
    COALESCE(sa.total_current_stock, 0) AS total_current_stock,
    COALESCE(sa.total_available_stock, 0) AS total_available_stock,
    COALESCE(sip.base_reorder_level, i.reorder_level, 0) AS reorder_point,
    COALESCE(sip.base_reorder_quantity, i.reorder_quantity, 0) AS reorder_quantity,
    COALESCE(sip.base_reorder_level, i.reorder_level, 0) * 0.5 AS minimum_level,
    CASE
      WHEN sip.id IS NOT NULL THEN 'season_override'
      ELSE 'item_default'
    END AS policy_source,
    active_season.id AS season_id,
    active_season.code AS season_code,
    active_season.name AS season_name,
    COALESCE(sa.warehouse_breakdown, '[]'::JSONB) AS warehouse_breakdown
  FROM public.items i
  LEFT JOIN stock_agg sa ON sa.item_id = i.id
  LEFT JOIN active_season ON TRUE
  LEFT JOIN public.reorder_season_item_policies sip
    ON sip.company_id = i.company_id
   AND sip.item_id = i.id
   AND sip.season_id = active_season.id
   AND sip.is_active = TRUE
   AND sip.deleted_at IS NULL
  WHERE i.company_id = p_company_id
    AND i.deleted_at IS NULL
    AND COALESCE(i.is_active, TRUE) = TRUE
    AND (
      p_search IS NULL
      OR p_search = ''
      OR i.item_code ILIKE ('%' || p_search || '%')
      OR i.item_name ILIKE ('%' || p_search || '%')
      OR COALESCE(i.item_name_cn, '') ILIKE ('%' || p_search || '%')
      OR COALESCE(i.supplier_code, '') ILIKE ('%' || p_search || '%')
    )
),
alerts AS (
  SELECT
    ei.*,
    CASE
      WHEN ei.total_available_stock <= 0 THEN 'critical'
      WHEN ei.total_available_stock <= ei.reorder_point * 0.5 THEN 'critical'
      ELSE 'warning'
    END AS alert_severity
  FROM effective_items ei
  WHERE ei.reorder_point > 0
    AND ei.total_available_stock < ei.reorder_point
),
severity_filtered AS (
  SELECT *
  FROM alerts a
  WHERE p_severity IS NULL
    OR p_severity = ''
    OR p_severity = 'all'
    OR a.alert_severity = p_severity
)
SELECT
  sf.id,
  sf.id AS item_id,
  sf.item_code,
  sf.item_name,
  sf.total_current_stock,
  sf.total_available_stock,
  sf.reorder_point,
  sf.reorder_quantity,
  sf.minimum_level,
  sf.alert_severity AS severity,
  CASE
    WHEN sf.total_available_stock <= 0 THEN 'Out of stock - immediate action required'
    WHEN sf.alert_severity = 'critical' THEN
      'Critical low stock: ' || sf.total_available_stock::TEXT || ' units available'
    ELSE
      'Low stock: ' || sf.total_available_stock::TEXT || ' units available'
  END AS message,
  sf.policy_source,
  sf.season_id,
  sf.season_code,
  sf.season_name,
  sf.warehouse_breakdown,
  COUNT(*) OVER() AS total_count
FROM severity_filtered sf
ORDER BY
  CASE sf.alert_severity WHEN 'critical' THEN 0 ELSE 1 END,
  sf.item_name ASC
OFFSET (GREATEST(p_page, 1) - 1) * GREATEST(p_limit, 1)
LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

CREATE OR REPLACE FUNCTION public.get_reorder_statistics(
  p_company_id UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_items_tracked BIGINT,
  items_ok BIGINT,
  items_low_stock BIGINT,
  items_critical BIGINT,
  items_out_of_stock BIGINT,
  pending_suggestions BIGINT,
  approved_suggestions BIGINT,
  total_estimated_reorder_cost NUMERIC,
  active_alerts BIGINT
)
LANGUAGE sql
STABLE
AS $$
WITH active_season AS (
  SELECT rs.id
  FROM public.reorder_seasons rs
  WHERE rs.company_id = p_company_id
    AND rs.is_active = TRUE
    AND rs.deleted_at IS NULL
    AND p_as_of_date BETWEEN rs.effective_from AND rs.effective_to
  ORDER BY rs.priority DESC, rs.effective_from DESC, rs.created_at DESC
  LIMIT 1
),
stock_agg AS (
  SELECT
    iw.item_id,
    SUM(COALESCE(iw.available_stock, COALESCE(iw.current_stock, 0) - COALESCE(iw.reserved_stock, 0))) AS total_available_stock
  FROM public.item_warehouse iw
  INNER JOIN public.warehouses w ON w.id = iw.warehouse_id
  WHERE iw.company_id = p_company_id
    AND iw.deleted_at IS NULL
    AND w.deleted_at IS NULL
  GROUP BY iw.item_id
),
effective_items AS (
  SELECT
    i.id,
    COALESCE(i.purchase_price, 0) AS purchase_price,
    COALESCE(sa.total_available_stock, 0) AS total_available_stock,
    COALESCE(sip.base_reorder_level, i.reorder_level, 0) AS reorder_point,
    COALESCE(sip.base_reorder_quantity, i.reorder_quantity, 0) AS reorder_quantity
  FROM public.items i
  LEFT JOIN stock_agg sa ON sa.item_id = i.id
  LEFT JOIN active_season ON TRUE
  LEFT JOIN public.reorder_season_item_policies sip
    ON sip.company_id = i.company_id
   AND sip.item_id = i.id
   AND sip.season_id = active_season.id
   AND sip.is_active = TRUE
   AND sip.deleted_at IS NULL
  WHERE i.company_id = p_company_id
    AND i.deleted_at IS NULL
    AND COALESCE(i.is_active, TRUE) = TRUE
),
classified AS (
  SELECT
    ei.*,
    CASE
      WHEN ei.reorder_point <= 0 THEN 'untracked'
      WHEN ei.total_available_stock <= 0 THEN 'out_of_stock'
      WHEN ei.total_available_stock <= ei.reorder_point * 0.5 THEN 'critical'
      WHEN ei.total_available_stock < ei.reorder_point THEN 'low_stock'
      ELSE 'ok'
    END AS reorder_status
  FROM effective_items ei
)
SELECT
  COUNT(*) FILTER (WHERE reorder_status <> 'untracked') AS total_items_tracked,
  COUNT(*) FILTER (WHERE reorder_status = 'ok') AS items_ok,
  COUNT(*) FILTER (WHERE reorder_status = 'low_stock') AS items_low_stock,
  COUNT(*) FILTER (WHERE reorder_status = 'critical') AS items_critical,
  COUNT(*) FILTER (WHERE reorder_status = 'out_of_stock') AS items_out_of_stock,
  0::BIGINT AS pending_suggestions,
  0::BIGINT AS approved_suggestions,
  COALESCE(SUM(reorder_quantity * purchase_price) FILTER (
    WHERE reorder_status IN ('low_stock', 'critical', 'out_of_stock')
  ), 0) AS total_estimated_reorder_cost,
  COUNT(*) FILTER (WHERE reorder_status IN ('low_stock', 'critical', 'out_of_stock')) AS active_alerts
FROM classified;
$$;

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

DROP FUNCTION IF EXISTS public.get_items_enhanced_stats(
  UUID,
  TEXT,
  UUID,
  UUID,
  TEXT,
  TEXT,
  UUID
);

CREATE OR REPLACE FUNCTION public.get_items_enhanced_stats(
  p_company_id UUID,
  p_search TEXT DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_warehouse_id UUID DEFAULT NULL,
  p_item_type TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_business_unit_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_available_value NUMERIC,
  low_stock_count BIGINT,
  out_of_stock_count BIGINT,
  total_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
WITH filtered_items AS (
  SELECT
    i.id,
    COALESCE(i.is_active, true) AS is_active,
    COALESCE(i.sales_price, 0) AS sales_price,
    COALESCE(i.reorder_level, 0) AS reorder_point
  FROM public.items i
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
    iw.available_stock AS available,
    iw.max_quantity
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
    SUM(COALESCE(ws.available, 0)) AS available,
    SUM(COALESCE(ws.max_quantity, 0)) AS max_stock_level
  FROM warehouse_scope ws
  GROUP BY ws.item_id
),
enriched AS (
  SELECT
    fi.id,
    fi.sales_price,
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
    END AS status,
    COALESCE(sa.available, 0) AS available
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
  COALESCE(SUM(sf.available * sf.sales_price), 0) AS total_available_value,
  COUNT(*) FILTER (WHERE sf.status = 'low_stock') AS low_stock_count,
  COUNT(*) FILTER (WHERE sf.status = 'out_of_stock') AS out_of_stock_count,
  COUNT(*) AS total_count
FROM status_filtered sf;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_reorder_alerts(UUID, DATE, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reorder_statistics(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_items_enhanced_page(UUID, TEXT, UUID, UUID, TEXT, TEXT, UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_items_enhanced_stats(UUID, TEXT, UUID, UUID, TEXT, TEXT, UUID) TO authenticated;

COMMIT;
