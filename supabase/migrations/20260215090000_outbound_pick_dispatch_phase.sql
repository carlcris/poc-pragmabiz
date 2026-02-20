-- ============================================================================
-- Migration: Outbound Pick-Dispatch Phase 2
-- Version: 20260215090000
-- Description: Extends stock_request_items with dispatch lifecycle fields.
-- Author: System
-- Date: 2026-02-15
-- ============================================================================

ALTER TABLE stock_request_items
ADD COLUMN IF NOT EXISTS short_qty DECIMAL(20, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS short_reason_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS dispatch_qty DECIMAL(20, 4) DEFAULT 0;

ALTER TABLE stock_request_items
DROP CONSTRAINT IF EXISTS stock_request_items_short_qty_check;

ALTER TABLE stock_request_items
ADD CONSTRAINT stock_request_items_short_qty_check
CHECK (short_qty >= 0);

ALTER TABLE stock_request_items
DROP CONSTRAINT IF EXISTS stock_request_items_dispatch_qty_check;

ALTER TABLE stock_request_items
ADD CONSTRAINT stock_request_items_dispatch_qty_check
CHECK (dispatch_qty >= 0 AND dispatch_qty <= requested_qty);

COMMENT ON COLUMN stock_request_items.short_qty IS 'Short-picked quantity (requested - picked)';
COMMENT ON COLUMN stock_request_items.short_reason_code IS 'Reason code for short pick';
COMMENT ON COLUMN stock_request_items.dispatch_qty IS 'Total dispatched quantity';
