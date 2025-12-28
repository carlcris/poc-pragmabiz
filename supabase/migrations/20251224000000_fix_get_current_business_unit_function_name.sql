-- ============================================================================
-- Migration: Fix get_current_business_unit function name
-- Purpose: Rename function to match what RLS policies expect
-- Date: 2025-12-24
-- ============================================================================

-- The RLS policies call get_current_business_unit_id() but the function
-- was created as get_current_business_unit(). Drop the incorrectly named
-- function and recreate it with the correct name.

-- Drop the incorrectly named function
DROP FUNCTION IF EXISTS get_current_business_unit();

-- Create the correctly named function
CREATE OR REPLACE FUNCTION get_current_business_unit_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN current_setting('app.current_business_unit_id', true)::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_current_business_unit_id() TO authenticated;

COMMENT ON FUNCTION get_current_business_unit_id() IS
  'Returns the current business unit ID from session context - used by RLS policies';
