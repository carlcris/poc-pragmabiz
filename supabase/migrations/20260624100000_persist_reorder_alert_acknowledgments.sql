-- Persist reorder alert acknowledgments and hide acknowledged alert conditions.

BEGIN;

CREATE TABLE IF NOT EXISTS public.reorder_alert_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  policy_source TEXT NOT NULL,
  season_id UUID NULL REFERENCES public.reorder_seasons(id) ON DELETE SET NULL,
  reorder_point NUMERIC(20, 2) NOT NULL,
  reorder_quantity NUMERIC(20, 2) NOT NULL,
  minimum_level NUMERIC(20, 2) NOT NULL,
  severity TEXT NOT NULL,
  acknowledged_available_stock NUMERIC(20, 2) NOT NULL,
  acknowledged_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMP NULL,
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT reorder_alert_acknowledgments_policy_source_valid
    CHECK (policy_source IN ('season_override', 'item_default')),
  CONSTRAINT reorder_alert_acknowledgments_severity_valid
    CHECK (severity IN ('critical', 'warning', 'info'))
);

CREATE INDEX IF NOT EXISTS idx_reorder_alert_acknowledgments_active_lookup
  ON public.reorder_alert_acknowledgments(
    company_id,
    item_id,
    policy_source,
    season_id,
    reorder_point,
    reorder_quantity,
    minimum_level,
    severity,
    acknowledged_available_stock
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reorder_alert_acknowledgments_company_item
  ON public.reorder_alert_acknowledgments(company_id, item_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trigger_reorder_alert_acknowledgments_updated_at
  ON public.reorder_alert_acknowledgments;
CREATE TRIGGER trigger_reorder_alert_acknowledgments_updated_at
  BEFORE UPDATE ON public.reorder_alert_acknowledgments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.reorder_alert_acknowledgments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read reorder_alert_acknowledgments"
  ON public.reorder_alert_acknowledgments;
CREATE POLICY "Allow authenticated users to read reorder_alert_acknowledgments"
  ON public.reorder_alert_acknowledgments FOR SELECT
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Allow authenticated users to write reorder_alert_acknowledgments"
  ON public.reorder_alert_acknowledgments;
CREATE POLICY "Allow authenticated users to write reorder_alert_acknowledgments"
  ON public.reorder_alert_acknowledgments FOR ALL
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

COMMENT ON TABLE public.reorder_alert_acknowledgments IS
  'Tracks user acknowledgments for generated reorder alert conditions.';
COMMENT ON COLUMN public.reorder_alert_acknowledgments.acknowledged_available_stock IS
  'Available stock level at the time the alert condition was acknowledged.';

DROP FUNCTION IF EXISTS public.get_effective_reorder_alerts(
  UUID,
  DATE,
  TEXT,
  TEXT,
  INTEGER,
  INTEGER
);

CREATE OR REPLACE FUNCTION public.get_effective_reorder_alerts(
  p_company_id UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE,
  p_search TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 50,
  p_include_acknowledged BOOLEAN DEFAULT FALSE
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
severity_filtered AS (
  SELECT *
  FROM alerts a
  WHERE p_severity IS NULL
    OR p_severity = ''
    OR p_severity = 'all'
    OR a.alert_severity = p_severity
),
acknowledgment_filtered AS (
  SELECT *
  FROM severity_filtered sf
  WHERE p_include_acknowledged = TRUE
    OR NOT EXISTS (
      SELECT 1
      FROM public.reorder_alert_acknowledgments raa
      WHERE raa.company_id = p_company_id
        AND raa.item_id = sf.id
        AND raa.deleted_at IS NULL
        AND raa.policy_source = sf.policy_source
        AND raa.season_id IS NOT DISTINCT FROM sf.season_id
        AND raa.reorder_point = sf.reorder_point
        AND raa.reorder_quantity = sf.reorder_quantity
        AND raa.minimum_level = sf.minimum_level
        AND raa.severity = sf.alert_severity
        AND raa.acknowledged_available_stock = sf.total_available_stock
    )
)
SELECT
  af.id,
  af.id AS item_id,
  af.item_code,
  af.item_name,
  af.total_current_stock,
  af.total_available_stock,
  af.reorder_point,
  af.reorder_quantity,
  af.minimum_level,
  af.alert_severity AS severity,
  CASE
    WHEN af.total_available_stock <= 0 THEN 'Out of stock - immediate action required'
    WHEN af.alert_severity = 'critical' THEN
      'Critical low stock: ' || af.total_available_stock::TEXT || ' units available'
    ELSE
      'Low stock: ' || af.total_available_stock::TEXT || ' units available'
  END AS message,
  af.policy_source,
  af.season_id,
  af.season_code,
  af.season_name,
  af.warehouse_breakdown,
  COUNT(*) OVER() AS total_count
FROM acknowledgment_filtered af
ORDER BY
  CASE af.alert_severity WHEN 'critical' THEN 0 ELSE 1 END,
  af.item_name ASC
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
    TRUE
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

GRANT EXECUTE ON FUNCTION public.get_effective_reorder_alerts(UUID, DATE, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_reorder_alerts(UUID, UUID[], UUID, DATE) TO authenticated;

COMMIT;
