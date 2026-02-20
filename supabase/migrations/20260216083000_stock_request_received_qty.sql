-- ============================================================================
-- Migration: Stock Request Received Quantity Tracking
-- Version: 20260216083000
-- Description: Adds received_qty to stock_request_items to support deterministic
--              dispatch-receipt fulfillment tracking.
-- Author: System
-- Date: 2026-02-16
-- ============================================================================

ALTER TABLE stock_request_items
ADD COLUMN IF NOT EXISTS received_qty DECIMAL(20, 4) NOT NULL DEFAULT 0;

ALTER TABLE stock_request_items
DROP CONSTRAINT IF EXISTS stock_request_items_received_qty_check;

ALTER TABLE stock_request_items
ADD CONSTRAINT stock_request_items_received_qty_check
CHECK (received_qty >= 0 AND received_qty <= requested_qty);

ALTER TABLE stock_request_items
DROP CONSTRAINT IF EXISTS stock_request_items_received_le_dispatch_check;

ALTER TABLE stock_request_items
ADD CONSTRAINT stock_request_items_received_le_dispatch_check
CHECK (received_qty <= COALESCE(dispatch_qty, 0));

COMMENT ON COLUMN stock_request_items.received_qty IS 'Total quantity received at destination after dispatch';

CREATE INDEX IF NOT EXISTS idx_stock_request_items_received_qty
ON stock_request_items(stock_request_id, received_qty);
