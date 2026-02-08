-- Migration: Add Phase 1 composite indexes for high-traffic procurement/receiving filters
-- Date: 2026-02-07
-- Purpose:
--   Improve list endpoint performance for load lists, GRNs, purchase orders,
--   and purchase receipts where queries consistently filter by company scope
--   plus status/warehouse/business_unit/date and sort by created_at.

-- ============================================================================
-- LOAD LISTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_load_lists_company_status_created_at
ON load_lists(company_id, status, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_load_lists_company_bu_created_at
ON load_lists(company_id, business_unit_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_load_lists_company_warehouse_arrival
ON load_lists(company_id, warehouse_id, estimated_arrival_date DESC)
WHERE deleted_at IS NULL;

-- ============================================================================
-- GRNS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_grns_company_status_created_at
ON grns(company_id, status, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_grns_company_warehouse_receiving_date
ON grns(company_id, warehouse_id, receiving_date DESC)
WHERE deleted_at IS NULL;

-- ============================================================================
-- PURCHASE ORDERS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_purchase_orders_company_status_created_at
ON purchase_orders(company_id, status, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_company_bu_created_at
ON purchase_orders(company_id, business_unit_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_company_supplier_created_at
ON purchase_orders(company_id, supplier_id, created_at DESC)
WHERE deleted_at IS NULL;

-- ============================================================================
-- PURCHASE RECEIPTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_company_status_created_at
ON purchase_receipts(company_id, status, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_company_warehouse_receipt_date
ON purchase_receipts(company_id, warehouse_id, receipt_date DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_company_po_created_at
ON purchase_receipts(company_id, purchase_order_id, created_at DESC)
WHERE deleted_at IS NULL;
