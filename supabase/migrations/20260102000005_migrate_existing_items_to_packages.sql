-- Migration: Migrate existing items to package-based design
-- Version: 20260102000005
-- Description: Create base packages for all existing items and link them
-- Author: System
-- Date: 2026-01-02
-- Reference: inv-normalization-implementation-plan.md

-- ============================================================================
-- DATA MIGRATION: Create base packages for existing items
-- ============================================================================

DO $$
DECLARE
  item_record RECORD;
  base_package_id UUID;
  uom_name TEXT;
  uom_symbol TEXT;
  items_migrated INTEGER := 0;
  items_skipped INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting migration of existing items to package-based design...';
  RAISE NOTICE '============================================================';

  -- Loop through all items that don't have packages yet
  FOR item_record IN
    SELECT
      i.id,
      i.company_id,
      i.uom_id,
      i.item_code,
      i.item_name,
      i.created_by
    FROM items i
    WHERE i.deleted_at IS NULL
      AND i.setup_complete = FALSE  -- Items not yet configured
      AND i.package_id IS NULL       -- No package assigned yet
    ORDER BY i.created_at
  LOOP
    BEGIN
      -- Get UOM details for package naming
      SELECT u.name, u.symbol
      INTO uom_name, uom_symbol
      FROM units_of_measure u
      WHERE u.id = item_record.uom_id;

      -- Create base package for this item
      INSERT INTO item_packaging (
        company_id,
        item_id,
        pack_type,
        pack_name,
        qty_per_pack,
        uom_id,
        is_default,
        is_active,
        created_by,
        updated_by,
        created_at,
        updated_at
      ) VALUES (
        item_record.company_id,
        item_record.id,
        'base',
        COALESCE(uom_name, 'Each'),  -- Use UOM name or fallback to 'Each'
        1.0,                          -- Base package always = 1
        item_record.uom_id,
        TRUE,                         -- Is default package
        TRUE,                         -- Is active
        COALESCE(item_record.created_by, '00000000-0000-0000-0000-000000000000'::UUID),
        COALESCE(item_record.created_by, '00000000-0000-0000-0000-000000000000'::UUID),
        NOW(),
        NOW()
      )
      RETURNING id INTO base_package_id;

      -- Update item with base package reference
      UPDATE items
      SET package_id = base_package_id,
          setup_complete = TRUE,
          updated_by = COALESCE(item_record.created_by, '00000000-0000-0000-0000-000000000000'::UUID),
          updated_at = NOW()
      WHERE id = item_record.id;

      items_migrated := items_migrated + 1;

      -- Log progress every 100 items
      IF items_migrated % 100 = 0 THEN
        RAISE NOTICE 'Migrated % items...', items_migrated;
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but continue with next item
        RAISE WARNING 'Failed to migrate item % (%): %',
          item_record.item_code,
          item_record.id,
          SQLERRM;
        items_skipped := items_skipped + 1;
    END;
  END LOOP;

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Migration complete!';
  RAISE NOTICE 'Items migrated: %', items_migrated;
  RAISE NOTICE 'Items skipped (errors): %', items_skipped;
  RAISE NOTICE '============================================================';

  -- Verify no incomplete items remain
  DECLARE
    incomplete_count INTEGER;
  BEGIN
    SELECT COUNT(*)
    INTO incomplete_count
    FROM items
    WHERE deleted_at IS NULL
      AND setup_complete = FALSE;

    IF incomplete_count > 0 THEN
      RAISE WARNING 'WARNING: % items still have setup_complete=FALSE', incomplete_count;
      RAISE WARNING 'Run the following query to investigate:';
      RAISE WARNING 'SELECT id, item_code, item_name FROM items WHERE setup_complete = FALSE AND deleted_at IS NULL;';
    ELSE
      RAISE NOTICE 'SUCCESS: All items have been migrated successfully!';
    END IF;
  END;

END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Query 1: Check migration status
DO $$
DECLARE
  total_items INTEGER;
  completed_items INTEGER;
  incomplete_items INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_items
  FROM items
  WHERE deleted_at IS NULL;

  SELECT COUNT(*) INTO completed_items
  FROM items
  WHERE deleted_at IS NULL
    AND setup_complete = TRUE
    AND package_id IS NOT NULL;

  SELECT COUNT(*) INTO incomplete_items
  FROM items
  WHERE deleted_at IS NULL
    AND setup_complete = FALSE;

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'MIGRATION VERIFICATION';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Total items: %', total_items;
  RAISE NOTICE 'Completed items (with packages): %', completed_items;
  RAISE NOTICE 'Incomplete items (no packages): %', incomplete_items;
  RAISE NOTICE '';

  IF incomplete_items = 0 AND total_items = completed_items THEN
    RAISE NOTICE 'STATUS: ✓ All items successfully migrated!';
  ELSE
    RAISE WARNING 'STATUS: ✗ Migration incomplete - please investigate';
  END IF;
  RAISE NOTICE '============================================================';
END $$;

-- ============================================================================
-- Migration Complete: Existing items migrated to package-based design
-- ============================================================================
