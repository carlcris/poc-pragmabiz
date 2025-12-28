-- ============================================================================
-- Migration: Multi-Business Unit Support - Phase 2: Row Level Security
-- Purpose: Enable RLS and create policies for business unit isolation
-- Date: 2025-12-21
-- Compliance: Strictly follows multi-business-unit-prd.md
-- ============================================================================

-- ============================================================================
-- SECTION 1: Create Database Context Function
-- ============================================================================

-- Function to set the current business unit context
-- This must be called before any queries to ensure proper RLS filtering
CREATE OR REPLACE FUNCTION set_business_unit_context(p_business_unit_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_has_access BOOLEAN;
BEGIN
  -- Get current authenticated user ID
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Verify user has access to this business unit
  SELECT EXISTS (
    SELECT 1 FROM user_business_unit_access
    WHERE user_id = v_user_id
    AND business_unit_id = p_business_unit_id
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'User does not have access to business unit %', p_business_unit_id;
  END IF;

  -- Set the business unit context in the session
  PERFORM set_config('app.current_business_unit_id', p_business_unit_id::text, false);
END;
$$;

COMMENT ON FUNCTION set_business_unit_context IS 'Sets the active business unit context for the current session with access verification';

-- Function to get current business unit context
CREATE OR REPLACE FUNCTION get_current_business_unit_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_business_unit_id', true), '')::uuid;
END;
$$;

COMMENT ON FUNCTION get_current_business_unit_id IS 'Returns the current business unit ID from session context';

-- ============================================================================
-- SECTION 2: Enable RLS on All Operational Tables
-- ============================================================================

ALTER TABLE sales_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_receipts ENABLE ROW LEVEL SECURITY;

ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;

ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;

ALTER TABLE transformation_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

ALTER TABLE van_eod_reconciliations ENABLE ROW LEVEL SECURITY;

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 3: Create Performance Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sales_quotations_bu ON sales_quotations(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_bu ON sales_orders(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_bu ON sales_invoices(business_unit_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_bu ON purchase_orders(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_bu ON purchase_receipts(business_unit_id);

CREATE INDEX IF NOT EXISTS idx_stock_transactions_bu ON stock_transactions(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_bu ON stock_adjustments(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_bu ON stock_transfers(business_unit_id);

CREATE INDEX IF NOT EXISTS idx_pos_transactions_bu ON pos_transactions(business_unit_id);

CREATE INDEX IF NOT EXISTS idx_transformation_orders_bu ON transformation_orders(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_transformation_templates_bu ON transformation_templates(business_unit_id);

CREATE INDEX IF NOT EXISTS idx_customers_bu ON customers(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_bu ON suppliers(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_bu ON warehouses(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_employees_bu ON employees(business_unit_id);

CREATE INDEX IF NOT EXISTS idx_van_eod_reconciliations_bu ON van_eod_reconciliations(business_unit_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_bu ON journal_entries(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_bu ON invoice_payments(business_unit_id);

-- ============================================================================
-- SECTION 4: Create RLS Policies - Sales Module
-- ============================================================================

-- Sales Quotations
DROP POLICY IF EXISTS bu_select_policy ON sales_quotations;
CREATE POLICY bu_select_policy ON sales_quotations
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL -- Allow NULL during transition period
  );

DROP POLICY IF EXISTS bu_insert_policy ON sales_quotations;
CREATE POLICY bu_insert_policy ON sales_quotations
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL -- Allow NULL during transition period
  );

DROP POLICY IF EXISTS bu_update_policy ON sales_quotations;
CREATE POLICY bu_update_policy ON sales_quotations
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON sales_quotations;
CREATE POLICY bu_delete_policy ON sales_quotations
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Sales Orders
DROP POLICY IF EXISTS bu_select_policy ON sales_orders;
CREATE POLICY bu_select_policy ON sales_orders
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON sales_orders;
CREATE POLICY bu_insert_policy ON sales_orders
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON sales_orders;
CREATE POLICY bu_update_policy ON sales_orders
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON sales_orders;
CREATE POLICY bu_delete_policy ON sales_orders
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Sales Invoices
DROP POLICY IF EXISTS bu_select_policy ON sales_invoices;
CREATE POLICY bu_select_policy ON sales_invoices
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON sales_invoices;
CREATE POLICY bu_insert_policy ON sales_invoices
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON sales_invoices;
CREATE POLICY bu_update_policy ON sales_invoices
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON sales_invoices;
CREATE POLICY bu_delete_policy ON sales_invoices
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- ============================================================================
-- SECTION 5: Create RLS Policies - Purchase Module
-- ============================================================================

-- Purchase Orders
DROP POLICY IF EXISTS bu_select_policy ON purchase_orders;
CREATE POLICY bu_select_policy ON purchase_orders
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON purchase_orders;
CREATE POLICY bu_insert_policy ON purchase_orders
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON purchase_orders;
CREATE POLICY bu_update_policy ON purchase_orders
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON purchase_orders;
CREATE POLICY bu_delete_policy ON purchase_orders
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Purchase Receipts
DROP POLICY IF EXISTS bu_select_policy ON purchase_receipts;
CREATE POLICY bu_select_policy ON purchase_receipts
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON purchase_receipts;
CREATE POLICY bu_insert_policy ON purchase_receipts
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON purchase_receipts;
CREATE POLICY bu_update_policy ON purchase_receipts
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON purchase_receipts;
CREATE POLICY bu_delete_policy ON purchase_receipts
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- ============================================================================
-- SECTION 6: Create RLS Policies - Inventory Module
-- ============================================================================

-- Stock Transactions
DROP POLICY IF EXISTS bu_select_policy ON stock_transactions;
CREATE POLICY bu_select_policy ON stock_transactions
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON stock_transactions;
CREATE POLICY bu_insert_policy ON stock_transactions
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON stock_transactions;
CREATE POLICY bu_update_policy ON stock_transactions
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON stock_transactions;
CREATE POLICY bu_delete_policy ON stock_transactions
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Stock Adjustments
DROP POLICY IF EXISTS bu_select_policy ON stock_adjustments;
CREATE POLICY bu_select_policy ON stock_adjustments
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON stock_adjustments;
CREATE POLICY bu_insert_policy ON stock_adjustments
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON stock_adjustments;
CREATE POLICY bu_update_policy ON stock_adjustments
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON stock_adjustments;
CREATE POLICY bu_delete_policy ON stock_adjustments
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Stock Transfers
DROP POLICY IF EXISTS bu_select_policy ON stock_transfers;
CREATE POLICY bu_select_policy ON stock_transfers
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON stock_transfers;
CREATE POLICY bu_insert_policy ON stock_transfers
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON stock_transfers;
CREATE POLICY bu_update_policy ON stock_transfers
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON stock_transfers;
CREATE POLICY bu_delete_policy ON stock_transfers
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- ============================================================================
-- SECTION 7: Create RLS Policies - POS Module
-- ============================================================================

-- POS Transactions
DROP POLICY IF EXISTS bu_select_policy ON pos_transactions;
CREATE POLICY bu_select_policy ON pos_transactions
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON pos_transactions;
CREATE POLICY bu_insert_policy ON pos_transactions
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON pos_transactions;
CREATE POLICY bu_update_policy ON pos_transactions
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON pos_transactions;
CREATE POLICY bu_delete_policy ON pos_transactions
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- ============================================================================
-- SECTION 8: Create RLS Policies - Transformation Module
-- ============================================================================

-- Transformation Orders
DROP POLICY IF EXISTS bu_select_policy ON transformation_orders;
CREATE POLICY bu_select_policy ON transformation_orders
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON transformation_orders;
CREATE POLICY bu_insert_policy ON transformation_orders
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON transformation_orders;
CREATE POLICY bu_update_policy ON transformation_orders
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON transformation_orders;
CREATE POLICY bu_delete_policy ON transformation_orders
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Transformation Templates
DROP POLICY IF EXISTS bu_select_policy ON transformation_templates;
CREATE POLICY bu_select_policy ON transformation_templates
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON transformation_templates;
CREATE POLICY bu_insert_policy ON transformation_templates
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON transformation_templates;
CREATE POLICY bu_update_policy ON transformation_templates
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON transformation_templates;
CREATE POLICY bu_delete_policy ON transformation_templates
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- ============================================================================
-- SECTION 9: Create RLS Policies - Master Data
-- ============================================================================

-- Customers
DROP POLICY IF EXISTS bu_select_policy ON customers;
CREATE POLICY bu_select_policy ON customers
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON customers;
CREATE POLICY bu_insert_policy ON customers
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON customers;
CREATE POLICY bu_update_policy ON customers
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON customers;
CREATE POLICY bu_delete_policy ON customers
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Suppliers
DROP POLICY IF EXISTS bu_select_policy ON suppliers;
CREATE POLICY bu_select_policy ON suppliers
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON suppliers;
CREATE POLICY bu_insert_policy ON suppliers
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON suppliers;
CREATE POLICY bu_update_policy ON suppliers
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON suppliers;
CREATE POLICY bu_delete_policy ON suppliers
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Warehouses
DROP POLICY IF EXISTS bu_select_policy ON warehouses;
CREATE POLICY bu_select_policy ON warehouses
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON warehouses;
CREATE POLICY bu_insert_policy ON warehouses
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON warehouses;
CREATE POLICY bu_update_policy ON warehouses
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON warehouses;
CREATE POLICY bu_delete_policy ON warehouses
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Employees
DROP POLICY IF EXISTS bu_select_policy ON employees;
CREATE POLICY bu_select_policy ON employees
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON employees;
CREATE POLICY bu_insert_policy ON employees
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON employees;
CREATE POLICY bu_update_policy ON employees
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON employees;
CREATE POLICY bu_delete_policy ON employees
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- ============================================================================
-- SECTION 10: Create RLS Policies - Van Sales Module
-- ============================================================================

-- Van EOD Reconciliations
DROP POLICY IF EXISTS bu_select_policy ON van_eod_reconciliations;
CREATE POLICY bu_select_policy ON van_eod_reconciliations
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON van_eod_reconciliations;
CREATE POLICY bu_insert_policy ON van_eod_reconciliations
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON van_eod_reconciliations;
CREATE POLICY bu_update_policy ON van_eod_reconciliations
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON van_eod_reconciliations;
CREATE POLICY bu_delete_policy ON van_eod_reconciliations
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- ============================================================================
-- SECTION 11: Create RLS Policies - Accounting Module
-- ============================================================================

-- Journal Entries
DROP POLICY IF EXISTS bu_select_policy ON journal_entries;
CREATE POLICY bu_select_policy ON journal_entries
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON journal_entries;
CREATE POLICY bu_insert_policy ON journal_entries
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON journal_entries;
CREATE POLICY bu_update_policy ON journal_entries
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON journal_entries;
CREATE POLICY bu_delete_policy ON journal_entries
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Invoice Payments
DROP POLICY IF EXISTS bu_select_policy ON invoice_payments;
CREATE POLICY bu_select_policy ON invoice_payments
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON invoice_payments;
CREATE POLICY bu_insert_policy ON invoice_payments
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON invoice_payments;
CREATE POLICY bu_update_policy ON invoice_payments
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON invoice_payments;
CREATE POLICY bu_delete_policy ON invoice_payments
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- ============================================================================
-- SECTION 12: Verification & Summary
-- ============================================================================

DO $$
DECLARE
  rls_enabled_count INTEGER;
  policy_count INTEGER;
  index_count INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Phase 2: RLS Implementation Complete';
  RAISE NOTICE '========================================';

  -- Count tables with RLS enabled
  SELECT COUNT(*) INTO rls_enabled_count
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE t.schemaname = 'public'
  AND c.relrowsecurity = true
  AND t.tablename IN (
    'sales_quotations', 'sales_orders', 'sales_invoices',
    'purchase_orders', 'purchase_receipts',
    'stock_transactions', 'stock_adjustments', 'stock_transfers',
    'pos_transactions',
    'transformation_orders', 'transformation_templates',
    'customers', 'suppliers', 'warehouses', 'employees',
    'van_eod_reconciliations',
    'journal_entries', 'invoice_payments'
  );

  -- Count policies created
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND policyname LIKE 'bu_%_policy';

  -- Count indexes created
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%_bu';

  RAISE NOTICE 'Tables with RLS enabled: %', rls_enabled_count;
  RAISE NOTICE 'Business unit policies created: %', policy_count;
  RAISE NOTICE 'Performance indexes created: %', index_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Test RLS policies with different business unit contexts';
  RAISE NOTICE '2. Proceed to Phase 3: Backend Middleware & Context Management';
  RAISE NOTICE '3. Create Supabase client wrapper with BU context injection';
  RAISE NOTICE '========================================';
END $$;
