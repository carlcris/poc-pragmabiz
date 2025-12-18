-- Migration: Remove destination warehouse from transformations
-- Transformations now happen within a single warehouse
-- Items are consumed and produced in the same warehouse
-- Use stock transfers for moving items between warehouses

-- Step 1: For existing orders, set source_warehouse_id = dest_warehouse_id if source is null
UPDATE transformation_orders
SET source_warehouse_id = dest_warehouse_id
WHERE source_warehouse_id IS NULL;

-- Step 2: Drop the destination warehouse column
ALTER TABLE transformation_orders
  DROP COLUMN IF EXISTS dest_warehouse_id;

-- Step 3: Update templates - remove destination warehouse
ALTER TABLE transformation_templates
  DROP COLUMN IF EXISTS dest_warehouse_id;

-- Step 4: Add comments
COMMENT ON COLUMN transformation_orders.source_warehouse_id IS 'Warehouse where transformation occurs (inputs consumed and outputs produced)';
COMMENT ON TABLE transformation_orders IS 'Transformation orders - converts input items into output items within a single warehouse';
COMMENT ON TABLE transformation_templates IS 'Reusable transformation recipes defining input/output ratios';
