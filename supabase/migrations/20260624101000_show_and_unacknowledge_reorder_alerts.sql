-- Add acknowledged reorder alert listing and unacknowledge support.

BEGIN;

DROP FUNCTION IF EXISTS public.get_effective_reorder_alerts(
  UUID,
  DATE,
  TEXT,
  TEXT,
  INTEGER,
  INTEGER,
  BOOLEAN
);

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
    COALESCE(sip.reorder_level, i.reorder_level, 0) AS reorder_point,
    COALESCE(sip.reorder_quantity, i.reorder_quantity, 0) AS reorder_quantity,
    COALESCE(sip.reorder_level, i.reorder_level, 0) * 0.5 AS minimum_level,
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

CREATE OR REPLACE FUNCTION public.acknowledge_reorder_alerts(
  p_company_id UUID,
  p_alert_ids UUID[],
  p_acknowledged_by UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  acknowledged_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acknowledged_count INTEGER := 0;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company id is required';
  END IF;

  IF p_acknowledged_by IS NULL THEN
    RAISE EXCEPTION 'acknowledged by is required';
  END IF;

  IF p_alert_ids IS NULL OR array_length(p_alert_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  CREATE TEMP TABLE tmp_reorder_alert_acknowledgments ON COMMIT DROP AS
  SELECT *
  FROM public.get_effective_reorder_alerts(
    p_company_id,
    p_as_of_date,
    NULL,
    NULL,
    1,
    100,
    'all'
  ) alerts
  WHERE alerts.id = ANY(p_alert_ids);

  UPDATE public.reorder_alert_acknowledgments raa
  SET
    deleted_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = p_acknowledged_by
  WHERE raa.company_id = p_company_id
    AND raa.deleted_at IS NULL
    AND raa.item_id IN (
      SELECT current_alerts.item_id
      FROM tmp_reorder_alert_acknowledgments current_alerts
    );

  INSERT INTO public.reorder_alert_acknowledgments (
    company_id,
    item_id,
    policy_source,
    season_id,
    reorder_point,
    reorder_quantity,
    minimum_level,
    severity,
    acknowledged_available_stock,
    acknowledged_by,
    updated_by
  )
  SELECT
    p_company_id,
    current_alerts.item_id,
    current_alerts.policy_source,
    current_alerts.season_id,
    current_alerts.reorder_point,
    current_alerts.reorder_quantity,
    current_alerts.minimum_level,
    current_alerts.severity,
    current_alerts.total_available_stock,
    p_acknowledged_by,
    p_acknowledged_by
  FROM tmp_reorder_alert_acknowledgments current_alerts;

  GET DIAGNOSTICS v_acknowledged_count = ROW_COUNT;

  RETURN QUERY SELECT v_acknowledged_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.unacknowledge_reorder_alerts(
  p_company_id UUID,
  p_alert_ids UUID[],
  p_unacknowledged_by UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  unacknowledged_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unacknowledged_count INTEGER := 0;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company id is required';
  END IF;

  IF p_unacknowledged_by IS NULL THEN
    RAISE EXCEPTION 'unacknowledged by is required';
  END IF;

  IF p_alert_ids IS NULL OR array_length(p_alert_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  CREATE TEMP TABLE tmp_reorder_alert_unacknowledgments ON COMMIT DROP AS
  SELECT *
  FROM public.get_effective_reorder_alerts(
    p_company_id,
    p_as_of_date,
    NULL,
    NULL,
    1,
    100,
    'acknowledged'
  ) alerts
  WHERE alerts.id = ANY(p_alert_ids);

  UPDATE public.reorder_alert_acknowledgments raa
  SET
    deleted_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = p_unacknowledged_by
  FROM tmp_reorder_alert_unacknowledgments current_alerts
  WHERE raa.id = current_alerts.acknowledgment_id
    AND raa.company_id = p_company_id
    AND raa.deleted_at IS NULL;

  GET DIAGNOSTICS v_unacknowledged_count = ROW_COUNT;

  RETURN QUERY SELECT v_unacknowledged_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_reorder_alerts(UUID, DATE, TEXT, TEXT, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unacknowledge_reorder_alerts(UUID, UUID[], UUID, DATE) TO authenticated;

COMMIT;
