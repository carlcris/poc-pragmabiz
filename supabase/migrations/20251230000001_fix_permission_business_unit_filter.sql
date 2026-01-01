-- Fix permission check to properly handle business unit context
-- Global roles (business_unit_id IS NULL) should apply to all business units

CREATE OR REPLACE FUNCTION get_user_permissions(
  p_user_id UUID,
  p_business_unit_id UUID DEFAULT NULL
)
RETURNS TABLE (
  resource VARCHAR,
  can_view BOOLEAN,
  can_create BOOLEAN,
  can_edit BOOLEAN,
  can_delete BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.resource,
    -- UNION logic: if ANY role grants the permission, return true
    BOOL_OR(p.can_view) AS can_view,
    BOOL_OR(p.can_create) AS can_create,
    BOOL_OR(p.can_edit) AS can_edit,
    BOOL_OR(p.can_delete) AS can_delete
  FROM permissions p
  INNER JOIN role_permissions rp ON p.id = rp.permission_id
  INNER JOIN roles r ON rp.role_id = r.id
  INNER JOIN user_roles ur ON r.id = ur.role_id
  WHERE ur.user_id = p_user_id
    AND ur.deleted_at IS NULL
    AND r.deleted_at IS NULL
    AND p.deleted_at IS NULL
    -- Include global roles (NULL business_unit_id) OR roles matching the specified business unit
    AND (
      p_business_unit_id IS NULL
      OR ur.business_unit_id IS NULL
      OR ur.business_unit_id = p_business_unit_id
    )
  GROUP BY p.resource
  ORDER BY p.resource;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_permissions IS 'Get aggregated permissions for a user. Global roles (business_unit_id IS NULL) apply to all business units.';


-- Also fix the user_has_permission function
CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id UUID,
  p_resource VARCHAR,
  p_action VARCHAR, -- 'view', 'create', 'edit', 'delete'
  p_business_unit_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN := false;
BEGIN
  SELECT
    CASE p_action
      WHEN 'view' THEN BOOL_OR(p.can_view)
      WHEN 'create' THEN BOOL_OR(p.can_create)
      WHEN 'edit' THEN BOOL_OR(p.can_edit)
      WHEN 'delete' THEN BOOL_OR(p.can_delete)
      ELSE false
    END INTO v_has_permission
  FROM permissions p
  INNER JOIN role_permissions rp ON p.id = rp.permission_id
  INNER JOIN roles r ON rp.role_id = r.id
  INNER JOIN user_roles ur ON r.id = ur.role_id
  WHERE ur.user_id = p_user_id
    AND p.resource = p_resource
    AND ur.deleted_at IS NULL
    AND r.deleted_at IS NULL
    AND p.deleted_at IS NULL
    -- Include global roles (NULL business_unit_id) OR roles matching the specified business unit
    AND (
      p_business_unit_id IS NULL
      OR ur.business_unit_id IS NULL
      OR ur.business_unit_id = p_business_unit_id
    );

  RETURN COALESCE(v_has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION user_has_permission IS 'Check if user has a specific permission. Global roles (business_unit_id IS NULL) apply to all business units.';
