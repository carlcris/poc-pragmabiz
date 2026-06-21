-- Migration: Add supplier code to items
-- Date: 2026-06-19

BEGIN;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS supplier_code VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_items_company_supplier_code
  ON public.items(company_id, supplier_code)
  WHERE deleted_at IS NULL AND supplier_code IS NOT NULL;

COMMENT ON COLUMN public.items.supplier_code IS
  'Optional supplier-provided item code used for vendor catalogs and purchasing references.';

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
    i.image_url
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
    iw.reorder_level,
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
    MAX(COALESCE(ws.reorder_level, 0)) AS reorder_point,
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
    COALESCE(sa.reorder_point, 0) AS reorder_point,
    COALESCE(sa.max_stock_level, 0) AS max_stock_level,
    COALESCE(sa.in_transit, 0) AS in_transit,
    sa.estimated_arrival_date,
    CASE
      WHEN NOT fi.is_active THEN 'discontinued'
      WHEN COALESCE(sa.available, 0) <= 0 THEN 'out_of_stock'
      WHEN COALESCE(sa.reorder_point, 0) > 0
        AND COALESCE(sa.available, 0) <= COALESCE(sa.reorder_point, 0)
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
    COALESCE(i.sales_price, 0) AS sales_price
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
    iw.reorder_level,
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
    MAX(COALESCE(ws.reorder_level, 0)) AS reorder_point,
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
      WHEN COALESCE(sa.reorder_point, 0) > 0
        AND COALESCE(sa.available, 0) <= COALESCE(sa.reorder_point, 0)
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

COMMIT;
