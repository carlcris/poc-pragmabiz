-- Migration: Create helper function to get base package info
-- Version: 20260102000004
-- Description: Helper function for quick lookup of item's base package information
-- Author: System
-- Date: 2026-01-02
-- Reference: inv-normalization-implementation-plan.md

-- ============================================================================
-- Function: get_item_base_package
-- ============================================================================
-- Purpose: Quick lookup for item's base package information
-- Returns: Package details including UOM information
-- Usage: Avoid complex joins when you just need base package info

CREATE OR REPLACE FUNCTION get_item_base_package(p_item_id UUID)
RETURNS TABLE(
  package_id UUID,
  pack_name VARCHAR(200),
  pack_type VARCHAR(100),
  qty_per_pack DECIMAL(15,4),
  uom_id UUID,
  uom_name VARCHAR(100),
  uom_symbol VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ip.id AS package_id,
    ip.pack_name,
    ip.pack_type,
    ip.qty_per_pack,
    ip.uom_id,
    u.name AS uom_name,
    u.symbol AS uom_symbol
  FROM items i
  JOIN item_packaging ip ON i.package_id = ip.id
  LEFT JOIN units_of_measure u ON ip.uom_id = u.id
  WHERE i.id = p_item_id
    AND i.deleted_at IS NULL
    AND ip.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Add function comment with usage examples
-- ============================================================================

COMMENT ON FUNCTION get_item_base_package IS
  'Returns base package information for an item.
   Useful for quick lookups without joining multiple tables in application code.

   Parameters:
   - p_item_id: Item UUID

   Returns:
   - package_id: UUID of the base package
   - pack_name: Display name (e.g., "Kilogram", "Each")
   - pack_type: Type code (e.g., "base", "kg")
   - qty_per_pack: Always 1.0 for base packages
   - uom_id: Unit of measure UUID
   - uom_name: UOM display name (e.g., "Kilogram")
   - uom_symbol: UOM symbol (e.g., "kg")

   Example usage:
   SELECT * FROM get_item_base_package(''item-id''::UUID);

   Returns:
   package_id                            | pack_name  | pack_type | qty_per_pack | uom_id    | uom_name  | uom_symbol
   --------------------------------------|------------|-----------|--------------|-----------|-----------|------------
   abc123...                             | Kilogram   | base      | 1.0000       | xyz789... | Kilogram  | kg

   Use this function when:
   - You need to display base UOM in forms
   - You need to validate package conversions
   - You need base package info without complex joins
   - You need to show "stored as" information to users';

-- ============================================================================
-- Migration Complete: Helper function created
-- ============================================================================
