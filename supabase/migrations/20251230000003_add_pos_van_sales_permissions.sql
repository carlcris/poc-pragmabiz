-- Add missing POS and Van Sales permissions
-- These resources exist in the frontend but were missing from the permissions table

-- Insert POS permission
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('pos', 'Point of Sale transactions', true, true, true, true)
ON CONFLICT (resource) DO NOTHING;

-- Insert Van Sales permission
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('van_sales', 'Manage van sales operations and transactions', true, true, true, true)
ON CONFLICT (resource) DO NOTHING;

-- Automatically assign these new permissions to existing Super Admin roles
-- This ensures Super Admins have access to all features
INSERT INTO role_permissions (role_id, permission_id, can_view, can_create, can_edit, can_delete)
SELECT
  r.id as role_id,
  p.id as permission_id,
  true as can_view,
  true as can_create,
  true as can_edit,
  true as can_delete
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Super Admin'
  AND p.resource IN ('pos', 'van_sales')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
