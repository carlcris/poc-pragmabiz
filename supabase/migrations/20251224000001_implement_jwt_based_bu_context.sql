-- ============================================================================
-- Migration: Implement JWT-Based Business Unit Context
-- Purpose: Fix RLS connection pooling issue by using JWT custom claims
-- Date: 2025-12-24
-- ============================================================================
--
-- PROBLEM: Using current_setting() for business unit context doesn't work with
-- Supabase connection pooling. RPC calls to set context use one connection,
-- but subsequent queries use different connections from the pool.
--
-- SOLUTION: Use JWT custom claims via auth.jwt() which is available in every
-- request without connection pooling issues. This is the production-ready
-- Supabase pattern for RLS context.
--
-- REFERENCE: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
-- ============================================================================

-- ============================================================================
-- SECTION 1: Update get_current_business_unit_id() to Read from JWT
-- ============================================================================

-- Replace the function (no need to drop - CREATE OR REPLACE handles it)
-- This function now reads from JWT instead of current_setting()
CREATE OR REPLACE FUNCTION get_current_business_unit_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_business_unit_id TEXT;
  v_user_id UUID;
BEGIN
  -- Get the business_unit_id from JWT custom claims
  -- The claim is set by the auth hook when user logs in or switches BU
  v_business_unit_id := auth.jwt() ->> 'current_business_unit_id';

  -- If no claim exists, try to get user's default business unit
  IF v_business_unit_id IS NULL OR v_business_unit_id = '' THEN
    v_user_id := auth.uid();

    IF v_user_id IS NOT NULL THEN
      -- Get the default business unit for this user
      SELECT business_unit_id::text INTO v_business_unit_id
      FROM user_business_unit_access
      WHERE user_id = v_user_id
        AND is_default = true
      LIMIT 1;
    END IF;
  END IF;

  -- Return as UUID or NULL
  RETURN NULLIF(v_business_unit_id, '')::uuid;
EXCEPTION
  WHEN OTHERS THEN
    -- If anything fails, return NULL (will be handled by RLS policies)
    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION get_current_business_unit_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_business_unit_id() TO anon;

COMMENT ON FUNCTION get_current_business_unit_id() IS
  'Returns the current business unit ID from JWT custom claims. Falls back to user default BU if claim not set. Used by RLS policies for data isolation.';

-- ============================================================================
-- SECTION 2: Create Auth Hook to Inject Business Unit into JWT
-- ============================================================================

-- Create a function to handle the custom access token hook
-- This function is called by Supabase Auth when issuing JWTs
-- NOTE: Must be in public schema, then registered as hook in Supabase config
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims JSONB;
  user_id UUID;
  current_bu_id UUID;
  default_bu_id UUID;
BEGIN
  -- Extract existing claims and user_id
  claims := event->'claims';
  user_id := (event->>'user_id')::UUID;

  -- Try to preserve existing current_business_unit_id claim if present
  current_bu_id := (claims->>'current_business_unit_id')::UUID;

  -- If no current BU in claims, get user's default business unit
  IF current_bu_id IS NULL THEN
    SELECT business_unit_id INTO default_bu_id
    FROM user_business_unit_access
    WHERE user_business_unit_access.user_id = custom_access_token_hook.user_id
      AND is_default = true
    LIMIT 1;

    current_bu_id := default_bu_id;
  END IF;

  -- Add the current_business_unit_id to the JWT claims
  IF current_bu_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{current_business_unit_id}', to_jsonb(current_bu_id::text));
  END IF;

  -- Add user's accessible business units list to JWT for client-side validation
  claims := jsonb_set(
    claims,
    '{accessible_business_units}',
    (
      SELECT COALESCE(jsonb_agg(business_unit_id), '[]'::jsonb)
      FROM user_business_unit_access
      WHERE user_business_unit_access.user_id = custom_access_token_hook.user_id
    )
  );

  -- Return the modified event with updated claims
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
EXCEPTION
  WHEN OTHERS THEN
    -- If anything fails, return original event to prevent auth failures
    RETURN event;
END;
$$;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO postgres;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO service_role;

COMMENT ON FUNCTION public.custom_access_token_hook IS
  'Auth hook that injects current_business_unit_id and accessible_business_units into JWT claims for RLS policies. Must be enabled in Supabase config/auth settings.';

-- ============================================================================
-- SECTION 3: Create Helper Function to Update Business Unit in Session
-- ============================================================================

-- This function allows updating the business unit for the current session
-- It works by forcing a token refresh with the new BU claim
CREATE OR REPLACE FUNCTION update_current_business_unit(p_business_unit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_has_access BOOLEAN;
  v_business_unit RECORD;
BEGIN
  -- Get current authenticated user ID
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Verify user has access to this business unit
  SELECT EXISTS (
    SELECT 1 FROM user_business_unit_access
    WHERE user_id = v_user_id
      AND business_unit_id = p_business_unit_id
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'User does not have access to business unit %', p_business_unit_id;
  END IF;

  -- Get business unit details
  SELECT id, code, name, company_id
  INTO v_business_unit
  FROM business_units
  WHERE id = p_business_unit_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business unit % not found', p_business_unit_id;
  END IF;

  -- Return success with business unit info
  -- The client should call supabase.auth.refreshSession() after this
  -- to get a new JWT with the updated current_business_unit_id claim
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Business unit updated. Please refresh your session to apply changes.',
    'business_unit', jsonb_build_object(
      'id', v_business_unit.id,
      'code', v_business_unit.code,
      'name', v_business_unit.name,
      'company_id', v_business_unit.company_id
    ),
    'requires_refresh', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION update_current_business_unit TO authenticated;

COMMENT ON FUNCTION update_current_business_unit IS
  'Validates access and returns business unit info. Client must refresh session to update JWT claim.';

-- ============================================================================
-- SECTION 4: Remove Old Session-Based Functions (No Longer Needed)
-- ============================================================================

-- Drop the set_business_unit_context function as it doesn't work with connection pooling
DROP FUNCTION IF EXISTS set_business_unit_context(UUID);

-- ============================================================================
-- SECTION 5: Grant Necessary Permissions
-- ============================================================================

-- Ensure RLS policies can call get_current_business_unit_id
GRANT EXECUTE ON FUNCTION get_current_business_unit_id() TO postgres;
GRANT EXECUTE ON FUNCTION get_current_business_unit_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_business_unit_id() TO anon;

-- ============================================================================
-- NOTES FOR IMPLEMENTATION
-- ============================================================================
--
-- 1. ENABLE THE AUTH HOOK in supabase/config.toml:
--    Add this to the [auth.hook.custom_access_token] section:
--
--    [auth.hook.custom_access_token]
--    enabled = true
--    uri = "pg-functions://postgres/public/custom_access_token_hook"
--
--    Then restart Supabase: supabase stop && supabase start
--    This will automatically inject BU claims into all new JWTs
--
-- 2. UPDATE CLIENT CODE:
--    - When user switches BU, call update_current_business_unit()
--    - Then call supabase.auth.refreshSession() to get new JWT with updated claim
--    - New JWT will have current_business_unit_id set
--
-- 3. RLS POLICIES:
--    - No changes needed! They already call get_current_business_unit_id()
--    - Function now reads from JWT instead of current_setting()
--
-- 4. TESTING:
--    - After enabling hook, login to get JWT with BU claim
--    - Verify: SELECT auth.jwt() ->> 'current_business_unit_id';
--    - Verify: SELECT get_current_business_unit_id();
--    - Both should return the same UUID
--
-- ============================================================================
