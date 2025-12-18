-- Migration: Enhance stock_transaction_items to replace stock_ledger
-- Purpose: Add columns to store before/after quantities and valuation data
-- Date: 2025-12-15
-- Part of: Inventory Module Refactoring (Phase 1)

-- Add new columns to stock_transaction_items
-- These columns replace the need for stock_ledger table
ALTER TABLE stock_transaction_items
  ADD COLUMN IF NOT EXISTS qty_before DECIMAL(20, 4) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS qty_after DECIMAL(20, 4) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS valuation_rate DECIMAL(20, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_value_before DECIMAL(20, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_value_after DECIMAL(20, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS posting_date DATE DEFAULT CURRENT_DATE NOT NULL,
  ADD COLUMN IF NOT EXISTS posting_time TIME DEFAULT CURRENT_TIME NOT NULL;

-- Add indexes for common queries
-- Index for date-based queries (stock movement reports)
CREATE INDEX IF NOT EXISTS idx_stock_trans_items_posting_date
  ON stock_transaction_items(posting_date)
  WHERE deleted_at IS NULL;

-- Composite index for item-warehouse-date queries (most common)
CREATE INDEX IF NOT EXISTS idx_stock_trans_items_item_warehouse_date
  ON stock_transaction_items(item_id, posting_date DESC)
  WHERE deleted_at IS NULL;

-- Index for posting time ordering (used with posting_date for chronological order)
CREATE INDEX IF NOT EXISTS idx_stock_trans_items_posting_datetime
  ON stock_transaction_items(posting_date DESC, posting_time DESC)
  WHERE deleted_at IS NULL;

-- Add comments to document the new columns
COMMENT ON COLUMN stock_transaction_items.qty_before IS 'Stock quantity before this transaction (replaces stock_ledger lookups)';
COMMENT ON COLUMN stock_transaction_items.qty_after IS 'Stock quantity after this transaction (replaces stock_ledger.qty_after_trans)';
COMMENT ON COLUMN stock_transaction_items.valuation_rate IS 'Valuation rate at time of transaction (cost per unit)';
COMMENT ON COLUMN stock_transaction_items.stock_value_before IS 'Total stock value before transaction';
COMMENT ON COLUMN stock_transaction_items.stock_value_after IS 'Total stock value after transaction';
COMMENT ON COLUMN stock_transaction_items.posting_date IS 'Date when transaction was posted (for historical queries)';
COMMENT ON COLUMN stock_transaction_items.posting_time IS 'Time when transaction was posted (for ordering)';

-- Populate existing records with default values based on current stock_ledger data (if any exist)
-- This is a one-time backfill for existing transactions
-- New transactions will populate these fields directly

-- Note: If you have existing data, you may want to run a data migration script
-- to populate qty_before/qty_after from stock_ledger before dropping it
-- Example (commented out - run separately if needed):
/*
UPDATE stock_transaction_items sti
SET
  qty_before = COALESCE(
    (SELECT qty_after_trans
     FROM stock_ledger
     WHERE transaction_item_id = sti.id
     LIMIT 1
    ), 0
  ),
  qty_after = COALESCE(
    (SELECT qty_after_trans
     FROM stock_ledger
     WHERE transaction_item_id = sti.id
     LIMIT 1
    ), 0
  ),
  posting_date = COALESCE(
    (SELECT posting_date
     FROM stock_ledger
     WHERE transaction_item_id = sti.id
     LIMIT 1
    ), CURRENT_DATE
  ),
  posting_time = COALESCE(
    (SELECT posting_time
     FROM stock_ledger
     WHERE transaction_item_id = sti.id
     LIMIT 1
    ), CURRENT_TIME
  )
WHERE EXISTS (
  SELECT 1 FROM stock_ledger WHERE transaction_item_id = sti.id
);
*/
