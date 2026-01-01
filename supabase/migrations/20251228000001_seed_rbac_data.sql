-- Seed Data for RBAC System
-- This migration creates default roles and permissions for all companies

-- ============================================================================
-- SEED PERMISSIONS
-- Create permissions for all resources
-- ============================================================================

-- Admin & System Management
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('users', 'Manage user accounts and access', true, true, true, true),
  ('roles', 'Manage user roles and permissions', true, true, true, true),
  ('permissions', 'Manage system permissions', true, true, true, true),
  ('company_settings', 'Manage company configuration', true, false, true, false),
  ('business_units', 'Manage business units', true, true, true, true);

-- Inventory Management
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('items', 'Manage inventory items and products', true, true, true, true),
  ('item_categories', 'Manage item categories', true, true, true, true),
  ('warehouses', 'Manage warehouse locations', true, true, true, true),
  ('stock_adjustments', 'Adjust inventory quantities', true, true, true, true),
  ('stock_transfers', 'Transfer stock between warehouses', true, true, true, true),
  ('stock_transformations', 'Transform items into other items', true, true, true, true),
  ('reorder_management', 'Manage reorder points and alerts', true, true, true, true);

-- Sales Management
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('customers', 'Manage customer information', true, true, true, true),
  ('sales_quotations', 'Create and manage sales quotations', true, true, true, true),
  ('sales_orders', 'Create and manage sales orders', true, true, true, true),
  ('sales_invoices', 'Create and manage sales invoices', true, true, true, true);

-- Purchasing Management
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('suppliers', 'Manage supplier information', true, true, true, true),
  ('purchase_orders', 'Create and manage purchase orders', true, true, true, true),
  ('purchase_receipts', 'Receive and manage goods receipts', true, true, true, true);

-- Accounting & Finance
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('chart_of_accounts', 'Manage account structure', true, true, true, true),
  ('journal_entries', 'Create and manage journal entries', true, true, true, true),
  ('general_ledger', 'View general ledger reports', true, false, false, false),
  ('invoice_payments', 'Manage invoice payments', true, true, true, true);

-- Employee Management
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('employees', 'Manage employee information', true, true, true, true);

-- Reporting & Analytics
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('reports', 'Access system reports', true, false, false, false),
  ('analytics', 'View analytics and insights', true, false, false, false),
  ('dashboard', 'View dashboard and metrics', true, false, false, false);

-- ============================================================================
-- CREATE DEFAULT ROLES FOR EACH COMPANY
-- This function will be called to set up roles for each company
-- ============================================================================

CREATE OR REPLACE FUNCTION setup_company_rbac(p_company_id UUID)
RETURNS VOID AS $$
DECLARE
  v_super_admin_role_id UUID;
  v_admin_role_id UUID;
  v_manager_role_id UUID;
  v_user_role_id UUID;
  v_viewer_role_id UUID;
  v_permission RECORD;
