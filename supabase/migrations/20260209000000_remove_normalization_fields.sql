-- Migration: Remove normalization fields (input_qty, normalized_qty, conversion_factor)
-- Date: 2026-02-09

-- stock_transaction_items
ALTER TABLE stock_transaction_items
DROP CONSTRAINT IF EXISTS stock_tx_items_conversion_check;

ALTER TABLE stock_transaction_items
DROP COLUMN IF EXISTS input_qty,
DROP COLUMN IF EXISTS normalized_qty,
DROP COLUMN IF EXISTS conversion_factor;

-- stock_adjustment_items
ALTER TABLE stock_adjustment_items
DROP CONSTRAINT IF EXISTS stock_adj_items_conversion_check;

ALTER TABLE stock_adjustment_items
DROP COLUMN IF EXISTS input_qty,
DROP COLUMN IF EXISTS normalized_qty,
DROP COLUMN IF EXISTS conversion_factor;
