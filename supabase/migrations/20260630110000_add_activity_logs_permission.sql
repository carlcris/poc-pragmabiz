INSERT INTO public.permissions (
  resource,
  description,
  can_view,
  can_create,
  can_edit,
  can_delete,
  created_at
)
VALUES (
  'activity_logs',
  'View user activity logs',
  TRUE,
  FALSE,
  FALSE,
  FALSE,
  NOW()
)
ON CONFLICT (resource) DO UPDATE
SET
  description = EXCLUDED.description,
  can_view = TRUE,
  can_create = FALSE,
  can_edit = FALSE,
  can_delete = FALSE,
  updated_at = NOW()
WHERE public.permissions.deleted_at IS NULL;

INSERT INTO public.role_permissions (
  role_id,
  permission_id,
  can_view,
  can_create,
  can_edit,
  can_delete,
  created_at
)
SELECT
  roles.id,
  permissions.id,
  TRUE,
  FALSE,
  FALSE,
  FALSE,
  NOW()
FROM public.roles
CROSS JOIN public.permissions
WHERE roles.name = 'Super Admin'
  AND roles.deleted_at IS NULL
  AND permissions.resource = 'activity_logs'
  AND permissions.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO UPDATE
SET
  can_view = TRUE,
  can_create = FALSE,
  can_edit = FALSE,
  can_delete = FALSE;

CREATE OR REPLACE FUNCTION public.setup_company_rbac(p_company_id UUID)
RETURNS VOID AS $$
DECLARE
  v_super_admin_role_id UUID;
  v_admin_role_id UUID;
  v_manager_role_id UUID;
  v_user_role_id UUID;
  v_viewer_role_id UUID;
BEGIN
  INSERT INTO roles (company_id, name, description, is_system_role)
  VALUES (
    p_company_id,
    'Super Admin',
    'Full system access including role and permission management',
    TRUE
  )
  RETURNING id INTO v_super_admin_role_id;

  INSERT INTO role_permissions (
    role_id,
    permission_id,
    can_view,
    can_create,
    can_edit,
    can_delete
  )
  SELECT
    v_super_admin_role_id,
    id,
    can_view,
    can_create,
    can_edit,
    can_delete
  FROM permissions;

  INSERT INTO roles (company_id, name, description, is_system_role)
  VALUES (
    p_company_id,
    'Admin',
    'Full access except role and permission management',
    TRUE
  )
  RETURNING id INTO v_admin_role_id;

  INSERT INTO role_permissions (
    role_id,
    permission_id,
    can_view,
    can_create,
    can_edit,
    can_delete
  )
  SELECT
    v_admin_role_id,
    id,
    can_view,
    can_create,
    can_edit,
    can_delete
  FROM permissions
  WHERE resource NOT IN ('roles', 'permissions', 'activity_logs');

  INSERT INTO roles (company_id, name, description, is_system_role)
  VALUES (
    p_company_id,
    'Manager',
    'View all, create/edit most resources, limited delete permissions',
    TRUE
  )
  RETURNING id INTO v_manager_role_id;

  INSERT INTO role_permissions (
    role_id,
    permission_id,
    can_view,
    can_create,
    can_edit,
    can_delete
  )
  SELECT
    v_manager_role_id,
    p.id,
    p.can_view,
    p.can_create,
    p.can_edit,
    FALSE
  FROM permissions p
  WHERE p.resource NOT IN (
    'users',
    'roles',
    'permissions',
    'company_settings',
    'business_units',
    'activity_logs'
  )
  UNION
  SELECT
    v_manager_role_id,
    p.id,
    TRUE,
    FALSE,
    FALSE,
    FALSE
  FROM permissions p
  WHERE p.resource IN ('users', 'business_units') AND p.can_view = TRUE;

  INSERT INTO roles (company_id, name, description, is_system_role)
  VALUES (
    p_company_id,
    'User',
    'Standard user with view and create access to operational areas',
    TRUE
  )
  RETURNING id INTO v_user_role_id;

  INSERT INTO role_permissions (
    role_id,
    permission_id,
    can_view,
    can_create,
    can_edit,
    can_delete
  )
  SELECT
    v_user_role_id,
    id,
    can_view,
    can_create,
    can_edit,
    FALSE
  FROM permissions
  WHERE resource IN (
    'items', 'customers', 'suppliers', 'view_location_stock',
    'sales_quotations', 'sales_orders', 'sales_invoices',
    'purchase_orders', 'purchase_receipts',
    'stock_adjustments', 'stock_transfers',
    'dashboard', 'reports'
  );

  INSERT INTO roles (company_id, name, description, is_system_role)
  VALUES (
    p_company_id,
    'Viewer',
    'Read-only access to most areas',
    TRUE
  )
  RETURNING id INTO v_viewer_role_id;

  INSERT INTO role_permissions (
    role_id,
    permission_id,
    can_view,
    can_create,
    can_edit,
    can_delete
  )
  SELECT
    v_viewer_role_id,
    id,
    TRUE,
    FALSE,
    FALSE,
    FALSE
  FROM permissions
  WHERE can_view = TRUE
    AND resource NOT IN ('roles', 'permissions', 'company_settings', 'activity_logs');

  RAISE NOTICE 'RBAC setup completed for company %', p_company_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.setup_company_rbac IS
  'Sets up default roles and permissions for a company';
