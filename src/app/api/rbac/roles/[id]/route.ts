import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission, getAuthenticatedUser } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { invalidatePermissionCache } from "@/services/permissions/permissionResolver";
type RouteContext = {
  params: Promise<{ id: string }>;
};

type RoleRow = {
  id: string;
  name?: string;
  description?: string | null;
  company_id: string;
  is_system_role?: boolean;
};
type PermissionRow = {
  id: string;
  resource?: string;
  description?: string | null;
};
type RolePermissionRow = {
  id?: string;
  role_id?: string;
  permission_id: string;
  can_view?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  permissions?: PermissionRow | PermissionRow[] | null;
};

type RolePermissionWithPermission = RolePermissionRow;

type RoleWithPermissions = RoleRow & {
  role_permissions?: RolePermissionWithPermission[] | null;
};

// GET /api/rbac/roles/[id] - Get single role with permissions
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // Require 'roles' view permission
    const unauthorized = await requirePermission(RESOURCES.ROLES, "view");
    if (unauthorized) return unauthorized;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Fetch role with permissions
    const { data: role, error } = await supabase
      .from("roles")
      .select(
        `
        *,
        role_permissions(
          id,
          permission_id,
          can_view,
          can_create,
          can_edit,
          can_delete,
          permissions(
            id,
            resource,
            description
          )
        )
      `
      )
      .eq("id", id)
      .eq("company_id", user.companyId)
      .is("deleted_at", null)
      .single();

    if (error || !role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Transform data to include CRUD flags from role_permissions
    const roleWithPermissions = {
      ...(role as RoleWithPermissions),
      permissions: ((role as RoleWithPermissions).role_permissions || []).map((rp) => {
        const permission = Array.isArray(rp.permissions) ? rp.permissions[0] : rp.permissions;
        return {
          permission_id: rp.permission_id,
          resource: permission?.resource,
          description: permission?.description,
          can_view: rp.can_view,
          can_create: rp.can_create,
          can_edit: rp.can_edit,
          can_delete: rp.can_delete,
        };
      }),
    };

    return NextResponse.json({ data: roleWithPermissions });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/rbac/roles/[id] - Update role
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    // Require 'roles' edit permission
    const unauthorized = await requirePermission(RESOURCES.ROLES, "edit");
    if (unauthorized) return unauthorized;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Parse request body
    const body = await request.json();
    const { name, description } = body;

    // Check if role exists and belongs to company
    const { data: existingRole, error: fetchError } = await supabase
      .from("roles")
      .select("id, is_system_role, name")
      .eq("id", id)
      .eq("company_id", user.companyId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingRole) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Prevent editing system roles
    if (existingRole.is_system_role) {
      return NextResponse.json(
        { error: "Cannot edit system role", details: "System roles cannot be modified" },
        { status: 403 }
      );
    }

    // Check for duplicate name if name is being changed
    if (name && name !== existingRole.name) {
      const { data: duplicate } = await supabase
        .from("roles")
        .select("id")
        .eq("company_id", user.companyId)
        .eq("name", name)
        .neq("id", id)
        .is("deleted_at", null)
        .maybeSingle();

      if (duplicate) {
        return NextResponse.json(
          { error: "Role name already exists", details: `Role "${name}" already exists` },
          { status: 409 }
        );
      }
    }

    // Update role
    const { data: updatedRole, error: updateError } = await supabase
      .from("roles")
      .update({
        name: name || existingRole.name,
        description: description !== undefined ? description : undefined,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        `
        *,
        role_permissions(
          id,
          permission_id,
          permissions(*)
        )
      `
      )
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update role", details: updateError.message },
        { status: 500 }
      );
    }

    // Invalidate permission cache for all users with this role
    invalidatePermissionCache();

    // Transform data
    const roleWithPermissions = {
      ...(updatedRole as RoleWithPermissions),
      permissions: ((updatedRole as RoleWithPermissions).role_permissions || [])
        .flatMap((rp) => (Array.isArray(rp.permissions) ? rp.permissions : [rp.permissions]))
        .filter(Boolean),
    };

    return NextResponse.json({ data: roleWithPermissions });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/rbac/roles/[id] - Delete role
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    // Require 'roles' delete permission
    const unauthorized = await requirePermission(RESOURCES.ROLES, "delete");
    if (unauthorized) return unauthorized;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Check if role exists and belongs to company
    const { data: role, error: fetchError } = await supabase
      .from("roles")
      .select("id, is_system_role, name")
      .eq("id", id)
      .eq("company_id", user.companyId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Prevent deleting system roles
    if (role.is_system_role) {
      return NextResponse.json(
        { error: "Cannot delete system role", details: "System roles cannot be deleted" },
        { status: 403 }
      );
    }

    // Check if role is assigned to any users
    const { data: userRoles, error: userRoleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("role_id", id)
      .is("deleted_at", null)
      .limit(1);

    if (userRoleError) {
    }

    if (userRoles && userRoles.length > 0) {
      return NextResponse.json(
        {
          error: "Role is in use",
          details:
            "Cannot delete role that is assigned to users. Please remove all user assignments first.",
        },
        { status: 409 }
      );
    }

    // Soft delete role
    const { error: deleteError } = await supabase
      .from("roles")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete role", details: deleteError.message },
        { status: 500 }
      );
    }

    // Invalidate permission cache
    invalidatePermissionCache();

    return NextResponse.json({
      message: "Role deleted successfully",
      data: { id },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