BEGIN
  -- Create Super Admin Role
  INSERT INTO roles (company_id, name, description, is_system_role)
  VALUES (
    p_company_id,
    'Super Admin',
    'Full system access including role and permission management',
    true
  )
  RETURNING id INTO v_super_admin_role_id;

  -- Assign ALL permissions to Super Admin
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_super_admin_role_id, id FROM permissions;

  -- Create Admin Role
  INSERT INTO roles (company_id, name, description, is_system_role)
  VALUES (
    p_company_id,
    'Admin',
    'Full access except role and permission management',
    true
  )
  RETURNING id INTO v_admin_role_id;

  -- Assign all permissions except roles, permissions to Admin
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_admin_role_id, id
  FROM permissions
  WHERE resource NOT IN ('roles', 'permissions');

  -- Create Manager Role
  INSERT INTO roles (company_id, name, description, is_system_role)
  VALUES (
    p_company_id,
    'Manager',
    'View all, create/edit most resources, limited delete permissions',
    true
  )
  RETURNING id INTO v_manager_role_id;

  -- Assign view all, create/edit most to Manager (no delete on critical resources)
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_manager_role_id, p.id
  FROM permissions p
  WHERE p.resource NOT IN ('users', 'roles', 'permissions', 'company_settings', 'business_units')
  UNION
  -- Add view-only for admin resources
  SELECT v_manager_role_id, p.id
  FROM permissions p
  WHERE p.resource IN ('users', 'business_units') AND p.can_view = true;

  -- Create User Role
  INSERT INTO roles (company_id, name, description, is_system_role)
  VALUES (
    p_company_id,
    'User',
    'Standard user with view and create access to operational areas',
    true
  )
  RETURNING id INTO v_user_role_id;

  -- Assign operational permissions to User (view, create, edit - no delete)
  FOR v_permission IN
    SELECT id, resource FROM permissions
    WHERE resource IN (
      'items', 'customers', 'suppliers',
      'sales_quotations', 'sales_orders', 'sales_invoices',
      'purchase_orders', 'purchase_receipts',
      'stock_adjustments', 'stock_transfers',
      'dashboard', 'reports'
    )
  LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (v_user_role_id, v_permission.id);
  END LOOP;

  -- Create Viewer Role
  INSERT INTO roles (company_id, name, description, is_system_role)
  VALUES (
    p_company_id,
    'Viewer',
    'Read-only access to most areas',
    true
  )
  RETURNING id INTO v_viewer_role_id;

  -- Assign view-only permissions to Viewer
  FOR v_permission IN
    SELECT id, resource FROM permissions
    WHERE can_view = true
      AND resource NOT IN ('roles', 'permissions', 'company_settings')
  LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (v_viewer_role_id, v_permission.id);
  END LOOP;

  RAISE NOTICE 'RBAC setup completed for company %', p_company_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SETUP RBAC FOR EXISTING COMPANIES
-- ============================================================================

DO $$
DECLARE
  v_company RECORD;
BEGIN
  FOR v_company IN SELECT id FROM companies WHERE deleted_at IS NULL
  LOOP
    PERFORM setup_company_rbac(v_company.id);
  END LOOP;
END $$;

-- ============================================================================
-- ASSIGN SUPER ADMIN ROLE TO EXISTING ADMIN USERS
-- ============================================================================

-- This assigns the Super Admin role to the first user in each company
-- You may want to adjust this based on your specific requirements

DO $$
DECLARE
  v_user RECORD;
  v_super_admin_role_id UUID;
  v_default_bu_id UUID;
BEGIN
  FOR v_user IN
    SELECT DISTINCT ON (u.company_id)
      u.id AS user_id,
      u.company_id,
      u.email
    FROM users u
    WHERE u.deleted_at IS NULL
    ORDER BY u.company_id, u.created_at ASC
  LOOP
    -- Get Super Admin role for this company
    SELECT id INTO v_super_admin_role_id
    FROM roles
    WHERE company_id = v_user.company_id
      AND name = 'Super Admin'
      AND deleted_at IS NULL
    LIMIT 1;

    -- Get default business unit for this company
    SELECT id INTO v_default_bu_id
    FROM business_units
    WHERE company_id = v_user.company_id
      AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    -- Assign Super Admin role
    IF v_super_admin_role_id IS NOT NULL THEN
      INSERT INTO user_roles (user_id, role_id, business_unit_id)
      VALUES (v_user.user_id, v_super_admin_role_id, v_default_bu_id)
      ON CONFLICT (user_id, role_id, business_unit_id) DO NOTHING;

      RAISE NOTICE 'Assigned Super Admin role to user % (%) in company %',
        v_user.email, v_user.user_id, v_user.company_id;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- CREATE TRIGGER TO SETUP RBAC FOR NEW COMPANIES
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_setup_rbac_for_new_company()
RETURNS TRIGGER AS $$
BEGIN
  -- Setup RBAC for the new company
  PERFORM setup_company_rbac(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_company_rbac_setup
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_setup_rbac_for_new_company();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION setup_company_rbac IS 'Sets up default roles and permissions for a company';
COMMENT ON FUNCTION trigger_setup_rbac_for_new_company IS 'Automatically creates default RBAC structure when a new company is created';
