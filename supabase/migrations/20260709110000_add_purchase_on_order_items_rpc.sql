CREATE OR REPLACE FUNCTION public.get_purchase_on_order_items(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_search TEXT DEFAULT NULL,
  p_supplier_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_expected_from DATE DEFAULT NULL,
  p_expected_to DATE DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  sr_item_id UUID,
  sr_id UUID,
  sr_number TEXT,
  supplier_id UUID,
  supplier_name TEXT,
  supplier_code TEXT,
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  ordered_qty NUMERIC,
  received_qty NUMERIC,
  outstanding_qty NUMERIC,
  expected_delivery DATE,
  status TEXT,
  total_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH params AS (
    SELECT
      NULLIF(BTRIM(p_search), '') AS search_term,
      NULLIF(BTRIM(p_status), '') AS status_filter,
      GREATEST(COALESCE(p_page, 1), 1) AS page_number,
      LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100) AS page_limit
  ),
  filtered AS (
    SELECT
      sri.id AS sr_item_id,
      sr.id AS sr_id,
      sr.sr_number::TEXT AS sr_number,
      s.id AS supplier_id,
      s.supplier_name::TEXT AS supplier_name,
      s.supplier_code::TEXT AS supplier_code,
      i.id AS item_id,
      i.item_code::TEXT AS item_code,
      i.item_name::TEXT AS item_name,
      COALESCE(sri.requested_qty, 0)::NUMERIC AS ordered_qty,
      COALESCE(sri.fulfilled_qty, 0)::NUMERIC AS received_qty,
      GREATEST(COALESCE(sri.requested_qty, 0) - COALESCE(sri.fulfilled_qty, 0), 0)::NUMERIC
        AS outstanding_qty,
      sr.required_by_date AS expected_delivery,
      CASE
        WHEN COALESCE(sri.fulfilled_qty, 0) > 0 THEN 'partially_received'
        ELSE 'awaiting_delivery'
      END AS status
    FROM public.stock_requisition_items sri
    JOIN public.stock_requisitions sr
      ON sr.id = sri.sr_id
    JOIN public.suppliers s
      ON s.id = sr.supplier_id
    JOIN public.items i
      ON i.id = sri.item_id
    CROSS JOIN params p
    WHERE sr.company_id = p_company_id
      AND sr.business_unit_id = p_business_unit_id
      AND sr.deleted_at IS NULL
      AND sr.status IN ('submitted', 'partially_fulfilled')
      AND GREATEST(COALESCE(sri.requested_qty, 0) - COALESCE(sri.fulfilled_qty, 0), 0) > 0
      AND (p_supplier_id IS NULL OR sr.supplier_id = p_supplier_id)
      AND (
        p.status_filter IS NULL
        OR CASE
          WHEN COALESCE(sri.fulfilled_qty, 0) > 0 THEN 'partially_received'
          ELSE 'awaiting_delivery'
        END = p.status_filter
      )
      AND (p_expected_from IS NULL OR sr.required_by_date >= p_expected_from)
      AND (p_expected_to IS NULL OR sr.required_by_date <= p_expected_to)
      AND (
        p.search_term IS NULL
        OR sr.sr_number ILIKE '%' || p.search_term || '%'
        OR s.supplier_name ILIKE '%' || p.search_term || '%'
        OR s.supplier_code ILIKE '%' || p.search_term || '%'
        OR i.item_code ILIKE '%' || p.search_term || '%'
        OR i.item_name ILIKE '%' || p.search_term || '%'
      )
  )
  SELECT
    filtered.sr_item_id,
    filtered.sr_id,
    filtered.sr_number,
    filtered.supplier_id,
    filtered.supplier_name,
    filtered.supplier_code,
    filtered.item_id,
    filtered.item_code,
    filtered.item_name,
    filtered.ordered_qty,
    filtered.received_qty,
    filtered.outstanding_qty,
    filtered.expected_delivery,
    filtered.status,
    COUNT(*) OVER () AS total_count
  FROM filtered
  ORDER BY
    filtered.expected_delivery ASC NULLS LAST,
    filtered.sr_number ASC,
    filtered.item_name ASC,
    filtered.sr_item_id ASC
  OFFSET (SELECT (page_number - 1) * page_limit FROM params)
  LIMIT (SELECT page_limit FROM params);
$$;

GRANT EXECUTE ON FUNCTION public.get_purchase_on_order_items(
  UUID,
  UUID,
  TEXT,
  UUID,
  TEXT,
  DATE,
  DATE,
  INTEGER,
  INTEGER
) TO authenticated;

COMMENT ON FUNCTION public.get_purchase_on_order_items(
  UUID,
  UUID,
  TEXT,
  UUID,
  TEXT,
  DATE,
  DATE,
  INTEGER,
  INTEGER
) IS 'Returns paginated stock requisition item rows that still have supplier outstanding quantity.';
