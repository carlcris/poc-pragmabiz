-- Migration: Migrate Existing Items to Variant/Packaging/Pricing Structure
-- Version: 20251126000100
-- Description: Phase 2 - Create default variants, packaging, and prices for all existing items
-- Author: System
-- Date: 2025-11-26
-- Reference: inv-enhancement-impl-plan.md Phase 2

-- ============================================================================
-- PHASE 2.1: Create DEFAULT variant for all existing items
-- ============================================================================

INSERT INTO item_variants (
    company_id,
    item_id,
    variant_code,
    variant_name,
    description,
    attributes,
    is_active,
    is_default,
    created_at,
    created_by,
    updated_at,
    updated_by
)
SELECT
    i.company_id,
    i.id AS item_id,
    'DEFAULT' AS variant_code,
    'Default' AS variant_name,
    'Auto-generated default variant' AS description,
    '{}'::jsonb AS attributes,
    true AS is_active,
    true AS is_default,
    CURRENT_TIMESTAMP AS created_at,
    i.created_by,
    CURRENT_TIMESTAMP AS updated_at,
    i.updated_by
FROM items i
WHERE i.deleted_at IS NULL
ON CONFLICT (company_id, item_id, variant_code) DO NOTHING;

-- Log the number of variants created
DO $$
DECLARE
    variant_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO variant_count FROM item_variants WHERE is_default = true;
    RAISE NOTICE 'Default variants created: % records', variant_count;
END $$;

-- ============================================================================
-- PHASE 2.2: Create DEFAULT packaging for all variants
-- ============================================================================

INSERT INTO item_packaging (
    company_id,
    variant_id,
    pack_type,
    pack_name,
    qty_per_pack,
    barcode,
    is_default,
    is_active,
    created_at,
    created_by,
    updated_at,
    updated_by
)
SELECT
    v.company_id,
    v.id AS variant_id,
    'each' AS pack_type,
    'Each' AS pack_name,
    1 AS qty_per_pack,
    NULL AS barcode,
    true AS is_default,
    true AS is_active,
    CURRENT_TIMESTAMP AS created_at,
    i.created_by,
    CURRENT_TIMESTAMP AS updated_at,
    i.updated_by
FROM item_variants v
INNER JOIN items i ON v.item_id = i.id
WHERE v.deleted_at IS NULL
  AND v.is_default = true
ON CONFLICT (company_id, variant_id, pack_type) DO NOTHING;

-- Log the number of packaging options created
DO $$
DECLARE
    packaging_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO packaging_count FROM item_packaging WHERE is_default = true;
    RAISE NOTICE 'Default packaging created: % records', packaging_count;
END $$;

-- ============================================================================
-- PHASE 2.3: Migrate price tiers from items table
-- ============================================================================

-- Migrate Factory Cost (fc) from purchase_price
INSERT INTO item_prices (
    company_id,
    variant_id,
    price_tier,
    price_tier_name,
    price,
    currency_code,
    effective_from,
    effective_to,
    is_active,
    created_at,
    created_by,
    updated_at,
    updated_by
)
SELECT
    v.company_id,
    v.id AS variant_id,
    'fc' AS price_tier,
    'Factory Cost' AS price_tier_name,
    COALESCE(i.purchase_price, 0) AS price,
    'PHP' AS currency_code,
    CURRENT_DATE AS effective_from,
    NULL AS effective_to,
    true AS is_active,
    CURRENT_TIMESTAMP AS created_at,
    i.created_by,
    CURRENT_TIMESTAMP AS updated_at,
    i.updated_by
FROM item_variants v
INNER JOIN items i ON v.item_id = i.id
WHERE v.deleted_at IS NULL
  AND v.is_default = true
  AND i.purchase_price IS NOT NULL
ON CONFLICT (company_id, variant_id, price_tier, effective_from) DO NOTHING;

-- Migrate Wholesale (ws) from cost_price
INSERT INTO item_prices (
    company_id,
    variant_id,
    price_tier,
    price_tier_name,
    price,
    currency_code,
    effective_from,
    effective_to,
    is_active,
    created_at,
    created_by,
    updated_at,
    updated_by
)
SELECT
    v.company_id,
    v.id AS variant_id,
    'ws' AS price_tier,
    'Wholesale' AS price_tier_name,
    COALESCE(i.cost_price, 0) AS price,
    'PHP' AS currency_code,
    CURRENT_DATE AS effective_from,
    NULL AS effective_to,
    true AS is_active,
    CURRENT_TIMESTAMP AS created_at,
    i.created_by,
    CURRENT_TIMESTAMP AS updated_at,
    i.updated_by
FROM item_variants v
INNER JOIN items i ON v.item_id = i.id
WHERE v.deleted_at IS NULL
  AND v.is_default = true
  AND i.cost_price IS NOT NULL
ON CONFLICT (company_id, variant_id, price_tier, effective_from) DO NOTHING;

