-- Migration: Drop Obsolete Stock Update Triggers
-- Created: 2025-12-15
--
-- Purpose: Remove old trigger that was causing double stock updates
-- The trigger_update_stock_on_receipt was from the old inventory system
-- and is now redundant since we manage stock through stock_transactions.
--
-- Issue: When receiving POs, stock was being updated twice:
-- 1. By the trigger when purchase_receipt_items are inserted
-- 2. By the application code when creating stock_transaction_items
--
-- This caused inventory quantities to be doubled (e.g., receiving 100kg
-- resulted in 200kg being added to inventory).

-- Drop the trigger
DROP TRIGGER IF EXISTS trigger_update_stock_on_receipt ON purchase_receipt_items;

-- Drop the function (no longer needed)
DROP FUNCTION IF EXISTS update_stock_on_receipt();

-- Add comment to document the change
COMMENT ON TABLE purchase_receipt_items IS
'Purchase receipt line items. Stock updates are now managed through stock_transactions and stock_transaction_items. The old trigger update_stock_on_receipt was removed in migration 20251215000002.';
