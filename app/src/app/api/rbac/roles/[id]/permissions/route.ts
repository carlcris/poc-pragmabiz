import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithBU } from '@/lib/supabase/server-with-bu';
import { requirePermission, getAuthenticatedUser } from '@/lib/auth';
import { RESOURCES } from '@/constants/resources';
import { invalidatePermissionCache } from '@/services/permissions/permissionResolver';
import type { Tables } from '@/types/supabase';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type RoleRow = Tables<'roles'>;
type PermissionRow = Tables<'permissions'>;
type RolePermissionRow = Tables<'role_permissions'>;

type RolePermissionWithPermission = RolePermissionRow & {
  permissions?: PermissionRow | null;
};

type RolePermissionInput = {
  permission_id: string;
  can_view?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
};

// POST /api/rbac/roles/[id]/permissions - Assign permissions to role
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Require 'roles' edit permission
    const unauthorized = await requirePermission(RESOURCES.ROLES, 'edit');
    if (unauthorized) return unauthorized;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: roleId } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Parse request body
    const body = (await request.json()) as { permissions?: RolePermissionInput[] };
    const { permissions } = body;

    if (!permissions || !Array.isArray(permissions)) {
      return NextResponse.json(
        { error: 'Invalid request', details: 'permissions must be an array' },
        { status: 400 }
      );
    }

    // Check if role exists and belongs to company
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id, is_system_role, company_id')
      .eq('id', roleId)
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .single();

    if (roleError || !role) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      );
    }

    // Prevent modifying system roles
    if (role.is_system_role) {
      return NextResponse.json(
        { error: 'Cannot modify system role', details: 'System role permissions cannot be changed' },
        { status: 403 }
      );
    }

    // Verify all permissions exist
    const permissionIds = permissions.map((p) => p.permission_id);
    const { data: existingPermissions, error: permError } = await supabase
      .from('permissions')
      .select('id')
      .in('id', permissionIds)
      .is('deleted_at', null);

    if (permError || !existingPermissions || existingPermissions.length !== permissionIds.length) {
      return NextResponse.json(
        { error: 'Invalid permissions', details: 'One or more permission IDs are invalid' },
        { status: 400 }
      );
    }

    // Delete existing role-permission mappings
    const { error: deleteError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId);

    if (deleteError) {

      return NextResponse.json(
        { error: 'Failed to update permissions', details: deleteError.message },
        { status: 500 }
      );
    }

    // Insert new role-permission mappings with granular CRUD control
    if (permissions.length > 0) {
      const rolePermissions = permissions.map((perm) => ({
        role_id: roleId,
        permission_id: perm.permission_id,
        can_view: perm.can_view ?? false,
        can_create: perm.can_create ?? false,
        can_edit: perm.can_edit ?? false,
        can_delete: perm.can_delete ?? false,
        created_by: user.id
      }));

      const { error: insertError } = await supabase
        .from('role_permissions')
        .insert(rolePermissions);

      if (insertError) {

        return NextResponse.json(
          { error: 'Failed to assign permissions', details: insertError.message },
          { status: 500 }
        );
      }
    }

    // Invalidate permission cache for all users with this role
    invalidatePermissionCache();

    // Fetch updated role with permissions
    const { data: updatedRole } = await supabase
      .from('roles')
      .select(`
        *,
        role_permissions(
          id,
          permission_id,
          permissions(*)
        )
      `)
      .eq('id', roleId)
      .single();

    const roleWithPermissions = {
      ...(updatedRole as RoleRow & { role_permissions?: RolePermissionWithPermission[] | null }),
      permissions:
        (updatedRole as RoleRow & { role_permissions?: RolePermissionWithPermission[] | null })
          ?.role_permissions?.map((rp) => rp.permissions)
          .filter(Boolean) || []
    };

    return NextResponse.json({
      message: 'Permissions updated successfully',
      data: roleWithPermissions
    });
  } catch {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/rbac/roles/[id]/permissions - Remove specific permissions from role
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Require 'roles' edit permission
    const unauthorized = await requirePermission(RESOURCES.ROLES, 'edit');
    if (unauthorized) return unauthorized;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: roleId } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Parse request body
    const body = (await request.json()) as { permissionIds?: string[] };
    const { permissionIds } = body;

    if (!permissionIds || !Array.isArray(permissionIds)) {
      return NextResponse.json(
        { error: 'Invalid request', details: 'permissionIds must be an array' },
        { status: 400 }
      );
    }

    // Check if role exists and belongs to company
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id, is_system_role, company_id')
      .eq('id', roleId)
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .single();

    if (roleError || !role) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      );
    }

    // Prevent modifying system roles
    if (role.is_system_role) {
      return NextResponse.json(
        { error: 'Cannot modify system role', details: 'System role permissions cannot be changed' },
        { status: 403 }
      );
    }

    // Delete specified role-permission mappings
    const { error: deleteError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
      .in('permission_id', permissionIds);

    if (deleteError) {

      return NextResponse.json(
        { error: 'Failed to remove permissions', details: deleteError.message },
        { status: 500 }
      );
    }

    // Invalidate permission cache for all users with this role
    invalidatePermissionCache();

    // Fetch updated role with permissions
    const { data: updatedRole } = await supabase
      .from('roles')
      .select(`
        *,
        role_permissions(
          id,
          permission_id,
          permissions(*)
        )
      `)
      .eq('id', roleId)
      .single();

    const roleWithPermissions = {
      ...(updatedRole as RoleRow & { role_permissions?: RolePermissionWithPermission[] | null }),
      permissions:
        (updatedRole as RoleRow & { role_permissions?: RolePermissionWithPermission[] | null })
          ?.role_permissions?.map((rp) => rp.permissions)
          .filter(Boolean) || []
    };

    return NextResponse.json({
      message: 'Permissions removed successfully',
      data: roleWithPermissions
    });
  } catch {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
