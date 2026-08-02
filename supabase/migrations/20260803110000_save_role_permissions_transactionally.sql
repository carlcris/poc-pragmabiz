BEGIN;

CREATE OR REPLACE FUNCTION public.save_role_permissions(
  p_actor_user_id UUID,
  p_company_id UUID,
  p_role_id UUID,
  p_permissions JSONB,
  p_business_unit_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_system_role BOOLEAN;
  v_permission_count INTEGER;
  v_distinct_permission_count INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_user_id THEN
    RAISE EXCEPTION 'ROLE_PERMISSION_UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users actor
    WHERE actor.id = p_actor_user_id
      AND actor.company_id = p_company_id
      AND actor.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'ROLE_PERMISSION_FORBIDDEN';
  END IF;

  SELECT role.is_system_role
  INTO v_is_system_role
  FROM public.roles role
  WHERE role.id = p_role_id
    AND role.company_id = p_company_id
    AND role.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROLE_PERMISSION_ROLE_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.permissions permission
    JOIN public.role_permissions role_permission
      ON role_permission.permission_id = permission.id
     AND role_permission.can_edit IS TRUE
    JOIN public.roles assigned_role
      ON assigned_role.id = role_permission.role_id
     AND assigned_role.deleted_at IS NULL
    JOIN public.user_roles assignment
      ON assignment.role_id = assigned_role.id
     AND assignment.user_id = p_actor_user_id
     AND assignment.deleted_at IS NULL
    WHERE permission.resource = 'roles'
      AND permission.can_edit IS TRUE
      AND permission.deleted_at IS NULL
      AND (
        p_business_unit_id IS NULL
        OR assignment.business_unit_id IS NULL
        OR assignment.business_unit_id = p_business_unit_id
      )
  ) THEN
    RAISE EXCEPTION 'ROLE_PERMISSION_FORBIDDEN';
  END IF;

  IF v_is_system_role
     AND regexp_replace(
       lower(COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '')),
       '[ _-]+',
       '',
       'g'
     ) <> 'superadmin'
     AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles assignment
    JOIN public.roles assigned_role
      ON assigned_role.id = assignment.role_id
     AND assigned_role.company_id = p_company_id
     AND assigned_role.deleted_at IS NULL
    WHERE assignment.user_id = p_actor_user_id
      AND assignment.deleted_at IS NULL
      AND regexp_replace(lower(btrim(assigned_role.name)), '[ _-]+', '', 'g') = 'superadmin'
  ) THEN
    RAISE EXCEPTION 'ROLE_PERMISSION_SYSTEM_ROLE_FORBIDDEN';
  END IF;

  IF p_permissions IS NULL
     OR jsonb_typeof(p_permissions) <> 'array'
     OR jsonb_array_length(p_permissions) > 500 THEN
    RAISE EXCEPTION 'ROLE_PERMISSION_INVALID_PAYLOAD';
  END IF;

  SELECT count(*), count(DISTINCT input.permission_id)
  INTO v_permission_count, v_distinct_permission_count
  FROM jsonb_to_recordset(p_permissions) AS input(
    permission_id UUID,
    can_view BOOLEAN,
    can_create BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN
  );

  IF v_permission_count <> v_distinct_permission_count THEN
    RAISE EXCEPTION 'ROLE_PERMISSION_DUPLICATE_PERMISSION';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_permissions) AS input(
      permission_id UUID,
      can_view BOOLEAN,
      can_create BOOLEAN,
      can_edit BOOLEAN,
      can_delete BOOLEAN
    )
    LEFT JOIN public.permissions permission
      ON permission.id = input.permission_id
     AND permission.deleted_at IS NULL
    WHERE permission.id IS NULL
       OR (COALESCE(input.can_view, FALSE) AND NOT permission.can_view)
       OR (COALESCE(input.can_create, FALSE) AND NOT permission.can_create)
       OR (COALESCE(input.can_edit, FALSE) AND NOT permission.can_edit)
       OR (COALESCE(input.can_delete, FALSE) AND NOT permission.can_delete)
  ) THEN
    RAISE EXCEPTION 'ROLE_PERMISSION_INVALID_PERMISSION';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_permissions) AS input(
      permission_id UUID,
      can_view BOOLEAN,
      can_create BOOLEAN,
      can_edit BOOLEAN,
      can_delete BOOLEAN
    )
    JOIN public.permissions permission
      ON permission.id = input.permission_id
     AND permission.deleted_at IS NULL
    WHERE permission.is_granular IS NOT TRUE
      AND COALESCE(input.can_view, FALSE) IS NOT TRUE
      AND (
        COALESCE(input.can_create, FALSE)
        OR COALESCE(input.can_edit, FALSE)
        OR COALESCE(input.can_delete, FALSE)
      )
  ) THEN
    RAISE EXCEPTION 'ROLE_PERMISSION_VIEW_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_permissions) AS child_input(
      permission_id UUID,
      can_view BOOLEAN,
      can_create BOOLEAN,
      can_edit BOOLEAN,
      can_delete BOOLEAN
    )
    JOIN public.permissions child_permission
      ON child_permission.id = child_input.permission_id
     AND child_permission.deleted_at IS NULL
     AND child_permission.is_granular IS TRUE
    LEFT JOIN public.permissions parent_permission
      ON parent_permission.resource = child_permission.parent_resource
     AND parent_permission.deleted_at IS NULL
     AND parent_permission.is_granular IS NOT TRUE
    LEFT JOIN jsonb_to_recordset(p_permissions) AS parent_input(
      permission_id UUID,
      can_view BOOLEAN,
      can_create BOOLEAN,
      can_edit BOOLEAN,
      can_delete BOOLEAN
    ) ON parent_input.permission_id = parent_permission.id
    WHERE (
      COALESCE(child_input.can_view, FALSE)
      OR COALESCE(child_input.can_create, FALSE)
      OR COALESCE(child_input.can_edit, FALSE)
      OR COALESCE(child_input.can_delete, FALSE)
    )
      AND (
        parent_permission.id IS NULL
        OR COALESCE(parent_input.can_view, FALSE) IS NOT TRUE
      )
  ) THEN
    RAISE EXCEPTION 'ROLE_PERMISSION_PARENT_VIEW_REQUIRED';
  END IF;

  DELETE FROM public.role_permissions role_permission
  WHERE role_permission.role_id = p_role_id;

  INSERT INTO public.role_permissions (
    role_id,
    permission_id,
    can_view,
    can_create,
    can_edit,
    can_delete,
    created_by
  )
  SELECT
    p_role_id,
    input.permission_id,
    COALESCE(input.can_view, FALSE),
    COALESCE(input.can_create, FALSE),
    COALESCE(input.can_edit, FALSE),
    COALESCE(input.can_delete, FALSE),
    p_actor_user_id
  FROM jsonb_to_recordset(p_permissions) AS input(
    permission_id UUID,
    can_view BOOLEAN,
    can_create BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN
  )
  WHERE COALESCE(input.can_view, FALSE)
     OR COALESCE(input.can_create, FALSE)
     OR COALESCE(input.can_edit, FALSE)
     OR COALESCE(input.can_delete, FALSE);
