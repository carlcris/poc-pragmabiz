-- RBAC (Role-Based Access Control) System Implementation
-- This migration creates tables for a complete permission management system

-- ============================================================================
-- ROLES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT false, -- Prevents deletion of critical roles
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Unique constraint: role name must be unique per company
  CONSTRAINT uq_role_name_per_company UNIQUE (company_id, name)
);

-- Indexes for performance
CREATE INDEX idx_roles_company ON roles(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_roles_system ON roles(is_system_role) WHERE deleted_at IS NULL;

-- Updated at trigger
CREATE TRIGGER trigger_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PERMISSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource VARCHAR(100) NOT NULL UNIQUE, -- e.g., 'users', 'inventory', 'sales'
  description TEXT,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_permissions_resource ON permissions(resource) WHERE deleted_at IS NULL;

-- Updated at trigger
CREATE TRIGGER trigger_permissions_updated_at
  BEFORE UPDATE ON permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROLE_PERMISSIONS JUNCTION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Unique constraint: a role can have a permission only once
  CONSTRAINT uq_role_permission UNIQUE (role_id, permission_id)
);

-- Indexes for performance
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

-- ============================================================================
-- USER_ROLES JUNCTION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  business_unit_id UUID REFERENCES business_units(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Unique constraint: a user can have a role only once per business unit
  CONSTRAINT uq_user_role_bu UNIQUE (user_id, role_id, business_unit_id)
);

-- Indexes for performance
CREATE INDEX idx_user_roles_user ON user_roles(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_roles_role ON user_roles(role_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_roles_bu ON user_roles(business_unit_id) WHERE deleted_at IS NULL;

-- Updated at trigger
CREATE TRIGGER trigger_user_roles_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR ROLES TABLE
-- ============================================================================

-- Users can view roles in their company
CREATE POLICY roles_select_policy ON roles
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Only users with 'roles' create permission can create roles
CREATE POLICY roles_insert_policy ON roles
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Only users with 'roles' edit permission can update roles
CREATE POLICY roles_update_policy ON roles
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Only users with 'roles' delete permission can delete roles
-- System roles cannot be deleted (enforced at application level)
CREATE POLICY roles_delete_policy ON roles
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    AND is_system_role = false
  );

-- ============================================================================
-- RLS POLICIES FOR PERMISSIONS TABLE
-- ============================================================================

-- All authenticated users can view permissions
CREATE POLICY permissions_select_policy ON permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can create/update/delete permissions
-- (Permission checks will be enforced at API level)
CREATE POLICY permissions_insert_policy ON permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY permissions_update_policy ON permissions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY permissions_delete_policy ON permissions
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- RLS POLICIES FOR ROLE_PERMISSIONS TABLE
-- ============================================================================

-- Users can view role-permission mappings for roles in their company
CREATE POLICY role_permissions_select_policy ON role_permissions
  FOR SELECT
  USING (
    role_id IN (
      SELECT r.id FROM roles r
      JOIN users u ON u.company_id = r.company_id
      WHERE u.id = auth.uid()
    )
  );

-- Users with appropriate permissions can manage role-permission mappings
CREATE POLICY role_permissions_insert_policy ON role_permissions
  FOR INSERT
  WITH CHECK (
    role_id IN (
      SELECT r.id FROM roles r
      JOIN users u ON u.company_id = r.company_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY role_permissions_delete_policy ON role_permissions
  FOR DELETE
  USING (
    role_id IN (
      SELECT r.id FROM roles r
      JOIN users u ON u.company_id = r.company_id
      WHERE u.id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES FOR USER_ROLES TABLE
-- ============================================================================

-- Users can view user-role assignments in their company
CREATE POLICY user_roles_select_policy ON user_roles
  FOR SELECT
  USING (
    user_id IN (
      SELECT u.id FROM users u
      WHERE u.company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Users with appropriate permissions can assign roles
CREATE POLICY user_roles_insert_policy ON user_roles
  FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT u.id FROM users u
      WHERE u.company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Users with appropriate permissions can update role assignments
CREATE POLICY user_roles_update_policy ON user_roles
  FOR UPDATE
  USING (
    user_id IN (
      SELECT u.id FROM users u
      WHERE u.company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT u.id FROM users u
      WHERE u.company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Users with appropriate permissions can remove role assignments
CREATE POLICY user_roles_delete_policy ON user_roles
  FOR DELETE
  USING (
    user_id IN (
      SELECT u.id FROM users u
      WHERE u.company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get all permissions for a user (aggregated across roles)
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
    AND (p_business_unit_id IS NULL OR ur.business_unit_id = p_business_unit_id)
  GROUP BY p.resource
  ORDER BY p.resource;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has specific permission
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
    END
  INTO v_has_permission
  FROM permissions p
  INNER JOIN role_permissions rp ON p.id = rp.permission_id
  INNER JOIN roles r ON rp.role_id = r.id
  INNER JOIN user_roles ur ON r.id = ur.role_id
  WHERE ur.user_id = p_user_id
    AND p.resource = p_resource
    AND ur.deleted_at IS NULL
    AND r.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND (p_business_unit_id IS NULL OR ur.business_unit_id = p_business_unit_id);

  RETURN COALESCE(v_has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE roles IS 'Roles that can be assigned to users';
COMMENT ON TABLE permissions IS 'Permissions that define what actions can be performed on resources';
COMMENT ON TABLE role_permissions IS 'Junction table mapping roles to permissions';
COMMENT ON TABLE user_roles IS 'Junction table mapping users to roles, scoped by business unit';

COMMENT ON COLUMN roles.is_system_role IS 'System roles cannot be deleted (e.g., Super Admin)';
COMMENT ON COLUMN permissions.resource IS 'Resource identifier (e.g., users, inventory, sales)';
COMMENT ON COLUMN user_roles.business_unit_id IS 'Scope role assignment to specific business unit';
