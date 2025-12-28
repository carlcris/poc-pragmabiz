-- ============================================================================
-- Migration: Business Unit Context Function
-- Purpose: Create function to set and validate business unit context
-- Date: 2025-12-21
-- Compliance: Strictly follows multi-business-unit-prd.md Phase 3
-- ============================================================================

-- ============================================================================
-- Function: set_business_unit_context
-- Purpose: Sets the business unit context for the current session after
--          verifying the user has access to the specified business unit
-- ============================================================================

-- Drop existing function if it exists (to allow return type change)
DROP FUNCTION IF EXISTS set_business_unit_context(UUID);

CREATE OR REPLACE FUNCTION set_business_unit_context(bu_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_has_access BOOLEAN;
  v_bu_name TEXT;
  v_bu_code TEXT;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();

  -- Check if user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user has access to this business unit
  SELECT EXISTS (
    SELECT 1
    FROM user_business_unit_access
    WHERE user_id = v_user_id
    AND business_unit_id = bu_id
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'User % does not have access to business unit %', v_user_id, bu_id;
  END IF;

  -- Get business unit details for confirmation
  SELECT name, code
  INTO v_bu_name, v_bu_code
  FROM business_units
  WHERE id = bu_id
  AND is_active = true;

  IF v_bu_name IS NULL THEN
    RAISE EXCEPTION 'Business unit % not found or inactive', bu_id;
  END IF;

  -- Set the context (transaction-level setting)
  PERFORM set_config('app.current_business_unit_id', bu_id::text, false);

  -- Return success with BU details
  RETURN jsonb_build_object(
    'success', true,
    'business_unit_id', bu_id,
    'business_unit_code', v_bu_code,
    'business_unit_name', v_bu_name,
    'user_id', v_user_id
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION set_business_unit_context(UUID) TO authenticated;

-- ============================================================================
-- Function: get_current_business_unit
-- Purpose: Returns the current business unit ID from session context
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_business_unit()
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
GRANT EXECUTE ON FUNCTION get_current_business_unit() TO authenticated;

-- ============================================================================
-- Function: get_user_business_units
-- Purpose: Returns all business units accessible by the current user
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_business_units()
RETURNS TABLE (
  id UUID,
  code VARCHAR(50),
  name VARCHAR(255),
  type VARCHAR(50),
  is_active BOOLEAN,
  role VARCHAR(50),
  is_default BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();

  -- Check if user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Return accessible business units
  RETURN QUERY
  SELECT
    bu.id,
    bu.code,
    bu.name,
    bu.type,
    bu.is_active,
    uba.role,
    uba.is_default
  FROM business_units bu
  INNER JOIN user_business_unit_access uba
    ON bu.id = uba.business_unit_id
  WHERE uba.user_id = v_user_id
    AND bu.is_active = true
  ORDER BY uba.is_default DESC, bu.name;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_business_units() TO authenticated;

-- Comments
COMMENT ON FUNCTION set_business_unit_context(UUID) IS
  'Sets the business unit context for the current session after verifying user access';

COMMENT ON FUNCTION get_current_business_unit() IS
  'Returns the current business unit ID from session context';

COMMENT ON FUNCTION get_user_business_units() IS
  'Returns all business units accessible by the current authenticated user';
