-- Optimize items-enhanced endpoint by pushing inventory aggregation and status filtering to DB level.

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
  sku TEXT,
  item_name TEXT,
  item_name_cn TEXT,
  category_id UUID,
  category_name TEXT,
  uom_id UUID,
  uom_code TEXT,
  cost_price NUMERIC,
  purchase_price NUMERIC,
  sales_price NUMERIC,
  item_type TEXT,
  is_active BOOLEAN,
  image_url TEXT,
  on_hand NUMERIC,
  allocated NUMERIC,
  available NUMERIC,
  reorder_point NUMERIC,
  on_po NUMERIC,
  on_so NUMERIC,
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
    i.sku,
    i.item_name,
    i.item_name_cn,
    i.category_id,
    ic.name AS category_name,
    i.uom_id,
    u.code AS uom_code,
    i.cost_price,
    i.purchase_price,
    i.sales_price,
    i.item_type,
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
      OR COALESCE(i.sku, '') ILIKE ('%' || p_search || '%')
      OR i.item_name ILIKE ('%' || p_search || '%')
      OR COALESCE(i.item_name_cn, '') ILIKE ('%' || p_search || '%')
    )
    AND (p_category_id IS NULL OR i.category_id = p_category_id)
    AND (p_item_type IS NULL OR i.item_type = p_item_type)
),
warehouse_scope AS (
  SELECT
    iw.item_id,
    iw.current_stock,
    iw.reorder_level,
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
    MAX(COALESCE(ws.reorder_level, 0)) AS reorder_point,
    SUM(COALESCE(ws.in_transit, 0)) AS in_transit,
    MIN(ws.estimated_arrival_date) FILTER (WHERE ws.estimated_arrival_date IS NOT NULL)
      AS estimated_arrival_date
  FROM warehouse_scope ws
  GROUP BY ws.item_id
),
so_agg AS (
  SELECT
    soi.item_id,
    SUM(GREATEST(COALESCE(soi.quantity, 0) - COALESCE(soi.quantity_delivered, 0), 0)) AS allocated,
    SUM(COALESCE(soi.quantity, 0)) AS on_so
  FROM public.sales_order_items soi
  INNER JOIN public.sales_orders so ON so.id = soi.order_id
  WHERE so.company_id = p_company_id
    AND so.deleted_at IS NULL
    AND soi.deleted_at IS NULL
    AND so.status IN ('draft', 'confirmed', 'in_progress', 'shipped')
    AND (p_business_unit_id IS NULL OR so.business_unit_id = p_business_unit_id)
  GROUP BY soi.item_id
),
po_agg AS (
  SELECT
    poi.item_id,
    SUM(GREATEST(COALESCE(poi.quantity, 0) - COALESCE(poi.quantity_received, 0), 0)) AS on_po
  FROM public.purchase_order_items poi
  INNER JOIN public.purchase_orders po ON po.id = poi.purchase_order_id
  WHERE po.company_id = p_company_id
    AND po.deleted_at IS NULL
    AND poi.deleted_at IS NULL
    AND po.status IN ('draft', 'approved', 'partially_received')
    AND (p_business_unit_id IS NULL OR po.business_unit_id = p_business_unit_id)
  GROUP BY poi.item_id
),
enriched AS (
  SELECT
    fi.id,
    fi.item_code,
    fi.sku,
    fi.item_name,
    fi.item_name_cn,
    fi.category_id,
    fi.category_name,
    fi.uom_id,
    fi.uom_code,
    fi.cost_price,
    fi.purchase_price,
    fi.sales_price,
    fi.item_type,
    fi.is_active,
    fi.image_url,
    COALESCE(sa.on_hand, 0) AS on_hand,
    COALESCE(soa.allocated, 0) AS allocated,
    COALESCE(sa.on_hand, 0) - COALESCE(soa.allocated, 0) AS available,
    COALESCE(sa.reorder_point, 0) AS reorder_point,
    COALESCE(poa.on_po, 0) AS on_po,
    COALESCE(soa.on_so, 0) AS on_so,
    COALESCE(sa.in_transit, 0) AS in_transit,
    sa.estimated_arrival_date,
    CASE
      WHEN NOT fi.is_active THEN 'discontinued'
      WHEN (COALESCE(sa.on_hand, 0) - COALESCE(soa.allocated, 0)) <= 0 THEN 'out_of_stock'
      WHEN COALESCE(sa.reorder_point, 0) > 0
        AND (COALESCE(sa.on_hand, 0) - COALESCE(soa.allocated, 0)) <= COALESCE(sa.reorder_point, 0)
        THEN 'low_stock'
      WHEN COALESCE(sa.reorder_point, 0) > 0
        AND (COALESCE(sa.on_hand, 0) - COALESCE(soa.allocated, 0)) > (COALESCE(sa.reorder_point, 0) * 3)
        THEN 'overstock'
      ELSE 'normal'
    END AS status
  FROM filtered_items fi
  LEFT JOIN stock_agg sa ON sa.item_id = fi.id
  LEFT JOIN so_agg soa ON soa.item_id = fi.id
  LEFT JOIN po_agg poa ON poa.item_id = fi.id
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
  sf.sku,
  sf.item_name,
  sf.item_name_cn,
  sf.category_id,
  sf.category_name,
  sf.uom_id,
  sf.uom_code,
  sf.cost_price,
  sf.purchase_price,
  sf.sales_price,
  sf.item_type,
  sf.is_active,
  sf.image_url,
  sf.on_hand,
  sf.allocated,
  sf.available,
  sf.reorder_point,
  sf.on_po,
  sf.on_so,
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
      OR COALESCE(i.sku, '') ILIKE ('%' || p_search || '%')
      OR i.item_name ILIKE ('%' || p_search || '%')
      OR COALESCE(i.item_name_cn, '') ILIKE ('%' || p_search || '%')
    )
    AND (p_category_id IS NULL OR i.category_id = p_category_id)
    AND (p_item_type IS NULL OR i.item_type = p_item_type)
),
warehouse_scope AS (
  SELECT
    iw.item_id,
    iw.current_stock,
    iw.reorder_level
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
    MAX(COALESCE(ws.reorder_level, 0)) AS reorder_point
  FROM warehouse_scope ws
  GROUP BY ws.item_id
),
so_agg AS (
  SELECT
    soi.item_id,
    SUM(GREATEST(COALESCE(soi.quantity, 0) - COALESCE(soi.quantity_delivered, 0), 0)) AS allocated
  FROM public.sales_order_items soi
  INNER JOIN public.sales_orders so ON so.id = soi.order_id
  WHERE so.company_id = p_company_id
    AND so.deleted_at IS NULL
    AND soi.deleted_at IS NULL
    AND so.status IN ('draft', 'confirmed', 'in_progress', 'shipped')
    AND (p_business_unit_id IS NULL OR so.business_unit_id = p_business_unit_id)
  GROUP BY soi.item_id
),
enriched AS (
  SELECT
    fi.id,
    fi.sales_price,
    COALESCE(sa.on_hand, 0) - COALESCE(soa.allocated, 0) AS available,
    COALESCE(sa.reorder_point, 0) AS reorder_point,
    CASE
      WHEN NOT fi.is_active THEN 'discontinued'
      WHEN (COALESCE(sa.on_hand, 0) - COALESCE(soa.allocated, 0)) <= 0 THEN 'out_of_stock'
      WHEN COALESCE(sa.reorder_point, 0) > 0
        AND (COALESCE(sa.on_hand, 0) - COALESCE(soa.allocated, 0)) <= COALESCE(sa.reorder_point, 0)
        THEN 'low_stock'
      WHEN COALESCE(sa.reorder_point, 0) > 0
        AND (COALESCE(sa.on_hand, 0) - COALESCE(soa.allocated, 0)) > (COALESCE(sa.reorder_point, 0) * 3)
        THEN 'overstock'
      ELSE 'normal'
    END AS status
  FROM filtered_items fi
  LEFT JOIN stock_agg sa ON sa.item_id = fi.id
  LEFT JOIN so_agg soa ON soa.item_id = fi.id
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
  COALESCE(SUM(COALESCE(status_filtered.available, 0) * COALESCE(status_filtered.sales_price, 0)), 0)
    AS total_available_value,
  COUNT(*) FILTER (WHERE status_filtered.status = 'low_stock')::BIGINT AS low_stock_count,
  COUNT(*) FILTER (WHERE status_filtered.status = 'out_of_stock')::BIGINT AS out_of_stock_count,
  COUNT(*)::BIGINT AS total_count
FROM status_filtered;
$$;
