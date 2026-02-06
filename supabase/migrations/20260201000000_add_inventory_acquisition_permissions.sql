-- Add Inventory Acquisition permissions (Phase 1 & 2)

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

  -- Add Stock Requisitions permission (Phase 1)
  INSERT INTO permissions (resource, can_view, can_create, can_edit, can_delete, description, created_at)
  VALUES (
    'stock_requisitions',
    true, true, true, true,
    'Manage stock requisitions without formal PO',
    NOW()
  )
  ON CONFLICT (resource) DO UPDATE SET
    can_view = EXCLUDED.can_view,
    can_create = EXCLUDED.can_create,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    description = EXCLUDED.description
  RETURNING id INTO v_perm_id;

  IF v_perm_id IS NOT NULL AND v_super_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id, created_at)
    VALUES (v_super_admin_role_id, v_perm_id, NOW())
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Add Load Lists permission (Phase 1)
  INSERT INTO permissions (resource, can_view, can_create, can_edit, can_delete, description, created_at)
  VALUES (
    'load_lists',
    true, true, true, true,
    'Manage supplier shipments and load lists',
    NOW()
  )
  ON CONFLICT (resource) DO UPDATE SET
    can_view = EXCLUDED.can_view,
    can_create = EXCLUDED.can_create,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    description = EXCLUDED.description
  RETURNING id INTO v_perm_id;

  IF v_perm_id IS NOT NULL AND v_super_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id, created_at)
    VALUES (v_super_admin_role_id, v_perm_id, NOW())
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Add Goods Receipt Notes permission (Phase 2)
  INSERT INTO permissions (resource, can_view, can_create, can_edit, can_delete, description, created_at)
  VALUES (
    'goods_receipt_notes',
    true, true, true, true,
    'Receive and verify goods from suppliers',
    NOW()
  )
  ON CONFLICT (resource) DO UPDATE SET
    can_view = EXCLUDED.can_view,
    can_create = EXCLUDED.can_create,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    description = EXCLUDED.description
  RETURNING id INTO v_perm_id;

  IF v_perm_id IS NOT NULL AND v_super_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id, created_at)
    VALUES (v_super_admin_role_id, v_perm_id, NOW())
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  RAISE NOTICE 'Inventory Acquisition permissions added to Super Admin role';
END $$;
