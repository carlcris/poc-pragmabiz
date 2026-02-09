-- Migration: Remove item packaging and revert to UOM-based items
-- Version: 20260208000000
-- Description: Drops item_packaging and packaging-related columns, restores UOM-only flow
-- Author: System
-- Date: 2026-02-08

-- ============================================================================
-- STEP 1: Drop triggers and functions tied to packaging
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_validate_item_package ON items;
DROP FUNCTION IF EXISTS validate_item_package_belongs_to_item();

DROP TRIGGER IF EXISTS trigger_stock_tx_items_validate_item ON stock_transaction_items;
DROP TRIGGER IF EXISTS trigger_po_items_validate_item ON purchase_order_items;
DROP TRIGGER IF EXISTS trigger_pr_items_validate_item ON purchase_receipt_items;
DROP TRIGGER IF EXISTS trigger_so_items_validate_item ON sales_order_items;
DROP TRIGGER IF EXISTS trigger_si_items_validate_item ON sales_invoice_items;
DROP TRIGGER IF EXISTS trigger_pos_items_validate_item ON pos_transaction_items;
DROP TRIGGER IF EXISTS trigger_transfer_items_validate_item ON stock_transfer_items;
DROP FUNCTION IF EXISTS validate_item_ready_for_transaction();

DROP FUNCTION IF EXISTS create_item_with_packages(
  UUID,
  UUID,
  VARCHAR,
  VARCHAR,
  TEXT,
  VARCHAR,
  VARCHAR,
  VARCHAR,
  UUID,
  DECIMAL,
  DECIMAL,
  JSONB
);

DROP FUNCTION IF EXISTS get_item_base_package(UUID);

-- ============================================================================
-- STEP 2: Drop packaging-related columns
-- ============================================================================

ALTER TABLE items
  DROP CONSTRAINT IF EXISTS items_package_id_required_when_complete;

DROP INDEX IF EXISTS idx_items_package_id;
DROP INDEX IF EXISTS idx_items_setup_complete;

ALTER TABLE stock_transaction_items
  DROP COLUMN IF EXISTS input_packaging_id,
  DROP COLUMN IF EXISTS base_package_id,
  DROP COLUMN IF EXISTS packaging_id;

ALTER TABLE stock_adjustment_items
  DROP COLUMN IF EXISTS input_packaging_id,
  DROP COLUMN IF EXISTS base_package_id;

ALTER TABLE purchase_order_items
  DROP COLUMN IF EXISTS packaging_id;

ALTER TABLE purchase_receipt_items
  DROP COLUMN IF EXISTS packaging_id;

ALTER TABLE sales_order_items
  DROP COLUMN IF EXISTS packaging_id;

ALTER TABLE sales_invoice_items
  DROP COLUMN IF EXISTS packaging_id;

ALTER TABLE sales_quotation_items
  DROP COLUMN IF EXISTS packaging_id;

ALTER TABLE stock_request_items
  DROP COLUMN IF EXISTS packaging_id;

ALTER TABLE stock_transfer_items
  DROP COLUMN IF EXISTS packaging_id;

ALTER TABLE pos_transaction_items
  DROP COLUMN IF EXISTS packaging_id;

ALTER TABLE items
  DROP COLUMN IF EXISTS package_id,
  DROP COLUMN IF EXISTS setup_complete;

-- ============================================================================
-- STEP 3: Drop packaging table and related metadata
-- ============================================================================

DROP TABLE IF EXISTS item_packaging;

-- ============================================================================
-- STEP 4: Restore UOM-first semantics on items
-- ============================================================================

-- Backfill any missing item UOMs to PCS where possible
UPDATE items i
SET uom_id = u.id
FROM units_of_measure u
WHERE i.uom_id IS NULL
  AND u.company_id = i.company_id
  AND u.code = 'PCS'
  AND u.deleted_at IS NULL;

COMMENT ON COLUMN items.uom_id IS
  'Unit of measure for the item. Used for inventory storage and transactions.';

-- ============================================================================
-- Migration Complete
-- ============================================================================
