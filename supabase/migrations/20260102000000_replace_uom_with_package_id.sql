-- Migration: Replace items.uom_id with items.package_id
-- Version: 20260102000000
-- Description: Enforce that base storage unit is always a valid package. Adds package_id and setup_complete columns.
-- Author: System
-- Date: 2026-01-02
-- Reference: inv-normalization-implementation-plan.md

-- ============================================================================
-- STEP 1: Add new package_id column (nullable during migration)
-- ============================================================================

ALTER TABLE items
ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES item_packaging(id);

COMMENT ON COLUMN items.package_id IS
  'Base storage package - defines how inventory is stored in item_warehouse.current_stock.
   Must reference item_packaging with qty_per_pack=1.0. This package is also the default
   for transactions. Required when setup_complete=TRUE.';

-- ============================================================================
-- STEP 2: Add setup status tracking
-- ============================================================================

ALTER TABLE items
ADD COLUMN IF NOT EXISTS setup_complete BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN items.setup_complete IS
  'Indicates if item has completed setup with base package. Items with FALSE cannot be
   used in transactions. Set to TRUE after package_id is configured.';

-- ============================================================================
-- STEP 3: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_items_package_id
ON items(package_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_items_setup_complete
ON items(setup_complete) WHERE setup_complete = FALSE;

-- ============================================================================
-- STEP 4: Add constraint - package_id required when setup_complete
-- ============================================================================

ALTER TABLE items
ADD CONSTRAINT items_package_id_required_when_complete
CHECK (
  (setup_complete = FALSE AND package_id IS NULL) OR
  (setup_complete = TRUE AND package_id IS NOT NULL)
);

-- ============================================================================
-- STEP 5: Add validation trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_item_package_belongs_to_item()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip if package_id is NULL (incomplete setup)
  IF NEW.package_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Validate package belongs to this item
  IF NOT EXISTS (
    SELECT 1 FROM item_packaging
    WHERE id = NEW.package_id
      AND item_id = NEW.id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'package_id must reference a valid package for this item';
  END IF;

  -- Validate base package has qty_per_pack = 1
  IF NOT EXISTS (
    SELECT 1 FROM item_packaging
    WHERE id = NEW.package_id
      AND qty_per_pack = 1.0
  ) THEN
    RAISE EXCEPTION 'Base package must have qty_per_pack = 1.0';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_item_package
BEFORE INSERT OR UPDATE ON items
FOR EACH ROW
EXECUTE FUNCTION validate_item_package_belongs_to_item();

-- ============================================================================
-- STEP 6: Prevent transactions on incomplete items
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_item_ready_for_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_item_complete BOOLEAN;
BEGIN
  -- Check if item is ready for transactions
  SELECT setup_complete INTO v_item_complete
  FROM items
  WHERE id = NEW.item_id
    AND deleted_at IS NULL;

  IF v_item_complete IS NULL THEN
    RAISE EXCEPTION 'Item not found: %', NEW.item_id;
  END IF;

  IF v_item_complete = FALSE THEN
    RAISE EXCEPTION 'Item is not fully configured. Please complete package setup before creating transactions.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all transaction tables
CREATE TRIGGER trigger_stock_tx_items_validate_item
BEFORE INSERT ON stock_transaction_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

CREATE TRIGGER trigger_po_items_validate_item
BEFORE INSERT ON purchase_order_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

CREATE TRIGGER trigger_pr_items_validate_item
BEFORE INSERT ON purchase_receipt_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

CREATE TRIGGER trigger_so_items_validate_item
BEFORE INSERT ON sales_order_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

CREATE TRIGGER trigger_si_items_validate_item
BEFORE INSERT ON sales_invoice_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

CREATE TRIGGER trigger_pos_items_validate_item
BEFORE INSERT ON pos_transaction_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

CREATE TRIGGER trigger_transfer_items_validate_item
BEFORE INSERT ON stock_transfer_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

-- ============================================================================
-- STEP 7: Mark old uom_id as deprecated (keep for reference during transition)
-- ============================================================================

COMMENT ON COLUMN items.uom_id IS
  'DEPRECATED: Replaced by package_id. Use items.package_id → item_packaging.uom_id instead.
   Will be removed in future version after migration complete.';

-- ============================================================================
-- Migration Complete: items.package_id schema ready
-- ============================================================================
