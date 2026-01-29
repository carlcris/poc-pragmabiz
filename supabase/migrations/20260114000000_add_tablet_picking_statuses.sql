-- ============================================================================
-- Migration: Add Tablet Warehouse Picking Statuses and Tracking
-- Version: 20260114000000
-- Description: Adds 'picking' and 'picked' statuses to stock_requests
--              and adds tracking columns for picking workflow
-- Author: System
-- Date: 2026-01-14
-- ============================================================================
--
-- Purpose: Support tablet warehouse picking workflow with:
-- - New statuses: 'picking' and 'picked'
-- - Picking start tracking (picking_started_at, picking_started_by)
-- - Delivery tracking (delivered_at, delivered_by)
-- - Updated workflow: draft → submitted → approved → ready_for_pick →
--                    picking → picked → delivered → received → completed
--
-- ============================================================================

-- ============================================================================
-- SECTION 1: Add new tracking columns
-- ============================================================================

-- Add picking start tracking columns
ALTER TABLE stock_requests
ADD COLUMN IF NOT EXISTS picking_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS picking_started_by UUID REFERENCES users(id);

-- Add delivery tracking columns
ALTER TABLE stock_requests
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS delivered_by UUID REFERENCES users(id);

-- Comments for new columns
COMMENT ON COLUMN stock_requests.picking_started_at IS 'Timestamp when picking started';
COMMENT ON COLUMN stock_requests.picking_started_by IS 'User who started picking';
COMMENT ON COLUMN stock_requests.delivered_at IS 'Timestamp when items were delivered';
COMMENT ON COLUMN stock_requests.delivered_by IS 'User who marked as delivered';

-- ============================================================================
-- SECTION 2: Update status constraint to include new statuses
-- ============================================================================

-- Drop existing status constraint
ALTER TABLE stock_requests
DROP CONSTRAINT IF EXISTS stock_requests_status_check;

-- Add new status constraint with 'picking' and 'picked' statuses
ALTER TABLE stock_requests
ADD CONSTRAINT stock_requests_status_check
CHECK (status IN (
    'draft',
    'submitted',
    'approved',
    'ready_for_pick',
    'picking',        -- NEW: Picker is actively picking items
    'picked',         -- NEW: Picking complete, ready for delivery
    'delivered',
    'received',
    'completed',
    'cancelled'
));

-- Update status column comment
COMMENT ON COLUMN stock_requests.status IS 'Workflow status: draft → submitted → approved → ready_for_pick → picking → picked → delivered → received → completed (or cancelled at any stage)';

-- ============================================================================
-- SECTION 3: Create indexes for tablet warehouse queries
-- ============================================================================

-- Index for picking status queries (tablet picking list)
CREATE INDEX IF NOT EXISTS idx_stock_requests_picking_status
ON stock_requests(status, priority DESC, required_date ASC, created_at ASC)
WHERE status IN ('ready_for_pick', 'picking', 'picked')
AND deleted_at IS NULL;

-- Index for picker tracking
CREATE INDEX IF NOT EXISTS idx_stock_requests_picking_started_by
ON stock_requests(picking_started_by, picking_started_at DESC)
WHERE picking_started_by IS NOT NULL
AND deleted_at IS NULL;

-- Index for delivery tracking
CREATE INDEX IF NOT EXISTS idx_stock_requests_delivered_by
ON stock_requests(delivered_by, delivered_at DESC)
WHERE delivered_by IS NOT NULL
AND deleted_at IS NULL;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verification queries (commented out, uncomment to run manually)
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'stock_requests'
-- AND column_name IN ('picking_started_at', 'picking_started_by', 'delivered_at', 'delivered_by');
--
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name = 'stock_requests_status_check';
