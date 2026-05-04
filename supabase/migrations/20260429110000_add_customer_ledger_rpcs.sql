-- Migration: Add customer ledger RPCs
-- Description: Provides customer account statement rows and summary metrics derived from invoices, payments, and POS transactions.
-- Date: 2026-04-29

-- ============================================================================
-- FUNCTION: get_customer_ledger_summary
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_customer_ledger_summary(
  p_company_id UUID,
  p_customer_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  opening_balance NUMERIC,
  closing_balance NUMERIC,
  period_debits NUMERIC,
  period_credits NUMERIC,
  invoice_charges NUMERIC,
  payments_received NUMERIC,
  pos_sales NUMERIC,
  active_invoice_count BIGINT,
  overdue_invoice_count BIGINT,
  last_activity_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  WITH invoice_entries AS (
    SELECT
      (si.invoice_date::timestamp AT TIME ZONE 'UTC') AS event_at,
      si.total_amount::numeric AS debit,
      0::numeric AS credit,
      si.total_amount::numeric AS balance_effect,
      'invoice'::text AS source_type,
      si.status
    FROM public.sales_invoices si
    WHERE si.company_id = p_company_id
      AND si.customer_id = p_customer_id
      AND si.deleted_at IS NULL
      AND si.status NOT IN ('draft', 'cancelled')
  ),
  payment_entries AS (
    SELECT
      (ip.payment_date::timestamp AT TIME ZONE 'UTC') AS event_at,
      0::numeric AS debit,
      ip.amount::numeric AS credit,
      -ip.amount::numeric AS balance_effect,
      'payment'::text AS source_type,
      si.status
    FROM public.invoice_payments ip
    INNER JOIN public.sales_invoices si ON si.id = ip.invoice_id
    WHERE ip.company_id = p_company_id
      AND si.company_id = p_company_id
      AND si.customer_id = p_customer_id
      AND ip.deleted_at IS NULL
      AND si.deleted_at IS NULL
      AND si.status <> 'cancelled'
  ),
  pos_entries AS (
    SELECT
      pt.transaction_date AS event_at,
      pt.total_amount::numeric AS debit,
      LEAST(pt.amount_paid::numeric, pt.total_amount::numeric) AS credit,
      (pt.total_amount::numeric - LEAST(pt.amount_paid::numeric, pt.total_amount::numeric)) AS balance_effect,
      'pos'::text AS source_type,
      pt.status
    FROM public.pos_transactions pt
    WHERE pt.company_id = p_company_id
      AND pt.customer_id = p_customer_id
      AND pt.status = 'completed'
  ),
  entries AS (
    SELECT * FROM invoice_entries
    UNION ALL
    SELECT * FROM payment_entries
    UNION ALL
    SELECT * FROM pos_entries
  ),
  dated_entries AS (
    SELECT *
    FROM entries
    WHERE (p_date_from IS NULL OR event_at::date >= p_date_from)
      AND (p_date_to IS NULL OR event_at::date <= p_date_to)
  ),
  opening AS (
    SELECT COALESCE(SUM(balance_effect), 0)::numeric AS amount
    FROM entries
    WHERE p_date_from IS NOT NULL
      AND event_at::date < p_date_from
  ),
  active_invoices AS (
    SELECT
      COUNT(*)::bigint AS active_count,
      COUNT(*) FILTER (
        WHERE si.due_date < CURRENT_DATE
          AND si.amount_due > 0
          AND si.status IN ('sent', 'partially_paid', 'overdue')
      )::bigint AS overdue_count
    FROM public.sales_invoices si
    WHERE si.company_id = p_company_id
      AND si.customer_id = p_customer_id
      AND si.deleted_at IS NULL
      AND si.status NOT IN ('draft', 'paid', 'cancelled')
      AND si.amount_due > 0
  )
  SELECT
    opening.amount AS opening_balance,
    (opening.amount + COALESCE(SUM(dated_entries.balance_effect), 0))::numeric AS closing_balance,
    COALESCE(SUM(dated_entries.debit), 0)::numeric AS period_debits,
    COALESCE(SUM(dated_entries.credit), 0)::numeric AS period_credits,
    COALESCE(SUM(dated_entries.debit) FILTER (WHERE dated_entries.source_type = 'invoice'), 0)::numeric AS invoice_charges,
    COALESCE(SUM(dated_entries.credit) FILTER (WHERE dated_entries.source_type = 'payment'), 0)::numeric AS payments_received,
    COALESCE(SUM(dated_entries.debit) FILTER (WHERE dated_entries.source_type = 'pos'), 0)::numeric AS pos_sales,
    active_invoices.active_count AS active_invoice_count,
    active_invoices.overdue_count AS overdue_invoice_count,
    MAX(dated_entries.event_at) AS last_activity_at
  FROM opening
  CROSS JOIN active_invoices
  LEFT JOIN dated_entries ON TRUE
  GROUP BY opening.amount, active_invoices.active_count, active_invoices.overdue_count;
$$;

COMMENT ON FUNCTION public.get_customer_ledger_summary(UUID, UUID, DATE, DATE) IS
  'Summarizes a customer ledger from sales invoices, invoice payments, and completed POS cash-sale activity.';

-- ============================================================================
-- FUNCTION: get_customer_ledger_entries
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_customer_ledger_entries(
  p_company_id UUID,
  p_customer_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_source_type TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  entry_id TEXT,
  sort_key TEXT,
  source_type TEXT,
  source_id UUID,
  document_number TEXT,
  event_at TIMESTAMPTZ,
  due_date DATE,
  status TEXT,
  description TEXT,
  debit NUMERIC,
  credit NUMERIC,
  amount NUMERIC,
  balance_effect NUMERIC,
  running_balance NUMERIC,
  payment_method TEXT,
  reference TEXT,
  total_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH settings AS (
    SELECT
      GREATEST(COALESCE(p_page, 1), 1) AS page_number,
      LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50) AS page_limit
  ),
  invoice_entries AS (
    SELECT
      ('invoice:' || si.id::text) AS entry_id,
      ('invoice:' || si.id::text) AS sort_key,
      'invoice'::text AS source_type,
      si.id AS source_id,
      si.invoice_code::text AS document_number,
      (si.invoice_date::timestamp AT TIME ZONE 'UTC') AS event_at,
      si.due_date,
      si.status::text AS status,
      ('Sales invoice ' || si.invoice_code)::text AS description,
      si.total_amount::numeric AS debit,
      0::numeric AS credit,
      si.total_amount::numeric AS amount,
      si.total_amount::numeric AS balance_effect,
      NULL::text AS payment_method,
      NULL::text AS reference
    FROM public.sales_invoices si
    WHERE si.company_id = p_company_id
      AND si.customer_id = p_customer_id
      AND si.deleted_at IS NULL
      AND si.status NOT IN ('draft', 'cancelled')
  ),
  payment_entries AS (
    SELECT
      ('payment:' || ip.id::text) AS entry_id,
      ('payment:' || ip.id::text) AS sort_key,
      'payment'::text AS source_type,
      ip.id AS source_id,
      COALESCE(ip.payment_code, si.invoice_code)::text AS document_number,
      (ip.payment_date::timestamp AT TIME ZONE 'UTC') AS event_at,
      NULL::date AS due_date,
      si.status::text AS status,
      ('Payment for invoice ' || si.invoice_code)::text AS description,
      0::numeric AS debit,
      ip.amount::numeric AS credit,
      ip.amount::numeric AS amount,
      -ip.amount::numeric AS balance_effect,
      ip.payment_method::text AS payment_method,
      ip.reference::text AS reference
    FROM public.invoice_payments ip
    INNER JOIN public.sales_invoices si ON si.id = ip.invoice_id
    WHERE ip.company_id = p_company_id
      AND si.company_id = p_company_id
      AND si.customer_id = p_customer_id
      AND ip.deleted_at IS NULL
      AND si.deleted_at IS NULL
      AND si.status <> 'cancelled'
  ),
  pos_entries AS (
    SELECT
      ('pos:' || pt.id::text) AS entry_id,
      ('pos:' || pt.id::text) AS sort_key,
      'pos'::text AS source_type,
      pt.id AS source_id,
      pt.transaction_code::text AS document_number,
      pt.transaction_date AS event_at,
      NULL::date AS due_date,
      pt.status::text AS status,
      ('POS cash sale ' || pt.transaction_code)::text AS description,
      pt.total_amount::numeric AS debit,
      LEAST(pt.amount_paid::numeric, pt.total_amount::numeric) AS credit,
      pt.total_amount::numeric AS amount,
      (pt.total_amount::numeric - LEAST(pt.amount_paid::numeric, pt.total_amount::numeric)) AS balance_effect,
      payment_summary.payment_methods AS payment_method,
      payment_summary.references AS reference
    FROM public.pos_transactions pt
    LEFT JOIN LATERAL (
      SELECT
        STRING_AGG(DISTINCT pp.payment_method, ', ' ORDER BY pp.payment_method) AS payment_methods,
        STRING_AGG(DISTINCT pp.reference, ', ' ORDER BY pp.reference) FILTER (WHERE pp.reference IS NOT NULL AND pp.reference <> '') AS references
      FROM public.pos_transaction_payments pp
      WHERE pp.pos_transaction_id = pt.id
    ) payment_summary ON TRUE
    WHERE pt.company_id = p_company_id
      AND pt.customer_id = p_customer_id
      AND pt.status = 'completed'
  ),
  entries AS (
    SELECT * FROM invoice_entries
    UNION ALL
    SELECT * FROM payment_entries
    UNION ALL
    SELECT * FROM pos_entries
  ),
  opening AS (
    SELECT COALESCE(SUM(balance_effect), 0)::numeric AS amount
    FROM entries
    WHERE p_date_from IS NOT NULL
      AND event_at::date < p_date_from
  ),
  dated_entries AS (
    SELECT *
    FROM entries
    WHERE (p_date_from IS NULL OR event_at::date >= p_date_from)
      AND (p_date_to IS NULL OR event_at::date <= p_date_to)
  ),
  balanced_entries AS (
    SELECT
      dated_entries.*,
      opening.amount
        + SUM(dated_entries.balance_effect) OVER (
            ORDER BY dated_entries.event_at ASC, dated_entries.sort_key ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) AS running_balance
    FROM dated_entries
    CROSS JOIN opening
  ),
  visible_entries AS (
    SELECT *
    FROM balanced_entries
    WHERE (p_source_type IS NULL OR p_source_type = 'all' OR source_type = p_source_type)
      AND (
        NULLIF(TRIM(COALESCE(p_search, '')), '') IS NULL
        OR document_number ILIKE '%' || TRIM(p_search) || '%'
        OR description ILIKE '%' || TRIM(p_search) || '%'
        OR COALESCE(payment_method, '') ILIKE '%' || TRIM(p_search) || '%'
        OR COALESCE(reference, '') ILIKE '%' || TRIM(p_search) || '%'
      )
  ),
  numbered_entries AS (
    SELECT
      visible_entries.*,
      ROW_NUMBER() OVER (ORDER BY event_at DESC, sort_key DESC) AS row_number,
      COUNT(*) OVER () AS total_remaining
    FROM visible_entries
  )
  SELECT
    numbered_entries.entry_id,
    numbered_entries.sort_key,
    numbered_entries.source_type,
    numbered_entries.source_id,
    numbered_entries.document_number,
    numbered_entries.event_at,
    numbered_entries.due_date,
    numbered_entries.status,
    numbered_entries.description,
    numbered_entries.debit,
    numbered_entries.credit,
    numbered_entries.amount,
    numbered_entries.balance_effect,
    numbered_entries.running_balance,
    numbered_entries.payment_method,
    numbered_entries.reference,
    numbered_entries.total_remaining AS total_count
  FROM numbered_entries
  CROSS JOIN settings
  WHERE numbered_entries.row_number > ((settings.page_number - 1) * settings.page_limit)
    AND numbered_entries.row_number <= (settings.page_number * settings.page_limit)
  ORDER BY numbered_entries.event_at DESC, numbered_entries.sort_key DESC;
$$;

COMMENT ON FUNCTION public.get_customer_ledger_entries(UUID, UUID, DATE, DATE, TEXT, TEXT, INTEGER, INTEGER) IS
  'Returns page-paginated customer ledger entries with accurate running balances for the selected date window.';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer_activity
  ON public.sales_invoices(company_id, customer_id, invoice_date, id)
  WHERE deleted_at IS NULL AND status NOT IN ('draft', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_invoice_payments_company_date_invoice
  ON public.invoice_payments(company_id, payment_date, invoice_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pos_transactions_customer_activity
  ON public.pos_transactions(company_id, customer_id, transaction_date, id)
  WHERE status = 'completed';
