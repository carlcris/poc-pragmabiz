-- ============================================================================
-- Migration: Remove Old Company-Based RLS Policies
-- Purpose: Remove company-based RLS policies that conflict with BU policies
-- Date: 2025-12-23
-- Reason: Old policies are permissive and allow cross-BU data leakage
-- ============================================================================

-- Drop old company-based policies that are conflicting with BU isolation
-- These policies only checked company_id, allowing users to see data from all BUs

-- Customers
DROP POLICY IF EXISTS customers_select_policy ON customers;
DROP POLICY IF EXISTS customers_insert_policy ON customers;
DROP POLICY IF EXISTS customers_update_policy ON customers;
DROP POLICY IF EXISTS customers_delete_policy ON customers;

-- Suppliers
DROP POLICY IF EXISTS suppliers_select_policy ON suppliers;
DROP POLICY IF EXISTS suppliers_insert_policy ON suppliers;
DROP POLICY IF EXISTS suppliers_update_policy ON suppliers;
DROP POLICY IF EXISTS suppliers_delete_policy ON suppliers;

-- Warehouses
DROP POLICY IF EXISTS warehouses_select_policy ON warehouses;
DROP POLICY IF EXISTS warehouses_insert_policy ON warehouses;
DROP POLICY IF EXISTS warehouses_update_policy ON warehouses;
DROP POLICY IF EXISTS warehouses_delete_policy ON warehouses;

-- Employees
DROP POLICY IF EXISTS employees_select_policy ON employees;
DROP POLICY IF EXISTS employees_insert_policy ON employees;
DROP POLICY IF EXISTS employees_update_policy ON employees;
DROP POLICY IF EXISTS employees_delete_policy ON employees;

-- Sales Quotations
DROP POLICY IF EXISTS quotations_select_policy ON sales_quotations;
DROP POLICY IF EXISTS quotations_insert_policy ON sales_quotations;
DROP POLICY IF EXISTS quotations_update_policy ON sales_quotations;
DROP POLICY IF EXISTS quotations_delete_policy ON sales_quotations;

-- Sales Orders
DROP POLICY IF EXISTS orders_select_policy ON sales_orders;
DROP POLICY IF EXISTS orders_insert_policy ON sales_orders;
DROP POLICY IF EXISTS orders_update_policy ON sales_orders;
DROP POLICY IF EXISTS orders_delete_policy ON sales_orders;

-- Sales Invoices
DROP POLICY IF EXISTS invoices_select_policy ON sales_invoices;
DROP POLICY IF EXISTS invoices_insert_policy ON sales_invoices;
DROP POLICY IF EXISTS invoices_update_policy ON sales_invoices;
DROP POLICY IF EXISTS invoices_delete_policy ON sales_invoices;

-- Purchase Orders
DROP POLICY IF EXISTS purchase_orders_select_policy ON purchase_orders;
DROP POLICY IF EXISTS purchase_orders_insert_policy ON purchase_orders;
DROP POLICY IF EXISTS purchase_orders_update_policy ON purchase_orders;
DROP POLICY IF EXISTS purchase_orders_delete_policy ON purchase_orders;

-- Purchase Receipts
DROP POLICY IF EXISTS purchase_receipts_select_policy ON purchase_receipts;
DROP POLICY IF EXISTS purchase_receipts_insert_policy ON purchase_receipts;
DROP POLICY IF EXISTS purchase_receipts_update_policy ON purchase_receipts;
DROP POLICY IF EXISTS purchase_receipts_delete_policy ON purchase_receipts;

-- Stock Transactions
DROP POLICY IF EXISTS stock_transactions_select_policy ON stock_transactions;
DROP POLICY IF EXISTS stock_transactions_insert_policy ON stock_transactions;
DROP POLICY IF EXISTS stock_transactions_update_policy ON stock_transactions;
DROP POLICY IF EXISTS stock_transactions_delete_policy ON stock_transactions;

-- Stock Adjustments
DROP POLICY IF EXISTS stock_adjustments_select_policy ON stock_adjustments;
DROP POLICY IF EXISTS stock_adjustments_insert_policy ON stock_adjustments;
DROP POLICY IF EXISTS stock_adjustments_update_policy ON stock_adjustments;
DROP POLICY IF EXISTS stock_adjustments_delete_policy ON stock_adjustments;

-- Stock Transfers
DROP POLICY IF EXISTS stock_transfers_select_policy ON stock_transfers;
DROP POLICY IF EXISTS stock_transfers_insert_policy ON stock_transfers;
DROP POLICY IF EXISTS stock_transfers_update_policy ON stock_transfers;
DROP POLICY IF EXISTS stock_transfers_delete_policy ON stock_transfers;

-- POS Transactions
DROP POLICY IF EXISTS pos_transactions_select_policy ON pos_transactions;
DROP POLICY IF EXISTS pos_transactions_insert_policy ON pos_transactions;
DROP POLICY IF EXISTS pos_transactions_update_policy ON pos_transactions;
DROP POLICY IF EXISTS pos_transactions_delete_policy ON pos_transactions;

-- Transformation Orders
DROP POLICY IF EXISTS transformation_orders_select_policy ON transformation_orders;
DROP POLICY IF EXISTS transformation_orders_insert_policy ON transformation_orders;
DROP POLICY IF EXISTS transformation_orders_update_policy ON transformation_orders;
DROP POLICY IF EXISTS transformation_orders_delete_policy ON transformation_orders;

-- Transformation Templates
DROP POLICY IF EXISTS transformation_templates_select_policy ON transformation_templates;
DROP POLICY IF EXISTS transformation_templates_insert_policy ON transformation_templates;
DROP POLICY IF EXISTS transformation_templates_update_policy ON transformation_templates;
DROP POLICY IF EXISTS transformation_templates_delete_policy ON transformation_templates;

-- Journal Entries
DROP POLICY IF EXISTS journal_entries_select_policy ON journal_entries;
DROP POLICY IF EXISTS journal_entries_insert_policy ON journal_entries;
DROP POLICY IF EXISTS journal_entries_update_policy ON journal_entries;
DROP POLICY IF EXISTS journal_entries_delete_policy ON journal_entries;

-- Invoice Payments
DROP POLICY IF EXISTS invoice_payments_select_policy ON invoice_payments;
DROP POLICY IF EXISTS invoice_payments_insert_policy ON invoice_payments;
DROP POLICY IF EXISTS invoice_payments_update_policy ON invoice_payments;
DROP POLICY IF EXISTS invoice_payments_delete_policy ON invoice_payments;

-- Van EOD Reconciliations
DROP POLICY IF EXISTS van_eod_reconciliations_select_policy ON van_eod_reconciliations;
DROP POLICY IF EXISTS van_eod_reconciliations_insert_policy ON van_eod_reconciliations;
DROP POLICY IF EXISTS van_eod_reconciliations_update_policy ON van_eod_reconciliations;
DROP POLICY IF EXISTS van_eod_reconciliations_delete_policy ON van_eod_reconciliations;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  -- Count remaining company-based policies
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND policyname LIKE '%_select_policy'
  AND policyname NOT LIKE 'bu_%';

  IF v_policy_count > 0 THEN
    RAISE WARNING 'Still have % old company-based policies remaining', v_policy_count;
  ELSE
    RAISE NOTICE 'All old company-based RLS policies have been removed successfully';
  END IF;

  -- Count BU policies
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND policyname LIKE 'bu_%';

  RAISE NOTICE 'Business unit policies in place: %', v_policy_count;
END $$;
