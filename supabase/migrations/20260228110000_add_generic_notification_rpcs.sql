-- ============================================================================
-- Migration: Add Generic Notification RPCs
-- Version: 20260228110000
-- Description: Adds reusable SECURITY DEFINER RPCs for notification fanout
--              and warehouse -> business unit lookup.
-- Date: 2026-02-28
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_warehouse_business_units(
  p_company_id UUID,
  p_warehouse_ids UUID[]
)
RETURNS TABLE (
  warehouse_id UUID,
  business_unit_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id = auth.uid()
      AND u.company_id = p_company_id
      AND u.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'User is not authorized for the specified company';
  END IF;

  RETURN QUERY
  SELECT
    w.id AS warehouse_id,
    w.business_unit_id
  FROM warehouses w
  WHERE w.company_id = p_company_id
    AND w.id = ANY(COALESCE(p_warehouse_ids, ARRAY[]::UUID[]))
    AND w.deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_users(
  p_company_id UUID,
  p_actor_user_id UUID,
  p_target_user_ids UUID[],
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Actor mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id = p_actor_user_id
      AND u.company_id = p_company_id
      AND u.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Actor is not authorized for the specified company';
  END IF;

  WITH target_users AS (
    SELECT DISTINCT u.id AS user_id
    FROM users u
    WHERE u.company_id = p_company_id
      AND u.id = ANY(COALESCE(p_target_user_ids, ARRAY[]::UUID[]))
      AND u.is_active = TRUE
      AND u.deleted_at IS NULL
  ), inserted AS (
    INSERT INTO notifications (
      company_id,
      user_id,
      title,
      message,
      type,
      metadata
    )
    SELECT
      p_company_id,
      tu.user_id,
      p_title,
      p_message,
      p_type,
      p_metadata
    FROM target_users tu
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted_count FROM inserted;

  RETURN v_inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_business_units(
  p_company_id UUID,
  p_actor_user_id UUID,
  p_target_business_unit_ids UUID[],
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_metadata JSONB DEFAULT NULL,
  p_exclude_user_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Actor mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id = p_actor_user_id
      AND u.company_id = p_company_id
      AND u.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Actor is not authorized for the specified company';
  END IF;

  WITH target_users AS (
    SELECT DISTINCT uba.user_id
    FROM user_business_unit_access uba
    JOIN users u
      ON u.id = uba.user_id
    WHERE uba.business_unit_id = ANY(COALESCE(p_target_business_unit_ids, ARRAY[]::UUID[]))
      AND u.company_id = p_company_id
      AND u.is_active = TRUE
      AND u.deleted_at IS NULL
      AND (
        p_exclude_user_ids IS NULL
        OR NOT (uba.user_id = ANY(p_exclude_user_ids))
      )
  ), inserted AS (
    INSERT INTO notifications (
      company_id,
      user_id,
      title,
      message,
      type,
      metadata
    )
    SELECT
      p_company_id,
      tu.user_id,
      p_title,
      p_message,
      p_type,
      p_metadata
    FROM target_users tu
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted_count FROM inserted;

  RETURN v_inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.get_warehouse_business_units(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_warehouse_business_units(UUID, UUID[]) TO authenticated;

REVOKE ALL ON FUNCTION public.notify_users(UUID, UUID, UUID[], TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_users(UUID, UUID, UUID[], TEXT, TEXT, TEXT, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.notify_business_units(UUID, UUID, UUID[], TEXT, TEXT, TEXT, JSONB, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_business_units(UUID, UUID, UUID[], TEXT, TEXT, TEXT, JSONB, UUID[]) TO authenticated;

COMMENT ON FUNCTION public.get_warehouse_business_units(UUID, UUID[]) IS
  'Resolves warehouse IDs to business units within a company context.';

COMMENT ON FUNCTION public.notify_users(UUID, UUID, UUID[], TEXT, TEXT, TEXT, JSONB) IS
  'Generic user-targeted notification insert for a company, with actor validation.';

COMMENT ON FUNCTION public.notify_business_units(UUID, UUID, UUID[], TEXT, TEXT, TEXT, JSONB, UUID[]) IS
  'Generic BU-targeted notification fanout with actor validation and optional excluded users.';

COMMIT;