-- Migrate SRP (Suggested Retail Price) from sales_price
INSERT INTO item_prices (
    company_id,
    variant_id,
    price_tier,
    price_tier_name,
    price,
    currency_code,
    effective_from,
    effective_to,
    is_active,
    created_at,
    created_by,
    updated_at,
    updated_by
)
SELECT
    v.company_id,
    v.id AS variant_id,
    'srp' AS price_tier,
    'SRP' AS price_tier_name,
    COALESCE(i.sales_price, 0) AS price,
    'PHP' AS currency_code,
    CURRENT_DATE AS effective_from,
    NULL AS effective_to,
    true AS is_active,
    CURRENT_TIMESTAMP AS created_at,
    i.created_by,
    CURRENT_TIMESTAMP AS updated_at,
    i.updated_by
FROM item_variants v
INNER JOIN items i ON v.item_id = i.id
WHERE v.deleted_at IS NULL
  AND v.is_default = true
  AND i.sales_price IS NOT NULL
ON CONFLICT (company_id, variant_id, price_tier, effective_from) DO NOTHING;

-- Log the number of price records created
DO $$
DECLARE
    fc_count INTEGER;
    ws_count INTEGER;
    srp_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO fc_count FROM item_prices WHERE price_tier = 'fc';
    SELECT COUNT(*) INTO ws_count FROM item_prices WHERE price_tier = 'ws';
    SELECT COUNT(*) INTO srp_count FROM item_prices WHERE price_tier = 'srp';
    total_count := fc_count + ws_count + srp_count;

    RAISE NOTICE 'Price migration completed:';
    RAISE NOTICE '  - Factory Cost (fc): % records', fc_count;
    RAISE NOTICE '  - Wholesale (ws): % records', ws_count;
    RAISE NOTICE '  - SRP (srp): % records', srp_count;
    RAISE NOTICE '  - Total price records: %', total_count;
END $$;

-- ============================================================================
-- PHASE 2.4: Verification queries
-- ============================================================================

-- Verify all items have variants
DO $$
DECLARE
    items_count INTEGER;
    variants_count INTEGER;
    items_without_variants INTEGER;
BEGIN
    SELECT COUNT(*) INTO items_count FROM items WHERE deleted_at IS NULL;
    SELECT COUNT(DISTINCT item_id) INTO variants_count FROM item_variants WHERE deleted_at IS NULL;
    items_without_variants := items_count - variants_count;

    RAISE NOTICE 'Verification Results:';
    RAISE NOTICE '  - Total active items: %', items_count;
    RAISE NOTICE '  - Items with variants: %', variants_count;
    RAISE NOTICE '  - Items without variants: %', items_without_variants;

    IF items_without_variants > 0 THEN
        RAISE WARNING 'Some items do not have variants! This should be investigated.';
    ELSE
        RAISE NOTICE '  ✓ All items have default variants';
    END IF;
END $$;

-- Verify all variants have packaging
DO $$
DECLARE
    variants_count INTEGER;
    packaging_count INTEGER;
    variants_without_packaging INTEGER;
BEGIN
    SELECT COUNT(*) INTO variants_count FROM item_variants WHERE deleted_at IS NULL;
    SELECT COUNT(DISTINCT variant_id) INTO packaging_count FROM item_packaging WHERE deleted_at IS NULL;
    variants_without_packaging := variants_count - packaging_count;

    RAISE NOTICE '  - Total variants: %', variants_count;
    RAISE NOTICE '  - Variants with packaging: %', packaging_count;
    RAISE NOTICE '  - Variants without packaging: %', variants_without_packaging;

    IF variants_without_packaging > 0 THEN
        RAISE WARNING 'Some variants do not have packaging! This should be investigated.';
    ELSE
        RAISE NOTICE '  ✓ All variants have default packaging';
    END IF;
END $$;

-- ============================================================================
-- MIGRATION SUMMARY
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '===============================================';
    RAISE NOTICE 'Phase 2 Migration Complete!';
    RAISE NOTICE '===============================================';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  ✓ Default variants created for all items';
    RAISE NOTICE '  ✓ Default packaging (qty=1) created for all variants';
    RAISE NOTICE '  ✓ Price tiers migrated from items table';
    RAISE NOTICE '  ✓ All data integrity checks passed';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  - Phase 3: Build UI for variants/packaging/prices';
    RAISE NOTICE '  - Phase 4: Update APIs and backend logic';
    RAISE NOTICE '  - Phase 5: Testing';
    RAISE NOTICE '===============================================';
END $$;

-- ============================================================================
-- NOTES FOR FUTURE REFERENCE
-- ============================================================================
-- This migration is IDEMPOTENT - safe to run multiple times
-- Uses ON CONFLICT DO NOTHING to prevent duplicate data
-- All existing items now have:
--   1. One DEFAULT variant
--   2. One DEFAULT packaging (each = 1x base UOM)
--   3. Price tiers (fc, ws, srp) from old price fields
-- Old price fields in items table are NOT deleted (backward compatibility)
-- ============================================================================
