-- Migration: Create atomic item creation function
-- Version: 20260102000003
-- Description: Function to atomically create item with base package and optional additional packages
-- Author: System
-- Date: 2026-01-02
-- Reference: inv-normalization-implementation-plan.md

-- ============================================================================
-- Function: create_item_with_packages
-- ============================================================================
-- Purpose: Atomically create item with base package (and optional additional packages)
-- Solves: Chicken-egg problem of foreign key dependencies between items and item_packaging
--
-- This function:
-- 1. Creates item with package_id=NULL, setup_complete=FALSE
-- 2. Creates base package (qty_per_pack=1.0)
-- 3. Creates additional packages (if provided)
-- 4. Links base package to item and sets setup_complete=TRUE
-- All in one atomic transaction

CREATE OR REPLACE FUNCTION create_item_with_packages(
  p_company_id UUID,
  p_user_id UUID,
  p_item_code VARCHAR(100),
  p_item_name VARCHAR(255),
  p_item_description TEXT DEFAULT NULL,
  p_item_type VARCHAR(50) DEFAULT 'finished_good',
  p_base_package_name VARCHAR(200) DEFAULT 'Each',
  p_base_package_type VARCHAR(100) DEFAULT 'base',
  p_base_uom_id UUID DEFAULT NULL,
  p_standard_cost DECIMAL(20,4) DEFAULT 0,
  p_list_price DECIMAL(20,4) DEFAULT 0,
  p_additional_packages JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE(
  item_id UUID,
  base_package_id UUID,
  message TEXT
) AS $$
DECLARE
  v_item_id UUID;
  v_base_package_id UUID;
  v_package JSONB;
  v_new_package_id UUID;
  v_package_count INTEGER;
BEGIN
  -- Validate inputs
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF p_item_code IS NULL OR p_item_code = '' THEN
    RAISE EXCEPTION 'item_code is required';
  END IF;

  IF p_item_name IS NULL OR p_item_name = '' THEN
    RAISE EXCEPTION 'item_name is required';
  END IF;

  -- Step 1: Create item (package_id NULL, setup_complete FALSE)
  INSERT INTO items (
    company_id,
    item_code,
    item_name,
    description,
    item_type,
    standard_cost,
    list_price,
    package_id,
    setup_complete,
    created_by,
    updated_by
  ) VALUES (
    p_company_id,
    p_item_code,
    p_item_name,
    p_item_description,
    p_item_type,
    p_standard_cost,
    p_list_price,
    NULL,        -- Will be set after creating package
    FALSE,       -- Not ready for transactions yet
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_item_id;

  -- Step 2: Create base package (qty_per_pack = 1.0)
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
    updated_by
  ) VALUES (
    p_company_id,
    v_item_id,
    p_base_package_type,
    p_base_package_name,
    1.0,                    -- Base package always = 1
    p_base_uom_id,
    TRUE,                   -- Is default
    TRUE,                   -- Is active
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_base_package_id;

  v_package_count := 1;  -- Start with base package

  -- Step 3: Create additional packages (if provided)
  IF jsonb_array_length(p_additional_packages) > 0 THEN
    FOR v_package IN SELECT * FROM jsonb_array_elements(p_additional_packages)
    LOOP
      -- Validate required fields
      IF v_package->>'pack_type' IS NULL OR v_package->>'pack_type' = '' THEN
        RAISE EXCEPTION 'pack_type is required for additional packages';
      END IF;

      IF v_package->>'pack_name' IS NULL OR v_package->>'pack_name' = '' THEN
        RAISE EXCEPTION 'pack_name is required for additional packages';
      END IF;

      IF v_package->>'qty_per_pack' IS NULL THEN
        RAISE EXCEPTION 'qty_per_pack is required for additional packages';
      END IF;

      INSERT INTO item_packaging (
        company_id,
        item_id,
        pack_type,
        pack_name,
        qty_per_pack,
        uom_id,
        barcode,
        is_default,
        is_active,
        created_by,
        updated_by
      ) VALUES (
        p_company_id,
        v_item_id,
        (v_package->>'pack_type')::VARCHAR,
        (v_package->>'pack_name')::VARCHAR,
        (v_package->>'qty_per_pack')::DECIMAL,
        COALESCE((v_package->>'uom_id')::UUID, p_base_uom_id),
        (v_package->>'barcode')::VARCHAR,
        FALSE,                   -- Not default (base package is default)
        COALESCE((v_package->>'is_active')::BOOLEAN, TRUE),
        p_user_id,
        p_user_id
      )
      RETURNING id INTO v_new_package_id;

      v_package_count := v_package_count + 1;
    END LOOP;
  END IF;

  -- Step 4: Link base package to item and mark setup complete
  UPDATE items
  SET package_id = v_base_package_id,
      setup_complete = TRUE,
      updated_by = p_user_id,
      updated_at = NOW()
  WHERE id = v_item_id;

  -- Step 5: Return results
  RETURN QUERY
  SELECT
    v_item_id,
    v_base_package_id,
    'Item created successfully with ' || v_package_count::TEXT || ' package(s)' AS message;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Add function comment with usage examples
-- ============================================================================

COMMENT ON FUNCTION create_item_with_packages IS
  'Atomically creates an item with base package (qty_per_pack=1) and optional additional packages.
   Handles foreign key dependencies correctly by creating item first (incomplete), then packages,
   then linking them. Base package becomes the default for transactions.

   Parameters:
   - p_company_id: Company UUID (required)
   - p_user_id: User creating the item (required)
   - p_item_code: Unique item code (required)
   - p_item_name: Item name (required)
   - p_item_description: Optional description
   - p_item_type: Item type (default: finished_good)
   - p_base_package_name: Name for base package (default: Each)
   - p_base_package_type: Type code for base package (default: base)
   - p_base_uom_id: UOM for base package (optional)
   - p_standard_cost: Standard cost (default: 0)
   - p_list_price: List price (default: 0)
   - p_additional_packages: JSONB array of additional packages (optional)

   Additional packages JSON format:
   {
     "pack_type": "bag",
     "pack_name": "Bag (5kg)",
     "qty_per_pack": 5.0,
     "uom_id": "uuid-optional",
     "barcode": "1234567890123",
     "is_active": true
   }

   Example 1 - Simple item with base package only:
   SELECT * FROM create_item_with_packages(
     ''company-id''::UUID,
     ''user-id''::UUID,
     ''FLOUR-001'',
     ''Premium Flour'',
     ''High-quality wheat flour'',
     ''raw_material'',
     ''Kilogram'',
     ''base'',
     ''uom-kg-id''::UUID,
     100.00,
     150.00,
     NULL
   );

   Example 2 - Item with multiple packages:
   SELECT * FROM create_item_with_packages(
     ''company-id''::UUID,
     ''user-id''::UUID,
     ''FLOUR-001'',
     ''Premium Flour'',
     NULL,
     ''finished_good'',
     ''Kilogram'',
     ''base'',
     ''uom-kg-id''::UUID,
     100.00,
     150.00,
     ''[
       {"pack_type": "bag", "pack_name": "Bag (5kg)", "qty_per_pack": 5.0},
       {"pack_type": "carton", "pack_name": "Carton (25kg)", "qty_per_pack": 25.0}
     ]''::JSONB
   );';

-- ============================================================================
-- Migration Complete: Atomic item creation function created
-- ============================================================================
