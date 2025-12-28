-- Remove ALL duplicate company-based RLS policies across all tables
-- Keep only BU policies (bu_select_policy, bu_insert_policy, bu_update_policy, bu_delete_policy)

-- Generate DROP statements for all non-BU policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE policyname NOT LIKE 'bu_%'
          AND tablename IN (
            'sales_quotations', 'sales_orders', 'sales_invoices',
            'purchase_orders', 'purchase_receipts',
            'customers', 'suppliers', 'warehouses', 'employees',
            'stock_transactions', 'stock_adjustments', 'stock_transfers',
            'pos_transactions', 'transformation_orders', 'transformation_templates',
            'van_eod_reconciliations', 'journal_entries', 'invoice_payments'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                      r.policyname, r.schemaname, r.tablename);
        RAISE NOTICE 'Dropped policy % on %.%', r.policyname, r.schemaname, r.tablename;
    END LOOP;
END $$;

COMMENT ON TABLE sales_quotations IS 'RLS enforced by business unit policies only';
COMMENT ON TABLE sales_orders IS 'RLS enforced by business unit policies only';
COMMENT ON TABLE sales_invoices IS 'RLS enforced by business unit policies only';
