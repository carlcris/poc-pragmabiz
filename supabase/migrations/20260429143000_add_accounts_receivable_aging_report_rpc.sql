-- Migration: Add accounts receivable aging report RPC
-- Description: Provides as-of-date AR aging rows and summary totals from sales invoices and invoice payments.
-- Date: 2026-04-29

CREATE OR REPLACE FUNCTION public.get_accounts_receivable_aging_report(
  p_company_id UUID,
  p_business_unit_id UUID DEFAULT NULL,
  p_as_of_date DATE DEFAULT CURRENT_DATE,
  p_customer_id UUID DEFAULT NULL,
  p_bucket TEXT DEFAULT 'all',
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  customer_id UUID,
  customer_code TEXT,
  customer_name TEXT,
  invoice_id UUID,
  invoice_code TEXT,
  invoice_date DATE,
  due_date DATE,
  status TEXT,
  total_amount NUMERIC,
  amount_paid NUMERIC,
  balance NUMERIC,
  days_overdue INTEGER,
  current_amount NUMERIC,
  days_1_to_30 NUMERIC,
  days_31_to_60 NUMERIC,
  days_61_to_90 NUMERIC,
  days_90_plus NUMERIC,
  total_count BIGINT,
  summary_customer_count BIGINT,
  summary_invoice_count BIGINT,
  summary_current_amount NUMERIC,
  summary_days_1_to_30 NUMERIC,
  summary_days_31_to_60 NUMERIC,
  summary_days_61_to_90 NUMERIC,
  summary_days_90_plus NUMERIC,
  summary_total_balance NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH settings AS (
    SELECT
      COALESCE(p_as_of_date, CURRENT_DATE) AS as_of_date,
      GREATEST(COALESCE(p_page, 1), 1) AS page_number,
      LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50) AS page_limit,
      COALESCE(NULLIF(TRIM(p_bucket), ''), 'all') AS bucket_filter,
      NULLIF(TRIM(p_search), '') AS search_term
  ),
  open_invoices AS (
    SELECT
      si.customer_id,
      c.customer_code::text,
      c.customer_name::text,
      si.id AS invoice_id,
      si.invoice_code::text,
      si.invoice_date,
      si.due_date,
      si.status::text,
      si.total_amount::numeric AS total_amount,
      LEAST(COALESCE(payments.amount_paid, 0), si.total_amount)::numeric AS amount_paid,
      GREATEST(si.total_amount::numeric - COALESCE(payments.amount_paid, 0), 0)::numeric AS balance,
      GREATEST((settings.as_of_date - si.due_date), 0) AS days_overdue,
      CASE
        WHEN si.due_date >= settings.as_of_date
          THEN GREATEST(si.total_amount::numeric - COALESCE(payments.amount_paid, 0), 0)::numeric
        ELSE 0::numeric
      END AS current_amount,
      CASE
        WHEN (settings.as_of_date - si.due_date) BETWEEN 1 AND 30
          THEN GREATEST(si.total_amount::numeric - COALESCE(payments.amount_paid, 0), 0)::numeric
        ELSE 0::numeric
      END AS days_1_to_30,
      CASE
        WHEN (settings.as_of_date - si.due_date) BETWEEN 31 AND 60
          THEN GREATEST(si.total_amount::numeric - COALESCE(payments.amount_paid, 0), 0)::numeric
        ELSE 0::numeric
      END AS days_31_to_60,
      CASE
        WHEN (settings.as_of_date - si.due_date) BETWEEN 61 AND 90
          THEN GREATEST(si.total_amount::numeric - COALESCE(payments.amount_paid, 0), 0)::numeric
        ELSE 0::numeric
      END AS days_61_to_90,
      CASE
        WHEN (settings.as_of_date - si.due_date) > 90
          THEN GREATEST(si.total_amount::numeric - COALESCE(payments.amount_paid, 0), 0)::numeric
        ELSE 0::numeric
      END AS days_90_plus
    FROM public.sales_invoices si
    INNER JOIN public.customers c ON c.id = si.customer_id
    CROSS JOIN settings
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(ip.amount), 0)::numeric AS amount_paid
      FROM public.invoice_payments ip
      WHERE ip.company_id = p_company_id
        AND ip.invoice_id = si.id
        AND ip.deleted_at IS NULL
        AND ip.payment_date <= settings.as_of_date
    ) payments ON TRUE
    WHERE si.company_id = p_company_id
      AND c.company_id = p_company_id
      AND (p_business_unit_id IS NULL OR si.business_unit_id = p_business_unit_id)
      AND (p_customer_id IS NULL OR si.customer_id = p_customer_id)
      AND si.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND si.status NOT IN ('draft', 'cancelled')
      AND si.invoice_date <= settings.as_of_date
      AND (
        settings.search_term IS NULL
        OR si.invoice_code ILIKE '%' || settings.search_term || '%'
        OR c.customer_code ILIKE '%' || settings.search_term || '%'
        OR c.customer_name ILIKE '%' || settings.search_term || '%'
      )
  ),
  bucketed_invoices AS (
    SELECT open_invoices.*
    FROM open_invoices
    CROSS JOIN settings
    WHERE open_invoices.balance > 0
      AND (
        settings.bucket_filter = 'all'
        OR (settings.bucket_filter = 'current' AND open_invoices.current_amount > 0)
        OR (settings.bucket_filter = '1_30' AND open_invoices.days_1_to_30 > 0)
        OR (settings.bucket_filter = '31_60' AND open_invoices.days_31_to_60 > 0)
        OR (settings.bucket_filter = '61_90' AND open_invoices.days_61_to_90 > 0)
        OR (settings.bucket_filter = '90_plus' AND open_invoices.days_90_plus > 0)
      )
  ),
  summary AS (
    SELECT
      COUNT(DISTINCT bucketed_invoices.customer_id)::bigint AS customer_count,
      COUNT(*)::bigint AS invoice_count,
      COALESCE(SUM(bucketed_invoices.current_amount), 0)::numeric AS current_amount,
      COALESCE(SUM(bucketed_invoices.days_1_to_30), 0)::numeric AS days_1_to_30,
      COALESCE(SUM(bucketed_invoices.days_31_to_60), 0)::numeric AS days_31_to_60,
      COALESCE(SUM(bucketed_invoices.days_61_to_90), 0)::numeric AS days_61_to_90,
      COALESCE(SUM(bucketed_invoices.days_90_plus), 0)::numeric AS days_90_plus,
      COALESCE(SUM(bucketed_invoices.balance), 0)::numeric AS total_balance
    FROM bucketed_invoices
  ),
  numbered_invoices AS (
    SELECT
      bucketed_invoices.*,
      ROW_NUMBER() OVER (
        ORDER BY bucketed_invoices.days_overdue DESC,
                 bucketed_invoices.due_date ASC,
                 bucketed_invoices.invoice_code ASC,
                 bucketed_invoices.invoice_id ASC
      ) AS row_number,
      COUNT(*) OVER () AS total_remaining
    FROM bucketed_invoices
  )
  SELECT
    numbered_invoices.customer_id,
    numbered_invoices.customer_code,
    numbered_invoices.customer_name,
    numbered_invoices.invoice_id,
    numbered_invoices.invoice_code,
    numbered_invoices.invoice_date,
    numbered_invoices.due_date,
    numbered_invoices.status,
    numbered_invoices.total_amount,
    numbered_invoices.amount_paid,
    numbered_invoices.balance,
    numbered_invoices.days_overdue,
    numbered_invoices.current_amount,
    numbered_invoices.days_1_to_30,
    numbered_invoices.days_31_to_60,
    numbered_invoices.days_61_to_90,
    numbered_invoices.days_90_plus,
    numbered_invoices.total_remaining AS total_count,
    summary.customer_count AS summary_customer_count,
    summary.invoice_count AS summary_invoice_count,
    summary.current_amount AS summary_current_amount,
    summary.days_1_to_30 AS summary_days_1_to_30,
    summary.days_31_to_60 AS summary_days_31_to_60,
    summary.days_61_to_90 AS summary_days_61_to_90,
    summary.days_90_plus AS summary_days_90_plus,
    summary.total_balance AS summary_total_balance
  FROM numbered_invoices
  CROSS JOIN settings
  CROSS JOIN summary
  WHERE numbered_invoices.row_number > ((settings.page_number - 1) * settings.page_limit)
    AND numbered_invoices.row_number <= (settings.page_number * settings.page_limit)
  ORDER BY numbered_invoices.row_number ASC;
$$;

COMMENT ON FUNCTION public.get_accounts_receivable_aging_report(UUID, UUID, DATE, UUID, TEXT, TEXT, INTEGER, INTEGER) IS
  'Returns page-paginated accounts receivable aging rows and summary totals as of a selected date.';

CREATE INDEX IF NOT EXISTS idx_sales_invoices_ar_aging_report
  ON public.sales_invoices(company_id, business_unit_id, invoice_date, due_date, customer_id, id)
  WHERE deleted_at IS NULL AND status NOT IN ('draft', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_invoice_payments_ar_aging_report
  ON public.invoice_payments(company_id, invoice_id, payment_date)
  WHERE deleted_at IS NULL;
