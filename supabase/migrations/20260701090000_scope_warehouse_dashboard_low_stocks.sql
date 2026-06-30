-- Scope warehouse dashboard low-stock rows to the selected business unit and
-- align the stock calculation with the inventory item list.

BEGIN;

DROP FUNCTION IF EXISTS public.get_warehouse_dashboard_low_stocks(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.get_warehouse_dashboard_low_stocks(
  p_company_id UUID,
  p_business_unit_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 8
)
RETURNS TABLE (
  item_id UUID,
  item_name TEXT,
  qty NUMERIC,
  uom TEXT,
  location_code TEXT,
  reorder_level NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH authorized AS (
  SELECT 1
  FROM public.users u
  WHERE u.id = auth.uid()
    AND u.company_id = p_company_id
    AND u.deleted_at IS NULL
    AND (
      p_business_unit_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.user_business_unit_access ubua
        WHERE ubua.user_id = u.id
          AND ubua.business_unit_id = p_business_unit_id
      )
    )
  LIMIT 1
),
warehouse_scope AS (
  SELECT
    iw.item_id,
    iw.default_location_id,
    COALESCE(
      iw.available_stock,
      COALESCE(iw.current_stock, 0) - COALESCE(iw.reserved_stock, 0),
      0
    ) AS available_stock
  FROM public.item_warehouse iw
  INNER JOIN public.warehouses w
    ON w.id = iw.warehouse_id
   AND w.company_id = p_company_id
   AND w.deleted_at IS NULL
  WHERE iw.company_id = p_company_id
    AND iw.deleted_at IS NULL
    AND (p_business_unit_id IS NULL OR w.business_unit_id = p_business_unit_id)
),
aggregated AS (
  SELECT
    i.id AS item_id,
    i.item_name::TEXT AS item_name,
    COALESCE(SUM(ws.available_stock), 0) AS qty,
    COALESCE(uom.symbol, uom.code, uom.name, '')::TEXT AS uom,
    CASE
      WHEN COUNT(DISTINCT COALESCE(wl.code, '__NO_LOCATION__')) = 1 THEN MIN(wl.code)::TEXT
      ELSE NULL::TEXT
    END AS location_code,
    COALESCE(i.reorder_level, 0) AS reorder_level
  FROM public.items i
  INNER JOIN authorized ON TRUE
  LEFT JOIN public.units_of_measure uom
    ON uom.id = i.uom_id
   AND uom.company_id = p_company_id
   AND uom.deleted_at IS NULL
  LEFT JOIN warehouse_scope ws
    ON ws.item_id = i.id
  LEFT JOIN public.warehouse_locations wl
    ON wl.id = ws.default_location_id
   AND wl.company_id = p_company_id
   AND wl.deleted_at IS NULL
  WHERE i.company_id = p_company_id
    AND i.deleted_at IS NULL
    AND COALESCE(i.is_active, TRUE) = TRUE
    AND COALESCE(i.reorder_level, 0) > 0
  GROUP BY i.id, i.item_name, i.reorder_level, uom.symbol, uom.code, uom.name
)
SELECT
  aggregated.item_id,
  aggregated.item_name,
  aggregated.qty,
  aggregated.uom,
  aggregated.location_code,
  aggregated.reorder_level
FROM aggregated
WHERE aggregated.qty > 0
  AND aggregated.qty <= aggregated.reorder_level
ORDER BY aggregated.qty ASC, aggregated.item_name ASC
LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 1), 50);
$$;

REVOKE ALL ON FUNCTION public.get_warehouse_dashboard_low_stocks(UUID, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_warehouse_dashboard_low_stocks(UUID, UUID, INTEGER) TO authenticated;

COMMIT;
