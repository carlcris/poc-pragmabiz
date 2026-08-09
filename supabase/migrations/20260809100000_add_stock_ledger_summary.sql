CREATE INDEX IF NOT EXISTS idx_stock_transaction_items_ledger_scope
  ON public.stock_transaction_items(company_id, item_id, posting_date, transaction_id)
  WHERE deleted_at IS NULL;

DROP FUNCTION IF EXISTS public.get_stock_ledger_summary(UUID, UUID, UUID, UUID, DATE, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.get_stock_ledger_summary(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_item_id UUID,
  p_warehouse_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_transaction_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_in NUMERIC,
  total_out NUMERIC,
  closing_balance NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH scoped_entries AS (
    SELECT
      stock_transaction_items.id,
      stock_transaction_items.posting_date,
      stock_transaction_items.posting_time,
      stock_transaction_items.qty_after,
      stock_transaction_items.qty_after - stock_transaction_items.qty_before AS inventory_delta
    FROM public.stock_transaction_items
    INNER JOIN public.stock_transactions
      ON stock_transactions.id = stock_transaction_items.transaction_id
     AND stock_transactions.company_id = p_company_id
     AND stock_transactions.deleted_at IS NULL
    WHERE stock_transaction_items.company_id = p_company_id
      AND stock_transaction_items.item_id = p_item_id
      AND stock_transaction_items.deleted_at IS NULL
      AND stock_transactions.warehouse_id = p_warehouse_id
      AND stock_transactions.business_unit_id = p_business_unit_id
      AND (
        p_start_date IS NULL
        OR stock_transaction_items.posting_date >= p_start_date
      )
      AND (
        p_end_date IS NULL
        OR stock_transaction_items.posting_date <= p_end_date
      )
      AND (
        p_transaction_type IS NULL
        OR stock_transactions.transaction_type = p_transaction_type
      )
  )
  SELECT
    COALESCE(
      SUM(
        CASE
          WHEN scoped_entries.inventory_delta > 0
            THEN scoped_entries.inventory_delta
          ELSE 0
        END
      ),
      0
    )::NUMERIC AS total_in,
    COALESCE(
      SUM(
        CASE
          WHEN scoped_entries.inventory_delta < 0
            THEN ABS(scoped_entries.inventory_delta)
          ELSE 0
        END
      ),
      0
    )::NUMERIC AS total_out,
    COALESCE(
      (
        SELECT latest_entry.qty_after
        FROM scoped_entries AS latest_entry
        ORDER BY
          latest_entry.posting_date DESC,
          latest_entry.posting_time DESC,
          latest_entry.id DESC
        LIMIT 1
      ),
      0
    )::NUMERIC AS closing_balance
  FROM scoped_entries;
$$;

COMMENT ON FUNCTION public.get_stock_ledger_summary(UUID, UUID, UUID, UUID, DATE, DATE, TEXT) IS
  'Returns filtered stock-ledger inbound and outbound totals plus the latest balance. Internal transfers with no balance change are excluded from both totals.';

REVOKE ALL ON FUNCTION public.get_stock_ledger_summary(UUID, UUID, UUID, UUID, DATE, DATE, TEXT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stock_ledger_summary(UUID, UUID, UUID, UUID, DATE, DATE, TEXT)
  TO authenticated;
