-- Add missing resources that were used in Phase 3 API protection but not in seed data

DO $$
DECLARE
  v_super_admin_role_id UUID;
  v_perm_id UUID;
BEGIN
  -- Get Super Admin role ID for Demo Company
  SELECT id INTO v_super_admin_role_id
  FROM roles
  WHERE name = 'Super Admin'
    AND company_id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;

  -- Add missing resources and assign to Super Admin

  -- Stock Transactions
  INSERT INTO permissions (resource, can_view, can_create, can_edit, can_delete, description, created_at)
  VALUES (
    'stock_transactions',
    true, true, true, true,
    'View and manage stock transaction history',
    NOW()
  )
  ON CONFLICT (resource) DO NOTHING
  RETURNING id INTO v_perm_id;

  IF v_perm_id IS NOT NULL AND v_super_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id, created_at)
    VALUES (v_super_admin_role_id, v_perm_id, NOW())
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Sales Orders (if not already exists as sales_orders)
  INSERT INTO permissions (resource, can_view, can_create, can_edit, can_delete, description, created_at)
  VALUES (
    'sales_orders',
    true, true, true, true,
    'Create and manage sales orders',
    NOW()
  )
  ON CONFLICT (resource) DO NOTHING
  RETURNING id INTO v_perm_id;

  IF v_perm_id IS NOT NULL AND v_super_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id, created_at)
    VALUES (v_super_admin_role_id, v_perm_id, NOW())
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Items
  INSERT INTO permissions (resource, can_view, can_create, can_edit, can_delete, description, created_at)
  VALUES (
    'items',
    true, true, true, true,
    'View and manage inventory items',
    NOW()
  )
  ON CONFLICT (resource) DO NOTHING
  RETURNING id INTO v_perm_id;

  IF v_perm_id IS NOT NULL AND v_super_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id, created_at)
    VALUES (v_super_admin_role_id, v_perm_id, NOW())
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Customers
  INSERT INTO permissions (resource, can_view, can_create, can_edit, can_delete, description, created_at)
  VALUES (
    'customers',
    true, true, true, true,
    'View and manage customers',
    NOW()
  )
  ON CONFLICT (resource) DO NOTHING
  RETURNING id INTO v_perm_id;

  IF v_perm_id IS NOT NULL AND v_super_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id, created_at)
    VALUES (v_super_admin_role_id, v_perm_id, NOW())
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  RAISE NOTICE 'Missing resources added and assigned to Super Admin role';
END $$;