END;
$$;

COMMENT ON FUNCTION public.save_role_permissions(UUID, UUID, UUID, JSONB, UUID)
IS 'Atomically saves a role''s complete permission set while enforcing module View and granular parent View dependencies.';

REVOKE ALL ON FUNCTION public.save_role_permissions(UUID, UUID, UUID, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_role_permissions(UUID, UUID, UUID, JSONB, UUID)
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.remove_role_permissions(
  p_actor_user_id UUID,
  p_company_id UUID,
  p_role_id UUID,
  p_permission_ids UUID[],
  p_business_unit_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_system_role BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_user_id THEN
    RAISE EXCEPTION 'ROLE_PERMISSION_UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users actor
    WHERE actor.id = p_actor_user_id
      AND actor.company_id = p_company_id
      AND actor.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'ROLE_PERMISSION_FORBIDDEN';
  END IF;

  SELECT role.is_system_role
  INTO v_is_system_role
  FROM public.roles role
  WHERE role.id = p_role_id
    AND role.company_id = p_company_id
    AND role.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROLE_PERMISSION_ROLE_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.permissions permission
    JOIN public.role_permissions role_permission
      ON role_permission.permission_id = permission.id
     AND role_permission.can_edit IS TRUE
    JOIN public.roles assigned_role
      ON assigned_role.id = role_permission.role_id
     AND assigned_role.deleted_at IS NULL
    JOIN public.user_roles assignment
      ON assignment.role_id = assigned_role.id
     AND assignment.user_id = p_actor_user_id
     AND assignment.deleted_at IS NULL
    WHERE permission.resource = 'roles'
      AND permission.can_edit IS TRUE
      AND permission.deleted_at IS NULL
      AND (
        p_business_unit_id IS NULL
        OR assignment.business_unit_id IS NULL
        OR assignment.business_unit_id = p_business_unit_id
      )
  ) THEN
    RAISE EXCEPTION 'ROLE_PERMISSION_FORBIDDEN';
  END IF;

  IF v_is_system_role
     AND regexp_replace(
       lower(COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '')),
       '[ _-]+',
       '',
       'g'
     ) <> 'superadmin'
     AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles assignment
    JOIN public.roles assigned_role
      ON assigned_role.id = assignment.role_id
     AND assigned_role.company_id = p_company_id
     AND assigned_role.deleted_at IS NULL
    WHERE assignment.user_id = p_actor_user_id
      AND assignment.deleted_at IS NULL
      AND regexp_replace(lower(btrim(assigned_role.name)), '[ _-]+', '', 'g') = 'superadmin'
  ) THEN
    RAISE EXCEPTION 'ROLE_PERMISSION_SYSTEM_ROLE_FORBIDDEN';
  END IF;

  IF p_permission_ids IS NULL
     OR cardinality(p_permission_ids) = 0
     OR cardinality(p_permission_ids) > 500
     OR array_position(p_permission_ids, NULL) IS NOT NULL
     OR cardinality(p_permission_ids) <> (
       SELECT count(DISTINCT input.permission_id)
       FROM unnest(p_permission_ids) AS input(permission_id)
     ) THEN
    RAISE EXCEPTION 'ROLE_PERMISSION_INVALID_PAYLOAD';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_permission_ids) AS input(permission_id)
    LEFT JOIN public.permissions permission
      ON permission.id = input.permission_id
     AND permission.deleted_at IS NULL
    WHERE permission.id IS NULL
  ) THEN
    RAISE EXCEPTION 'ROLE_PERMISSION_INVALID_PERMISSION';
  END IF;

  DELETE FROM public.role_permissions role_permission
  USING public.permissions assigned_permission
  WHERE role_permission.role_id = p_role_id
    AND assigned_permission.id = role_permission.permission_id
    AND (
      role_permission.permission_id = ANY(p_permission_ids)
      OR EXISTS (
        SELECT 1
        FROM public.permissions removed_parent
        WHERE removed_parent.id = ANY(p_permission_ids)
          AND removed_parent.is_granular IS NOT TRUE
          AND assigned_permission.is_granular IS TRUE
          AND assigned_permission.parent_resource = removed_parent.resource
      )
    );
END;
$$;

COMMENT ON FUNCTION public.remove_role_permissions(UUID, UUID, UUID, UUID[], UUID)
IS 'Atomically removes role permissions and any granular children whose parent permission is removed.';

REVOKE ALL ON FUNCTION public.remove_role_permissions(UUID, UUID, UUID, UUID[], UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_role_permissions(UUID, UUID, UUID, UUID[], UUID)
TO authenticated, service_role;

COMMIT;
