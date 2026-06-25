-- Include company warehouses with zero or missing item stock rows in reorder alert breakdowns.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_effective_reorder_alerts(
  p_company_id UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE,
  p_search TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 50,
  p_acknowledgment_status TEXT DEFAULT 'active'
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
  acknowledged BOOLEAN,
  acknowledgment_id UUID,
  acknowledged_at TIMESTAMP,
  acknowledged_by UUID,
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
    i.id AS item_id,
    SUM(COALESCE(iw.current_stock, 0)) AS total_current_stock,
    SUM(COALESCE(iw.available_stock, COALESCE(iw.current_stock, 0) - COALESCE(iw.reserved_stock, 0), 0)) AS total_available_stock,
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'warehouseId', w.id,
        'warehouseCode', w.warehouse_code,
        'warehouseName', w.warehouse_name,
        'currentStock', COALESCE(iw.current_stock, 0),
        'availableStock', COALESCE(iw.available_stock, COALESCE(iw.current_stock, 0) - COALESCE(iw.reserved_stock, 0), 0)
      )
      ORDER BY w.warehouse_name
    ) AS warehouse_breakdown
  FROM public.items i
  INNER JOIN public.warehouses w
    ON w.company_id = i.company_id
   AND w.deleted_at IS NULL
  LEFT JOIN public.item_warehouse iw
    ON iw.company_id = i.company_id
   AND iw.item_id = i.id
   AND iw.warehouse_id = w.id
   AND iw.deleted_at IS NULL
  WHERE i.company_id = p_company_id
    AND i.deleted_at IS NULL
    AND COALESCE(i.is_active, TRUE) = TRUE
  GROUP BY i.id
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
with_acknowledgment AS (
  SELECT
    a.*,
    raa.id AS acknowledgment_id,
    raa.acknowledged_at,
    raa.acknowledged_by
  FROM alerts a
  LEFT JOIN LATERAL (
    SELECT current_ack.id, current_ack.acknowledged_at, current_ack.acknowledged_by
    FROM public.reorder_alert_acknowledgments current_ack
    WHERE current_ack.company_id = p_company_id
      AND current_ack.item_id = a.id
      AND current_ack.deleted_at IS NULL
      AND current_ack.policy_source = a.policy_source
      AND current_ack.season_id IS NOT DISTINCT FROM a.season_id
      AND current_ack.reorder_point = a.reorder_point
      AND current_ack.reorder_quantity = a.reorder_quantity
      AND current_ack.minimum_level = a.minimum_level
      AND current_ack.severity = a.alert_severity
      AND current_ack.acknowledged_available_stock = a.total_available_stock
    ORDER BY current_ack.acknowledged_at DESC, current_ack.created_at DESC
    LIMIT 1
  ) raa ON TRUE
),
filtered AS (
  SELECT *
  FROM with_acknowledgment wa
  WHERE (
      p_severity IS NULL
      OR p_severity = ''
      OR p_severity = 'all'
      OR wa.alert_severity = p_severity
    )
    AND (
      COALESCE(p_acknowledgment_status, 'active') = 'all'
      OR (
        COALESCE(p_acknowledgment_status, 'active') = 'active'
        AND wa.acknowledgment_id IS NULL
      )
      OR (
        COALESCE(p_acknowledgment_status, 'active') = 'acknowledged'
        AND wa.acknowledgment_id IS NOT NULL
      )
    )
)
SELECT
  f.id,
  f.id AS item_id,
  f.item_code,
  f.item_name,
  f.total_current_stock,
  f.total_available_stock,
  f.reorder_point,
  f.reorder_quantity,
  f.minimum_level,
  f.alert_severity AS severity,
  CASE
    WHEN f.total_available_stock <= 0 THEN 'Out of stock - immediate action required'
    WHEN f.alert_severity = 'critical' THEN
      'Critical low stock: ' || f.total_available_stock::TEXT || ' units available'
    ELSE
      'Low stock: ' || f.total_available_stock::TEXT || ' units available'
  END AS message,
  f.policy_source,
  f.season_id,
  f.season_code,
  f.season_name,
  f.warehouse_breakdown,
  f.acknowledgment_id IS NOT NULL AS acknowledged,
  f.acknowledgment_id,
  f.acknowledged_at,
  f.acknowledged_by,
  COUNT(*) OVER() AS total_count
FROM filtered f
ORDER BY
  CASE f.alert_severity WHEN 'critical' THEN 0 ELSE 1 END,
  f.item_name ASC
OFFSET (GREATEST(p_page, 1) - 1) * GREATEST(p_limit, 1)
LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

COMMIT;
