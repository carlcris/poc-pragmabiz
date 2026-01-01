import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithBU } from '@/lib/supabase/server-with-bu';
import { requirePermission, getAuthenticatedUser } from '@/lib/auth';
import { RESOURCES } from '@/constants/resources';
import { invalidatePermissionCache } from '@/services/permissions/permissionResolver';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/rbac/permissions/[id] - Get single permission
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Require 'permissions' view permission
    const unauthorized = await requirePermission(RESOURCES.PERMISSIONS, 'view');
    if (unauthorized) return unauthorized;

    const { id } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Fetch permission
    const { data: permission, error } = await supabase
      .from('permissions')
      .select(`
        *,
        role_permissions(
          role_id,
          roles(
            id,
            name,
            company_id
          )
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !permission) {
      return NextResponse.json(
        { error: 'Permission not found' },
        { status: 404 }
      );
    }

    // Transform data
    const permissionWithRoles = {
      ...permission,
      roles: permission.role_permissions?.map((rp: any) => rp.roles).filter(Boolean) || []
    };

    return NextResponse.json({ data: permissionWithRoles });
  } catch (error) {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/rbac/permissions/[id] - Update permission flags
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Require 'permissions' edit permission
    const unauthorized = await requirePermission(RESOURCES.PERMISSIONS, 'edit');
    if (unauthorized) return unauthorized;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Parse request body
    const body = await request.json();
    const { description, can_view, can_create, can_edit, can_delete } = body;

    // Check if permission exists
    const { data: existingPermission, error: fetchError } = await supabase
      .from('permissions')
      .select('id, resource')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existingPermission) {
      return NextResponse.json(
        { error: 'Permission not found' },
        { status: 404 }
      );
    }

    // Update permission
    const updateData: any = {
      updated_by: user.id,
      updated_at: new Date().toISOString()
    };

    if (description !== undefined) updateData.description = description;
    if (can_view !== undefined) updateData.can_view = can_view;
    if (can_create !== undefined) updateData.can_create = can_create;
    if (can_edit !== undefined) updateData.can_edit = can_edit;
    if (can_delete !== undefined) updateData.can_delete = can_delete;

    const { data: updatedPermission, error: updateError } = await supabase
      .from('permissions')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        role_permissions(
          role_id,
          roles(
            id,
            name,
            company_id
          )
        )
      `)
      .single();

    if (updateError) {

      return NextResponse.json(
        { error: 'Failed to update permission', details: updateError.message },
        { status: 500 }
      );
    }

    // Invalidate permission cache for all users
    invalidatePermissionCache();

    // Transform data
    const permissionWithRoles = {
      ...updatedPermission,
      roles: updatedPermission.role_permissions?.map((rp: any) => rp.roles).filter(Boolean) || []
    };

    return NextResponse.json({ data: permissionWithRoles });
  } catch (error) {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/rbac/permissions/[id] - Delete permission
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Require 'permissions' delete permission
    const unauthorized = await requirePermission(RESOURCES.PERMISSIONS, 'delete');
    if (unauthorized) return unauthorized;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Check if permission exists
    const { data: permission, error: fetchError } = await supabase
      .from('permissions')
      .select('id, resource')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !permission) {
      return NextResponse.json(
        { error: 'Permission not found' },
        { status: 404 }
      );
    }

    // Check if permission is assigned to any roles
    const { data: rolePermissions, error: rolePermError } = await supabase
      .from('role_permissions')
      .select('id')
      .eq('permission_id', id)
      .limit(1);

    if (rolePermError) {

    }

    if (rolePermissions && rolePermissions.length > 0) {
      return NextResponse.json(
        {
          error: 'Permission is in use',
          details: 'Cannot delete permission that is assigned to roles. Please remove from all roles first.'
        },
        { status: 409 }
      );
    }

    // Soft delete permission
    const { error: deleteError } = await supabase
      .from('permissions')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id
      })
      .eq('id', id);

    if (deleteError) {

      return NextResponse.json(
        { error: 'Failed to delete permission', details: deleteError.message },
        { status: 500 }
      );
    }

    // Invalidate permission cache
    invalidatePermissionCache();

    return NextResponse.json({
      message: 'Permission deleted successfully',
      data: { id }
    });
  } catch (error) {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
