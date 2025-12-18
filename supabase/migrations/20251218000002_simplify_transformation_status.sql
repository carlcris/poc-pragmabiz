-- Migration: Simplify transformation order status workflow
-- Changes: DRAFT → RELEASED → EXECUTING → COMPLETED → CLOSED
-- To:      DRAFT → PREPARING → COMPLETED
-- With CANCELLED available from DRAFT or PREPARING

-- Drop the old check constraint
ALTER TABLE transformation_orders
  DROP CONSTRAINT IF EXISTS transformation_orders_status_check;

-- Add new check constraint with simplified statuses
ALTER TABLE transformation_orders
  ADD CONSTRAINT transformation_orders_status_check
  CHECK (status IN ('DRAFT', 'PREPARING', 'COMPLETED', 'CANCELLED'));

-- Update any existing orders with old statuses to new statuses
-- RELEASED → PREPARING
UPDATE transformation_orders
SET status = 'PREPARING'
WHERE status = 'RELEASED';

-- EXECUTING → PREPARING (if not yet completed)
UPDATE transformation_orders
SET status = 'PREPARING'
WHERE status = 'EXECUTING';

-- CLOSED → COMPLETED
UPDATE transformation_orders
SET status = 'COMPLETED'
WHERE status = 'CLOSED';

-- Add comment
COMMENT ON COLUMN transformation_orders.status IS 'Order status: DRAFT → PREPARING → COMPLETED (or CANCELLED)';
