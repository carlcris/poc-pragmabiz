-- ============================================================================
-- Migration: Add conversion tracking to transaction tables
-- Description: Adds normalization metadata columns for package-based inventory
-- ============================================================================

-- ============================================================================
-- TABLE: stock_transaction_items - Add conversion metadata
-- ============================================================================
ALTER TABLE stock_transaction_items
ADD COLUMN IF NOT EXISTS input_qty DECIMAL(15, 4),
ADD COLUMN IF NOT EXISTS input_packaging_id UUID REFERENCES item_packaging(id),
ADD COLUMN IF NOT EXISTS normalized_qty DECIMAL(15, 4),
ADD COLUMN IF NOT EXISTS conversion_factor DECIMAL(15, 4) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS base_package_id UUID REFERENCES item_packaging(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stock_tx_items_input_packaging
ON stock_transaction_items(input_packaging_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_tx_items_base_package
ON stock_transaction_items(base_package_id) WHERE deleted_at IS NULL;

-- Backfill existing records (assume already normalized)
UPDATE stock_transaction_items
SET
  input_qty = quantity,
  normalized_qty = quantity,
  conversion_factor = 1.0,
  input_packaging_id = NULL,
  base_package_id = NULL
WHERE input_qty IS NULL;

-- Make required columns NOT NULL
ALTER TABLE stock_transaction_items
ALTER COLUMN input_qty SET NOT NULL,
ALTER COLUMN normalized_qty SET NOT NULL,
ALTER COLUMN conversion_factor SET NOT NULL;

-- Add check constraint (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stock_tx_items_conversion_check'
  ) THEN
    ALTER TABLE stock_transaction_items
    ADD CONSTRAINT stock_tx_items_conversion_check
    CHECK (
      normalized_qty IS NULL OR
      input_qty IS NULL OR
      conversion_factor IS NULL OR
      ABS(normalized_qty - (input_qty * conversion_factor)) < 0.01
    );
  END IF;
END
$$;

-- Add comments
COMMENT ON COLUMN stock_transaction_items.quantity IS
  'DEPRECATED: Use normalized_qty instead. Kept for backward compatibility.';

COMMENT ON COLUMN stock_transaction_items.normalized_qty IS
  'Quantity in base package units. This is the source of truth for inventory calculations.';

COMMENT ON COLUMN stock_transaction_items.input_qty IS
  'Original quantity entered by user in selected package.';

COMMENT ON COLUMN stock_transaction_items.input_packaging_id IS
  'Package selected by user for input. References item_packaging.id.';

COMMENT ON COLUMN stock_transaction_items.conversion_factor IS
  'Conversion factor from input package to base package (qty_per_pack).';

COMMENT ON COLUMN stock_transaction_items.base_package_id IS
  'Base package used for normalization. References items.package_id at time of transaction.';

-- ============================================================================
-- TABLE: purchase_receipt_items - Add packaging_id for tracking
-- ============================================================================
ALTER TABLE purchase_receipt_items
ADD COLUMN IF NOT EXISTS packaging_id UUID REFERENCES item_packaging(id);

CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_packaging
ON purchase_receipt_items(packaging_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN purchase_receipt_items.packaging_id IS
  'Package used when receiving goods. Used for display purposes only - actual normalization happens in stock_transaction_items.';

-- ============================================================================
-- TABLE: stock_transfer_items - Add packaging_id for tracking
-- ============================================================================
ALTER TABLE stock_transfer_items
ADD COLUMN IF NOT EXISTS packaging_id UUID REFERENCES item_packaging(id);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_packaging
ON stock_transfer_items(packaging_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN stock_transfer_items.packaging_id IS
  'Package used for transfer. Used for display and driver confirmation.';
