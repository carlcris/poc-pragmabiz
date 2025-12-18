-- Migration: Drop stock_ledger table
-- Date: 2025-12-15
-- Purpose: Complete the inventory module refactoring by removing the stock_ledger table
--
-- IMPORTANT: This migration should only be run AFTER all testing is complete and verified.
-- Prerequisites:
-- 1. All code has been refactored to use item_warehouse as source of truth
-- 2. All endpoints have been tested and verified working
-- 3. Stock accuracy has been validated across all warehouses
-- 4. Historical data has been archived to CSV if needed
--
-- This migration:
-- 1. Drops all stock_ledger related indexes
-- 2. Drops the stock_ledger table
--
-- WARNING: This is a destructive operation. Ensure backups are in place before running.

-- Drop indexes first
DROP INDEX IF EXISTS idx_stock_ledger_item_warehouse_date;
DROP INDEX IF EXISTS idx_stock_ledger_transaction;
DROP INDEX IF EXISTS idx_stock_ledger_company;
DROP INDEX IF EXISTS idx_stock_ledger_posting_date;
DROP INDEX IF EXISTS idx_stock_ledger_item;
DROP INDEX IF EXISTS idx_stock_ledger_warehouse;

-- Drop the stock_ledger table
DROP TABLE IF EXISTS stock_ledger CASCADE;

-- Add comment to stock_transaction_items table
COMMENT ON TABLE stock_transaction_items IS 'Stock transaction items with ledger-style tracking. Includes qty_before, qty_after, valuation_rate, and stock values for each transaction. Replaces the old stock_ledger table.';

-- Add comments to new columns
COMMENT ON COLUMN stock_transaction_items.qty_before IS 'Quantity before this transaction (from item_warehouse.current_stock)';
COMMENT ON COLUMN stock_transaction_items.qty_after IS 'Quantity after this transaction (updated item_warehouse.current_stock)';
COMMENT ON COLUMN stock_transaction_items.valuation_rate IS 'Valuation rate (cost) per unit at time of transaction';
COMMENT ON COLUMN stock_transaction_items.stock_value_before IS 'Total stock value before transaction (qty_before * valuation_rate)';
COMMENT ON COLUMN stock_transaction_items.stock_value_after IS 'Total stock value after transaction (qty_after * valuation_rate)';
COMMENT ON COLUMN stock_transaction_items.posting_date IS 'Date when transaction was posted/recorded';
COMMENT ON COLUMN stock_transaction_items.posting_time IS 'Time when transaction was posted/recorded';
