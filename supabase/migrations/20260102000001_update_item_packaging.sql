-- Migration: Update item_packaging for package-first design
-- Version: 20260102000001
-- Description: Add item_id and uom_id to item_packaging, migrate from variants
-- Author: System
-- Date: 2026-01-02
-- Reference: inv-normalization-implementation-plan.md

-- ============================================================================
-- STEP 1: Add item_id column (migrate from variant_id)
-- ============================================================================

ALTER TABLE item_packaging
ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE CASCADE;

COMMENT ON COLUMN item_packaging.item_id IS
  'Item this package belongs to. Required.';

-- ============================================================================
-- STEP 2: Add uom_id to store unit of measure info
-- ============================================================================

ALTER TABLE item_packaging
ADD COLUMN IF NOT EXISTS uom_id UUID REFERENCES units_of_measure(id);

COMMENT ON COLUMN item_packaging.uom_id IS
  'Unit of measure for this package. For base package (qty_per_pack=1),
   this defines the base UOM for inventory storage.';

-- ============================================================================
-- STEP 3: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_item_packaging_item_id
ON item_packaging(item_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_packaging_uom_id
ON item_packaging(uom_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- STEP 4: Migrate existing data from variants (if any)
-- ============================================================================

-- Copy item_id from variant_id relationship
UPDATE item_packaging ip
SET item_id = iv.item_id
FROM item_variants iv
WHERE ip.variant_id = iv.id
  AND ip.item_id IS NULL
  AND ip.deleted_at IS NULL;

-- ============================================================================
-- STEP 5: Make item_id required
-- ============================================================================

-- Note: This will fail if there are item_packaging records without item_id
-- Run data migration script first if needed
ALTER TABLE item_packaging
ALTER COLUMN item_id SET NOT NULL;

-- ============================================================================
-- STEP 6: Make variant_id nullable (deprecate variants)
-- ============================================================================

ALTER TABLE item_packaging
ALTER COLUMN variant_id DROP NOT NULL;

COMMENT ON COLUMN item_packaging.variant_id IS
  'DEPRECATED: Variants removed from design. Use item_id instead.
   Kept for backward compatibility during transition.';

-- ============================================================================
-- STEP 7: Update unique constraint
-- ============================================================================

-- Drop old constraint if it exists
ALTER TABLE item_packaging
DROP CONSTRAINT IF EXISTS item_packaging_variant_pack_type_unique;

-- Add new constraint based on item_id
ALTER TABLE item_packaging
ADD CONSTRAINT item_packaging_item_pack_type_unique
UNIQUE (company_id, item_id, pack_type, deleted_at);

-- ============================================================================
-- Migration Complete: item_packaging updated for package-first design
-- ============================================================================
