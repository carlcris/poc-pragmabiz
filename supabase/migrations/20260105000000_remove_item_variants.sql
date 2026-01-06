-- Migration: Remove Item Variants System
-- Version: 20260105000000
-- Description: Remove item_variants, item_prices tables and variant_id columns from transaction tables
-- Author: System
-- Date: 2026-01-05
-- Reason: Replaced by direct item packaging system (inventory normalization)

-- ============================================================================
-- PHASE 1: Remove variant_id columns from transaction tables
-- ============================================================================

-- Stock transaction items
ALTER TABLE stock_transaction_items
DROP COLUMN IF EXISTS variant_id CASCADE;

COMMENT ON COLUMN stock_transaction_items.packaging_id IS 'Package used in this transaction (links directly to item_packaging.item_id)';

-- Purchase order items
ALTER TABLE purchase_order_items
DROP COLUMN IF EXISTS variant_id CASCADE;

COMMENT ON COLUMN purchase_order_items.packaging_id IS 'Package used in this purchase order';

-- Purchase receipt items
ALTER TABLE purchase_receipt_items
DROP COLUMN IF EXISTS variant_id CASCADE;

COMMENT ON COLUMN purchase_receipt_items.packaging_id IS 'Package used in this receipt';

-- Sales order items
ALTER TABLE sales_order_items
DROP COLUMN IF EXISTS variant_id CASCADE;

COMMENT ON COLUMN sales_order_items.packaging_id IS 'Package used in this sales order';

-- Sales invoice items
ALTER TABLE sales_invoice_items
DROP COLUMN IF EXISTS variant_id CASCADE;

COMMENT ON COLUMN sales_invoice_items.packaging_id IS 'Package used in this invoice';

-- POS transaction items
ALTER TABLE pos_transaction_items
DROP COLUMN IF EXISTS variant_id CASCADE;

COMMENT ON COLUMN pos_transaction_items.packaging_id IS 'Package used in this POS transaction';

-- Stock transfer items
ALTER TABLE stock_transfer_items
DROP COLUMN IF EXISTS variant_id CASCADE;

COMMENT ON COLUMN stock_transfer_items.packaging_id IS 'Package used in this transfer';

-- ============================================================================
-- PHASE 2: Update item_packaging to reference item_id instead of variant_id
-- ============================================================================
-- NOTE: This was already done in 20260102000001_update_item_packaging.sql
-- This section verifies the schema is correct

-- Verify item_packaging has item_id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'item_packaging'
          AND column_name = 'item_id'
    ) THEN
        RAISE EXCEPTION 'item_packaging.item_id column does not exist. Migration 20260102000001 may not have been applied.';
    END IF;

    RAISE NOTICE 'Verification: item_packaging.item_id exists ✓';
END $$;

-- Drop variant_id from item_packaging if it still exists
ALTER TABLE item_packaging
DROP COLUMN IF EXISTS variant_id CASCADE;

-- Verify unique constraint is on item_id not variant_id
DO $$
BEGIN
    -- Drop old variant-based constraint if exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'item_packaging_company_id_variant_id_pack_type_key'
    ) THEN
        ALTER TABLE item_packaging
        DROP CONSTRAINT item_packaging_company_id_variant_id_pack_type_key;
        RAISE NOTICE 'Dropped old variant-based unique constraint';
    END IF;

    -- Ensure new item-based constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'item_packaging_company_id_item_id_pack_type_key'
    ) THEN
        ALTER TABLE item_packaging
        ADD CONSTRAINT item_packaging_company_id_item_id_pack_type_key
        UNIQUE (company_id, item_id, pack_type);
        RAISE NOTICE 'Added item-based unique constraint';
    END IF;
END $$;

-- ============================================================================
-- PHASE 3: Drop item_prices table
-- ============================================================================
-- Prices are now stored directly in items table (purchase_price, cost_price, sales_price)

DROP TABLE IF EXISTS item_prices CASCADE;

-- ============================================================================
-- PHASE 4: Drop item_variants table
-- ============================================================================

DROP TABLE IF EXISTS item_variants CASCADE;

-- ============================================================================
-- PHASE 5: Drop indexes that reference dropped columns
-- ============================================================================

-- These will be automatically dropped by CASCADE, but we verify here

DO $$
DECLARE
    index_name TEXT;
    dropped_count INTEGER := 0;
BEGIN
    FOR index_name IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname LIKE '%variant%'
    LOOP
        EXECUTE 'DROP INDEX IF EXISTS ' || index_name || ' CASCADE';
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped index: %', index_name;
    END LOOP;

    RAISE NOTICE 'Total variant-related indexes dropped: %', dropped_count;
END $$;

-- ============================================================================
-- MIGRATION VERIFICATION
-- ============================================================================

DO $$
DECLARE
    variant_tables INTEGER;
    variant_columns INTEGER;
BEGIN
    -- Check for any remaining variant tables
    SELECT COUNT(*) INTO variant_tables
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE '%variant%';

    -- Check for any remaining variant_id columns
    SELECT COUNT(*) INTO variant_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'variant_id';

    RAISE NOTICE '============================================';
    RAISE NOTICE 'Migration Verification:';
    RAISE NOTICE '  - Remaining variant tables: %', variant_tables;
    RAISE NOTICE '  - Remaining variant_id columns: %', variant_columns;

    IF variant_tables > 0 OR variant_columns > 0 THEN
        RAISE WARNING 'Some variant-related objects still exist!';
    ELSE
        RAISE NOTICE '  ✓ All variant objects removed successfully';
    END IF;
    RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Item Variants Removal Complete!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  ✓ Removed variant_id from all transaction tables';
    RAISE NOTICE '  ✓ Removed variant_id from item_packaging';
    RAISE NOTICE '  ✓ Dropped item_prices table';
    RAISE NOTICE '  ✓ Dropped item_variants table';
    RAISE NOTICE '  ✓ Dropped all variant-related indexes';
    RAISE NOTICE '';
    RAISE NOTICE 'System now uses:';
    RAISE NOTICE '  - Direct item packaging (item_packaging.item_id)';
    RAISE NOTICE '  - Item prices in items table (purchase_price, cost_price, sales_price)';
    RAISE NOTICE '  - Package-based transactions (no variant layer)';
    RAISE NOTICE '============================================';
END $$;
