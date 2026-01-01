-- Add Granular CRUD Control to Role Permissions
-- This migration adds individual CRUD flags to role_permissions table
-- to allow fine-grained control over what actions each role can perform

-- ============================================================================
-- ADD CRUD COLUMNS TO ROLE_PERMISSIONS
-- ============================================================================

-- Add columns for granular permission control
ALTER TABLE role_permissions
ADD COLUMN can_view BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN can_create BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN can_edit BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN can_delete BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- MIGRATE EXISTING DATA
-- ============================================================================
-- For existing role_permissions, copy the CRUD flags from the permission
-- This ensures backwards compatibility

UPDATE role_permissions rp
SET
  can_view = p.can_view,
  can_create = p.can_create,
  can_edit = p.can_edit,
  can_delete = p.can_delete
FROM permissions p
WHERE rp.permission_id = p.id;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN role_permissions.can_view IS 'Whether this role can view resources of this permission type';
COMMENT ON COLUMN role_permissions.can_create IS 'Whether this role can create resources of this permission type';
COMMENT ON COLUMN role_permissions.can_edit IS 'Whether this role can edit/update resources of this permission type';
COMMENT ON COLUMN role_permissions.can_delete IS 'Whether this role can delete resources of this permission type';

-- ============================================================================
-- NOTES
-- ============================================================================
-- The permissions table still defines the MAXIMUM allowed operations for a resource.
-- The role_permissions table now defines the ACTUAL operations granted to a specific role.
-- role_permissions.can_* should never exceed permissions.can_* for the same permission.
