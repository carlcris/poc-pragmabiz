CREATE FUNCTION public.get_purchase_on_order_status_page(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_search TEXT DEFAULT NULL,
  p_supplier_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT 'awaiting_delivery',
  p_expected_from DATE DEFAULT NULL,
  p_expected_to DATE DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  items JSONB,
  awaiting_delivery_count BIGINT,
  partially_received_count BIGINT,
  page INTEGER,
  page_limit INTEGER
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH params AS (
    SELECT
      NULLIF(BTRIM(p_search), '') AS search_term,
      CASE
        WHEN BTRIM(p_status) = 'partially_received' THEN 'partially_received'
        ELSE 'awaiting_delivery'
      END AS selected_status,
      LEAST(GREATEST(COALESCE(p_page, 1), 1), 100000) AS requested_page,
      LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100) AS page_limit
  ), matched AS MATERIALIZED (
    SELECT
      sri.id AS sr_item_id,
      sr.id AS sr_id,
      sr.sr_number::TEXT AS sr_number,
      s.id AS supplier_id,
      s.supplier_name,
      s.supplier_code,
      i.id AS item_id,
      i.item_code,
      i.item_name::TEXT AS item_name,
      COALESCE(sri.requested_qty, 0) AS ordered_qty,
      COALESCE(sri.fulfilled_qty, 0) AS received_qty,
      sr.required_by_date AS expected_delivery,
      sr.created_at AS requisition_created_at,
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
      AND COALESCE(sri.requested_qty, 0) > COALESCE(sri.fulfilled_qty, 0)
      AND (p_supplier_id IS NULL OR sr.supplier_id = p_supplier_id)
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
  ), counts AS (
    SELECT
      COUNT(*) FILTER (WHERE matched.status = 'awaiting_delivery') AS awaiting_delivery_count,
      COUNT(*) FILTER (WHERE matched.status = 'partially_received') AS partially_received_count
    FROM matched
  ), pagination AS (
    SELECT
      counts.awaiting_delivery_count,
      counts.partially_received_count,
      LEAST(
        p.requested_page,
        (
          GREATEST(
            CASE
              WHEN p.selected_status = 'partially_received' THEN counts.partially_received_count
              ELSE counts.awaiting_delivery_count
            END,
            1
          ) - 1
        ) / p.page_limit + 1
      )::INTEGER AS page,
      p.page_limit
    FROM counts
    CROSS JOIN params p
  ), page_rows AS (
    SELECT
      matched.sr_item_id,
      matched.sr_id,
      matched.sr_number,
      matched.supplier_id,
      matched.supplier_name,
      matched.supplier_code,
      matched.item_id,
      matched.item_code,
      matched.item_name,
      matched.ordered_qty,
      matched.received_qty,
      matched.expected_delivery,
      matched.requisition_created_at,
      matched.status
    FROM matched
    WHERE matched.status = (SELECT selected_status FROM params)
    ORDER BY
      matched.requisition_created_at DESC,
      matched.sr_number ASC,
      matched.item_name ASC,
      matched.sr_item_id ASC
    OFFSET (SELECT (pagination.page - 1) * pagination.page_limit FROM pagination)
    LIMIT (SELECT pagination.page_limit FROM pagination)
  ), page_items AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'sr_item_id', page_rows.sr_item_id,
          'sr_id', page_rows.sr_id,
          'sr_number', page_rows.sr_number,
          'supplier_id', page_rows.supplier_id,
          'supplier_name', page_rows.supplier_name,
          'supplier_code', page_rows.supplier_code,
          'item_id', page_rows.item_id,
          'item_code', page_rows.item_code,
          'item_name', page_rows.item_name,
          'ordered_qty', page_rows.ordered_qty,
          'received_qty', page_rows.received_qty,
          'outstanding_qty', page_rows.ordered_qty - page_rows.received_qty,
          'expected_delivery', page_rows.expected_delivery,
          'status', page_rows.status
        )
        ORDER BY
          page_rows.requisition_created_at DESC,
          page_rows.sr_number ASC,
          page_rows.item_name ASC,
          page_rows.sr_item_id ASC
      ),
      '[]'::JSONB
    ) AS items
    FROM page_rows
  )
  SELECT
    page_items.items,
    pagination.awaiting_delivery_count,
    pagination.partially_received_count,
    pagination.page,
    pagination.page_limit
  FROM pagination
  CROSS JOIN page_items;
$$;

GRANT EXECUTE ON FUNCTION public.get_purchase_on_order_status_page(
  UUID, UUID, TEXT, UUID, TEXT, DATE, DATE, INTEGER, INTEGER
) TO authenticated;

COMMENT ON FUNCTION public.get_purchase_on_order_status_page(
  UUID, UUID, TEXT, UUID, TEXT, DATE, DATE, INTEGER, INTEGER
) IS 'Returns both On Order status counts and a bounded, newest-first item page for the selected status.';

DROP FUNCTION public.get_purchase_on_order_items(
  UUID, UUID, TEXT, UUID, TEXT, DATE, DATE, INTEGER, INTEGER
);
