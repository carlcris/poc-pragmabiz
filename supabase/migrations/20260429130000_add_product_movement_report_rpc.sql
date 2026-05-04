-- Migration: Add product movement report RPC
-- Description: Provides fast-moving and slow-moving product reports using server-side aggregation.
-- Date: 2026-04-29

-- ============================================================================
-- FUNCTION: get_product_movement_report
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_product_movement_report(
  p_company_id UUID,
  p_business_unit_id UUID DEFAULT NULL,
  p_movement_type TEXT DEFAULT 'fast',
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  category_id UUID,
  category_name TEXT,
  uom TEXT,
  quantity_sold NUMERIC,
  revenue NUMERIC,
  transaction_count BIGINT,
  current_stock NUMERIC,
  available_stock NUMERIC,
  unit_cost NUMERIC,
  stock_value NUMERIC,
  average_daily_quantity NUMERIC,
  days_of_cover NUMERIC,
  last_sold_at TIMESTAMPTZ,
  movement_rank BIGINT,
  total_count BIGINT,
  summary_total_quantity_sold NUMERIC,
  summary_total_revenue NUMERIC,
  summary_total_stock_value NUMERIC,
  summary_zero_sales_count BIGINT,
  summary_average_daily_quantity NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH settings AS (
    SELECT
      CASE WHEN p_movement_type = 'slow' THEN 'slow' ELSE 'fast' END AS movement_type,
      COALESCE(p_date_from, CURRENT_DATE - INTERVAL '30 days')::date AS date_from,
      GREATEST(
        COALESCE(p_date_to, CURRENT_DATE)::date,
        COALESCE(p_date_from, CURRENT_DATE - INTERVAL '30 days')::date
      ) AS date_to,
      NULLIF(TRIM(COALESCE(p_search, '')), '') AS search_text,
      GREATEST(COALESCE(p_page, 1), 1) AS page_number,
      LEAST(GREATEST(COALESCE(p_limit, 25), 10), 50) AS page_limit
  ),
  sales_lines AS (
    SELECT
      sii.item_id,
      sii.quantity::numeric AS quantity_sold,
      sii.line_total::numeric AS revenue,
      si.id AS document_id,
      (si.invoice_date::timestamp AT TIME ZONE 'UTC') AS sold_at
    FROM settings s
    INNER JOIN public.sales_invoices si
      ON si.company_id = p_company_id
     AND si.deleted_at IS NULL
     AND si.status NOT IN ('draft', 'cancelled')
     AND si.invoice_date >= s.date_from
     AND si.invoice_date <= s.date_to
     AND (p_business_unit_id IS NULL OR si.business_unit_id = p_business_unit_id)
    INNER JOIN public.sales_invoice_items sii
      ON sii.invoice_id = si.id
     AND sii.company_id = p_company_id
     AND sii.deleted_at IS NULL

    UNION ALL

    SELECT
      pti.item_id,
      pti.quantity::numeric AS quantity_sold,
      pti.line_total::numeric AS revenue,
      pt.id AS document_id,
      pt.transaction_date AS sold_at
    FROM settings s
    INNER JOIN public.pos_transactions pt
      ON pt.company_id = p_company_id
     AND pt.status = 'completed'
     AND pt.transaction_date >= (s.date_from::timestamp AT TIME ZONE 'UTC')
     AND pt.transaction_date < ((s.date_to + 1)::timestamp AT TIME ZONE 'UTC')
     AND (p_business_unit_id IS NULL OR pt.business_unit_id = p_business_unit_id)
     AND NOT EXISTS (
       SELECT 1
       FROM public.sales_invoices linked_si
       WHERE linked_si.company_id = p_company_id
         AND linked_si.deleted_at IS NULL
         AND linked_si.status <> 'cancelled'
         AND linked_si.custom_fields ->> 'posTransactionId' = pt.id::text
     )
    INNER JOIN public.pos_transaction_items pti
      ON pti.pos_transaction_id = pt.id
  ),
  sales_agg AS (
    SELECT
      sales_lines.item_id,
      SUM(sales_lines.quantity_sold)::numeric AS quantity_sold,
      SUM(sales_lines.revenue)::numeric AS revenue,
      COUNT(DISTINCT sales_lines.document_id)::bigint AS transaction_count,
      MAX(sales_lines.sold_at) AS last_sold_at
    FROM sales_lines
    GROUP BY sales_lines.item_id
  ),
  stock_agg AS (
    SELECT
      iw.item_id,
      SUM(COALESCE(iw.current_stock, 0))::numeric AS current_stock,
      SUM(COALESCE(iw.available_stock, 0))::numeric AS available_stock
    FROM public.item_warehouse iw
    INNER JOIN public.warehouses w ON w.id = iw.warehouse_id
    WHERE iw.company_id = p_company_id
      AND iw.deleted_at IS NULL
      AND COALESCE(iw.is_active, TRUE)
      AND (p_business_unit_id IS NULL OR w.business_unit_id = p_business_unit_id)
    GROUP BY iw.item_id
  ),
  base_rows AS (
    SELECT
      i.id AS item_id,
      i.item_code::text AS item_code,
      i.item_name::text AS item_name,
      i.category_id,
      ic.name::text AS category_name,
      uom.code::text AS uom,
      COALESCE(sa.quantity_sold, 0)::numeric AS quantity_sold,
      COALESCE(sa.revenue, 0)::numeric AS revenue,
      COALESCE(sa.transaction_count, 0)::bigint AS transaction_count,
      COALESCE(st.current_stock, 0)::numeric AS current_stock,
      COALESCE(st.available_stock, 0)::numeric AS available_stock,
      COALESCE(i.cost_price, i.purchase_price, 0)::numeric AS unit_cost,
      (COALESCE(st.current_stock, 0) * COALESCE(i.cost_price, i.purchase_price, 0))::numeric AS stock_value,
      (
        COALESCE(sa.quantity_sold, 0)
        / GREATEST(1, ((SELECT date_to FROM settings) - (SELECT date_from FROM settings) + 1))
      )::numeric AS average_daily_quantity,
      CASE
        WHEN COALESCE(sa.quantity_sold, 0) <= 0 THEN NULL::numeric
        ELSE (
          COALESCE(st.current_stock, 0)
          / (
              COALESCE(sa.quantity_sold, 0)
              / GREATEST(1, ((SELECT date_to FROM settings) - (SELECT date_from FROM settings) + 1))
            )
        )::numeric
      END AS days_of_cover,
      sa.last_sold_at
    FROM public.items i
    CROSS JOIN settings s
    LEFT JOIN public.item_categories ic ON ic.id = i.category_id
    LEFT JOIN public.units_of_measure uom ON uom.id = i.uom_id
    LEFT JOIN sales_agg sa ON sa.item_id = i.id
    LEFT JOIN stock_agg st ON st.item_id = i.id
    WHERE i.company_id = p_company_id
      AND i.deleted_at IS NULL
      AND COALESCE(i.is_active, TRUE)
      AND COALESCE(i.is_stock_item, TRUE)
      AND (p_category_id IS NULL OR i.category_id = p_category_id)
      AND (
        s.search_text IS NULL
        OR i.item_code ILIKE '%' || s.search_text || '%'
        OR i.item_name ILIKE '%' || s.search_text || '%'
        OR COALESCE(ic.name, '') ILIKE '%' || s.search_text || '%'
      )
  ),
  visible_rows AS (
    SELECT base_rows.*
    FROM base_rows
    CROSS JOIN settings s
    WHERE (
        s.movement_type = 'fast'
        AND base_rows.quantity_sold > 0
      )
      OR (
        s.movement_type = 'slow'
        AND base_rows.current_stock > 0
      )
  ),
  ranked_rows AS (
    SELECT
      visible_rows.*,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE WHEN (SELECT movement_type FROM settings) = 'fast' THEN visible_rows.quantity_sold END DESC NULLS LAST,
          CASE WHEN (SELECT movement_type FROM settings) = 'fast' THEN visible_rows.revenue END DESC NULLS LAST,
          CASE WHEN (SELECT movement_type FROM settings) = 'fast' THEN visible_rows.average_daily_quantity END DESC NULLS LAST,
          CASE
            WHEN (SELECT movement_type FROM settings) = 'slow' AND visible_rows.last_sold_at IS NULL THEN 0
            WHEN (SELECT movement_type FROM settings) = 'slow' THEN 1
          END ASC NULLS LAST,
          CASE WHEN (SELECT movement_type FROM settings) = 'slow' THEN visible_rows.quantity_sold END ASC NULLS LAST,
          CASE WHEN (SELECT movement_type FROM settings) = 'slow' THEN visible_rows.average_daily_quantity END ASC NULLS LAST,
          CASE WHEN (SELECT movement_type FROM settings) = 'slow' THEN visible_rows.stock_value END DESC NULLS LAST,
          visible_rows.item_name ASC,
          visible_rows.item_id ASC
      ) AS movement_rank,
      COUNT(*) OVER ()::bigint AS total_count,
      COALESCE(SUM(visible_rows.quantity_sold) OVER (), 0)::numeric AS summary_total_quantity_sold,
      COALESCE(SUM(visible_rows.revenue) OVER (), 0)::numeric AS summary_total_revenue,
      COALESCE(SUM(visible_rows.stock_value) OVER (), 0)::numeric AS summary_total_stock_value,
      COUNT(*) FILTER (WHERE visible_rows.quantity_sold = 0) OVER ()::bigint AS summary_zero_sales_count,
      COALESCE(AVG(visible_rows.average_daily_quantity) OVER (), 0)::numeric AS summary_average_daily_quantity
    FROM visible_rows
  )
  SELECT
    ranked_rows.item_id,
    ranked_rows.item_code,
    ranked_rows.item_name,
    ranked_rows.category_id,
    ranked_rows.category_name,
    ranked_rows.uom,
    ranked_rows.quantity_sold,
    ranked_rows.revenue,
    ranked_rows.transaction_count,
    ranked_rows.current_stock,
    ranked_rows.available_stock,
    ranked_rows.unit_cost,
    ranked_rows.stock_value,
    ranked_rows.average_daily_quantity,
    ranked_rows.days_of_cover,
    ranked_rows.last_sold_at,
    ranked_rows.movement_rank,
    ranked_rows.total_count,
    ranked_rows.summary_total_quantity_sold,
    ranked_rows.summary_total_revenue,
    ranked_rows.summary_total_stock_value,
    ranked_rows.summary_zero_sales_count,
    ranked_rows.summary_average_daily_quantity
  FROM ranked_rows
  CROSS JOIN settings
  WHERE ranked_rows.movement_rank > ((settings.page_number - 1) * settings.page_limit)
    AND ranked_rows.movement_rank <= (settings.page_number * settings.page_limit)
  ORDER BY ranked_rows.movement_rank ASC;
$$;

COMMENT ON FUNCTION public.get_product_movement_report(UUID, UUID, TEXT, DATE, DATE, UUID, TEXT, INTEGER, INTEGER) IS
  'Returns page-paginated fast-moving or slow-moving products using aggregated invoice and POS sales with current stock context.';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_company_invoice_item_report
  ON public.sales_invoice_items(company_id, invoice_id, item_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_invoices_company_bu_date_report
  ON public.sales_invoices(company_id, business_unit_id, invoice_date, id)
  WHERE deleted_at IS NULL AND status NOT IN ('draft', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_sales_invoices_pos_transaction_link_report
  ON public.sales_invoices(company_id, ((custom_fields ->> 'posTransactionId')))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pos_transactions_company_bu_date_report
  ON public.pos_transactions(company_id, business_unit_id, transaction_date, id)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_pos_transaction_items_transaction_item_report
  ON public.pos_transaction_items(pos_transaction_id, item_id);

CREATE INDEX IF NOT EXISTS idx_item_warehouse_company_item_active_report
  ON public.item_warehouse(company_id, item_id, warehouse_id)
  WHERE deleted_at IS NULL AND COALESCE(is_active, TRUE);
