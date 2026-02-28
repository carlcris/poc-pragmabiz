-- ============================================================================
-- Migration: Scope Notifications by Business Unit
-- Version: 20260228130000
-- Description:
--   1) Adds notifications.business_unit_id (nullable for global notifications).
--   2) Enforces BU-aware read visibility (current BU + global NULL).
--   3) Updates generic notification RPCs to stamp owner BU per notification row.
-- Date: 2026-02-28
-- ============================================================================

BEGIN;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS business_unit_id UUID REFERENCES public.business_units(id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_bu_created
  ON public.notifications(user_id, business_unit_id, created_at DESC);

DROP POLICY IF EXISTS notifications_company_select ON public.notifications;
CREATE POLICY notifications_company_select ON public.notifications
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND (
      business_unit_id IS NULL
      OR business_unit_id = get_current_business_unit_id()
    )
  );

DROP POLICY IF EXISTS notifications_company_insert ON public.notifications;
CREATE POLICY notifications_company_insert ON public.notifications
  FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND user_id IN (
      SELECT id
      FROM public.users
      WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
        AND deleted_at IS NULL
    )
    AND (
      business_unit_id IS NULL
      OR business_unit_id IN (
        SELECT bu.id
        FROM public.business_units bu
        WHERE bu.company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
      )
    )
  );

CREATE OR REPLACE FUNCTION public.notify_users(
  p_company_id UUID,
  p_actor_user_id UUID,
  p_target_user_ids UUID[],
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_metadata JSONB DEFAULT NULL,
  p_business_unit_id UUID DEFAULT NULL
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

  IF p_business_unit_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM business_units bu
       WHERE bu.id = p_business_unit_id
         AND bu.company_id = p_company_id
     ) THEN
    RAISE EXCEPTION 'Notification business unit is not authorized for the specified company';
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
      business_unit_id,
      user_id,
      title,
      message,
      type,
      metadata
    )
    SELECT
      p_company_id,
      p_business_unit_id,
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
    SELECT DISTINCT
      uba.user_id,
      uba.business_unit_id
    FROM user_business_unit_access uba
    JOIN users u
      ON u.id = uba.user_id
    JOIN business_units bu
      ON bu.id = uba.business_unit_id
    WHERE uba.business_unit_id = ANY(COALESCE(p_target_business_unit_ids, ARRAY[]::UUID[]))
      AND bu.company_id = p_company_id
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
      business_unit_id,
      user_id,
      title,
      message,
      type,
      metadata
    )
    SELECT
      p_company_id,
      tu.business_unit_id,
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

REVOKE ALL ON FUNCTION public.notify_users(UUID, UUID, UUID[], TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_users(UUID, UUID, UUID[], TEXT, TEXT, TEXT, JSONB, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.notify_business_units(UUID, UUID, UUID[], TEXT, TEXT, TEXT, JSONB, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_business_units(UUID, UUID, UUID[], TEXT, TEXT, TEXT, JSONB, UUID[]) TO authenticated;

COMMENT ON FUNCTION public.notify_users(UUID, UUID, UUID[], TEXT, TEXT, TEXT, JSONB, UUID) IS
  'Generic user-targeted notification insert for a company, with optional owner BU (NULL for global/all BU).';

COMMENT ON FUNCTION public.notify_business_units(UUID, UUID, UUID[], TEXT, TEXT, TEXT, JSONB, UUID[]) IS
  'Generic BU-targeted notification fanout. Each inserted row is stamped with its owner business_unit_id.';

COMMIT;
