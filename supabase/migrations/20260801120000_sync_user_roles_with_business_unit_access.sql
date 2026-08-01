CREATE OR REPLACE FUNCTION public.assign_user_role_to_business_unit(
  p_actor_user_id UUID,
  p_company_id UUID,
  p_target_user_id UUID,
  p_role_id UUID,
  p_business_unit_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment_id UUID;
  v_role_name TEXT;
  v_access_role TEXT;
  v_is_first_access BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_user_id THEN
    RAISE EXCEPTION 'USER_ROLE_UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users actor
    WHERE actor.id = p_actor_user_id
      AND actor.company_id = p_company_id
      AND actor.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'USER_ROLE_FORBIDDEN';
  END IF;

  PERFORM target.id
  FROM public.users target
  WHERE target.id = p_target_user_id
    AND target.company_id = p_company_id
    AND target.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_ROLE_TARGET_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.business_units business_unit
    WHERE business_unit.id = p_business_unit_id
      AND business_unit.company_id = p_company_id
      AND business_unit.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'USER_ROLE_BUSINESS_UNIT_NOT_FOUND';
  END IF;

  SELECT role.name
  INTO v_role_name
  FROM public.roles role
  WHERE role.id = p_role_id
    AND role.company_id = p_company_id
    AND role.deleted_at IS NULL;

  IF v_role_name IS NULL THEN
    RAISE EXCEPTION 'USER_ROLE_ROLE_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_business_unit_access actor_access
    WHERE actor_access.user_id = p_actor_user_id
      AND actor_access.business_unit_id = p_business_unit_id
  ) OR NOT public.user_has_permission(
    p_actor_user_id,
    'users',
    'edit',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'USER_ROLE_FORBIDDEN';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles assignment
    WHERE assignment.user_id = p_target_user_id
      AND assignment.role_id = p_role_id
      AND assignment.business_unit_id = p_business_unit_id
      AND assignment.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'USER_ROLE_ALREADY_ASSIGNED';
  END IF;

  SELECT CASE
    WHEN bool_or(lower(btrim(assigned_roles.name)) IN ('admin', 'super admin')) THEN 'admin'
    WHEN bool_or(lower(btrim(assigned_roles.name)) LIKE '%manager%') THEN 'manager'
    ELSE 'staff'
  END
  INTO v_access_role
  FROM (
    SELECT role.name
    FROM public.user_roles assignment
    JOIN public.roles role
      ON role.id = assignment.role_id
     AND role.deleted_at IS NULL
    WHERE assignment.user_id = p_target_user_id
      AND assignment.business_unit_id = p_business_unit_id
      AND assignment.deleted_at IS NULL

    UNION ALL

    SELECT v_role_name
  ) assigned_roles;

  SELECT NOT EXISTS (
    SELECT 1
    FROM public.user_business_unit_access target_access
    WHERE target_access.user_id = p_target_user_id
  )
  INTO v_is_first_access;

  INSERT INTO public.user_business_unit_access (
    user_id,
    business_unit_id,
    role,
    is_default,
    is_current,
    granted_at,
    granted_by
  )
  VALUES (
    p_target_user_id,
    p_business_unit_id,
    v_access_role,
    v_is_first_access,
    v_is_first_access,
    now(),
    p_actor_user_id
  )
  ON CONFLICT (user_id, business_unit_id) DO UPDATE SET
    role = EXCLUDED.role;

  INSERT INTO public.user_roles (
    user_id,
    role_id,
    business_unit_id,
    created_by,
    updated_by,
    deleted_at
  )
  VALUES (
    p_target_user_id,
    p_role_id,
    p_business_unit_id,
    p_actor_user_id,
    p_actor_user_id,
    NULL
  )
  ON CONFLICT (user_id, role_id, business_unit_id) DO UPDATE SET
    deleted_at = NULL,
    updated_at = now(),
    updated_by = EXCLUDED.updated_by
  RETURNING id INTO v_assignment_id;

  RETURN v_assignment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_user_role_from_business_unit(
  p_actor_user_id UUID,
  p_company_id UUID,
  p_target_user_id UUID,
  p_role_id UUID,
  p_business_unit_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment_id UUID;
  v_remaining_role_count INTEGER;
  v_access_role TEXT;
  v_removed_is_default BOOLEAN := FALSE;
  v_removed_is_current BOOLEAN := FALSE;
  v_replacement_business_unit_id UUID;
  v_is_first_access BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_user_id THEN
    RAISE EXCEPTION 'USER_ROLE_UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users actor
    WHERE actor.id = p_actor_user_id
      AND actor.company_id = p_company_id
      AND actor.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'USER_ROLE_FORBIDDEN';
  END IF;

  PERFORM target.id
  FROM public.users target
  WHERE target.id = p_target_user_id
    AND target.company_id = p_company_id
    AND target.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_ROLE_TARGET_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.business_units business_unit
    WHERE business_unit.id = p_business_unit_id
      AND business_unit.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'USER_ROLE_BUSINESS_UNIT_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.roles role
    WHERE role.id = p_role_id
      AND role.company_id = p_company_id
      AND role.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'USER_ROLE_ROLE_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_business_unit_access actor_access
    WHERE actor_access.user_id = p_actor_user_id
      AND actor_access.business_unit_id = p_business_unit_id
  ) OR NOT public.user_has_permission(
    p_actor_user_id,
    'users',
    'edit',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'USER_ROLE_FORBIDDEN';
  END IF;

  SELECT assignment.id
  INTO v_assignment_id
  FROM public.user_roles assignment
  WHERE assignment.user_id = p_target_user_id
    AND assignment.role_id = p_role_id
    AND assignment.business_unit_id = p_business_unit_id
    AND assignment.deleted_at IS NULL
  FOR UPDATE;

  IF v_assignment_id IS NULL THEN
    RAISE EXCEPTION 'USER_ROLE_NOT_ASSIGNED';
  END IF;

  DELETE FROM public.user_roles
  WHERE id = v_assignment_id;

  SELECT count(*)
  INTO v_remaining_role_count
  FROM public.user_roles assignment
  WHERE assignment.user_id = p_target_user_id
    AND assignment.business_unit_id = p_business_unit_id
    AND assignment.deleted_at IS NULL;

  IF v_remaining_role_count > 0 THEN
    SELECT CASE
      WHEN bool_or(lower(btrim(role.name)) IN ('admin', 'super admin')) THEN 'admin'
      WHEN bool_or(lower(btrim(role.name)) LIKE '%manager%') THEN 'manager'
      ELSE 'staff'
    END
    INTO v_access_role
    FROM public.user_roles assignment
    JOIN public.roles role
      ON role.id = assignment.role_id
     AND role.deleted_at IS NULL
    WHERE assignment.user_id = p_target_user_id
      AND assignment.business_unit_id = p_business_unit_id
      AND assignment.deleted_at IS NULL;

    SELECT NOT EXISTS (
      SELECT 1
      FROM public.user_business_unit_access target_access
      WHERE target_access.user_id = p_target_user_id
    )
    INTO v_is_first_access;

    INSERT INTO public.user_business_unit_access (
      user_id,
      business_unit_id,
      role,
      is_default,
      is_current,
      granted_at,
      granted_by
    )
    VALUES (
      p_target_user_id,
      p_business_unit_id,
      v_access_role,
      v_is_first_access,
      v_is_first_access,
      now(),
      p_actor_user_id
    )
    ON CONFLICT (user_id, business_unit_id) DO UPDATE SET
      role = EXCLUDED.role;

    RETURN v_assignment_id;
  END IF;

  SELECT access.is_default, access.is_current
  INTO v_removed_is_default, v_removed_is_current
  FROM public.user_business_unit_access access
  WHERE access.user_id = p_target_user_id
    AND access.business_unit_id = p_business_unit_id
  FOR UPDATE;

  IF FOUND THEN
    DELETE FROM public.user_business_unit_access access
    WHERE access.user_id = p_target_user_id
      AND access.business_unit_id = p_business_unit_id;

    IF v_removed_is_default OR v_removed_is_current THEN
      SELECT access.business_unit_id
      INTO v_replacement_business_unit_id
      FROM public.user_business_unit_access access
      WHERE access.user_id = p_target_user_id
      ORDER BY
        access.is_current DESC,
        access.is_default DESC,
        access.granted_at ASC,
        access.business_unit_id ASC
      LIMIT 1
      FOR UPDATE;

      IF v_replacement_business_unit_id IS NOT NULL THEN
        IF v_removed_is_default THEN
          UPDATE public.user_business_unit_access access
          SET is_default = TRUE
          WHERE access.user_id = p_target_user_id
            AND access.business_unit_id = v_replacement_business_unit_id;
        END IF;

        IF v_removed_is_current THEN
          UPDATE public.user_business_unit_access access
          SET is_current = TRUE
          WHERE access.user_id = p_target_user_id
            AND access.business_unit_id = v_replacement_business_unit_id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN v_assignment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_user_role_to_business_unit(
  UUID,
  UUID,
  UUID,
  UUID,
  UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role_to_business_unit(
  UUID,
  UUID,
  UUID,
  UUID,
  UUID
) TO authenticated;

REVOKE ALL ON FUNCTION public.remove_user_role_from_business_unit(
  UUID,
  UUID,
  UUID,
  UUID,
  UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_user_role_from_business_unit(
  UUID,
  UUID,
  UUID,
  UUID,
  UUID
) TO authenticated;

COMMENT ON FUNCTION public.assign_user_role_to_business_unit(
  UUID,
  UUID,
  UUID,
  UUID,
  UUID
) IS 'Atomically grants business-unit access and assigns one BU-scoped role.';

COMMENT ON FUNCTION public.remove_user_role_from_business_unit(
  UUID,
  UUID,
  UUID,
  UUID,
  UUID
) IS 'Atomically removes one BU-scoped role and revokes access when no BU-scoped roles remain.';
