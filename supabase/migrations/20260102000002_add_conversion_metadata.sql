-- Migration: Add conversion tracking to stock_transaction_items
-- Version: 20260102000002
-- Description: Add conversion metadata columns for inventory normalization audit trail
-- Author: System
-- Date: 2026-01-02
-- Reference: inv-normalization-implementation-plan.md

-- ============================================================================
-- STEP 1: Add conversion metadata columns
-- ============================================================================

ALTER TABLE stock_transaction_items
ADD COLUMN IF NOT EXISTS input_qty DECIMAL(15, 4),
ADD COLUMN IF NOT EXISTS input_packaging_id UUID REFERENCES item_packaging(id),
ADD COLUMN IF NOT EXISTS normalized_qty DECIMAL(15, 4),
ADD COLUMN IF NOT EXISTS conversion_factor DECIMAL(15, 4) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS base_package_id UUID REFERENCES item_packaging(id);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_stock_tx_items_input_packaging
ON stock_transaction_items(input_packaging_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_tx_items_base_package
ON stock_transaction_items(base_package_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- STEP 3: Add check constraint for conversion formula validation
-- ============================================================================

ALTER TABLE stock_transaction_items
ADD CONSTRAINT stock_tx_items_conversion_check
CHECK (
  normalized_qty IS NULL OR
  input_qty IS NULL OR
  conversion_factor IS NULL OR
  ABS(normalized_qty - (input_qty * conversion_factor)) < 0.01
);

-- ============================================================================
-- STEP 4: Backfill existing records (assume already normalized)
-- ============================================================================

-- For historical data, assume quantities are already in base units
-- Set input_qty = quantity, normalized_qty = quantity, conversion_factor = 1.0
UPDATE stock_transaction_items
SET
  input_qty = quantity,
  normalized_qty = quantity,
  conversion_factor = 1.0,
  input_packaging_id = NULL,  -- Unknown for historical data
  base_package_id = NULL       -- Unknown for historical data
WHERE input_qty IS NULL
  AND deleted_at IS NULL;

-- ============================================================================
-- STEP 5: Make required columns NOT NULL
-- ============================================================================

-- After backfill, make these columns required for data integrity
ALTER TABLE stock_transaction_items
ALTER COLUMN input_qty SET NOT NULL,
ALTER COLUMN normalized_qty SET NOT NULL,
ALTER COLUMN conversion_factor SET NOT NULL;

-- ============================================================================
-- STEP 6: Add column comments
-- ============================================================================

COMMENT ON COLUMN stock_transaction_items.quantity IS
  'DEPRECATED: Use normalized_qty instead. Kept for backward compatibility.';

COMMENT ON COLUMN stock_transaction_items.normalized_qty IS
  'Quantity in base package units. This is the source of truth for inventory calculations.
   Formula: normalized_qty = input_qty × conversion_factor';

COMMENT ON COLUMN stock_transaction_items.input_qty IS
  'Original quantity entered by user in selected package.
   Example: User enters "10 cartons", input_qty = 10';

COMMENT ON COLUMN stock_transaction_items.input_packaging_id IS
  'Package selected by user for input. References item_packaging.id.
   Example: "Carton (25kg)" package. NULL for historical data.';

COMMENT ON COLUMN stock_transaction_items.conversion_factor IS
  'Conversion factor from input package to base package (qty_per_pack).
   Formula: conversion_factor = input_packaging.qty_per_pack
   Example: Carton has qty_per_pack=25, so conversion_factor=25.0';

COMMENT ON COLUMN stock_transaction_items.base_package_id IS
  'Base package used for normalization. References items.package_id at time of transaction.
   This is the package that defines the base storage unit. NULL for historical data.';

-- ============================================================================
-- Migration Complete: Conversion metadata tracking enabled
-- ============================================================================
