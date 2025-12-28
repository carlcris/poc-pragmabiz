-- ============================================================================
-- Migration: Add Waste Tracking to Transformation Order Outputs
-- Purpose: Track wasted/broken quantities and reasons during transformation
-- Date: 2025-12-20
-- ============================================================================

-- Add wasted_quantity column
ALTER TABLE transformation_order_outputs
ADD COLUMN wasted_quantity DECIMAL(20, 4) DEFAULT 0 CHECK (wasted_quantity >= 0);

-- Add waste_reason column
ALTER TABLE transformation_order_outputs
ADD COLUMN waste_reason TEXT;

-- Add stock_transaction_waste_id to reference waste transactions
ALTER TABLE transformation_order_outputs
ADD COLUMN stock_transaction_waste_id UUID REFERENCES stock_transactions(id);

-- Add comments
COMMENT ON COLUMN transformation_order_outputs.wasted_quantity IS 'Quantity wasted/broken during production';
COMMENT ON COLUMN transformation_order_outputs.waste_reason IS 'Reason for waste (required if wasted_quantity > 0)';
COMMENT ON COLUMN transformation_order_outputs.stock_transaction_waste_id IS 'Reference to waste stock transaction (type=out)';

-- Add constraint: waste reason required when wasted_quantity > 0
ALTER TABLE transformation_order_outputs
ADD CONSTRAINT chk_waste_reason_required CHECK (
    (wasted_quantity = 0 OR wasted_quantity IS NULL) OR
    (waste_reason IS NOT NULL AND waste_reason != '')
);
