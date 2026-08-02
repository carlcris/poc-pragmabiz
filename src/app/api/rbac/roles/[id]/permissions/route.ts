import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission, getAuthenticatedUser } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { ROLE_PERMISSION_MUTATION_ERROR_CODES } from "@/constants/granular-permissions";
import { invalidatePermissionCache } from "@/services/permissions/permissionResolver";
import { z } from "zod";
type RouteContext = {
  params: Promise<{ id: string }>;
};

type RoleRow = {
  id: string;
  name?: string;
  company_id: string;
  is_system_role?: boolean;
};
type PermissionRow = {
  id: string;
  resource?: string;
  description?: string | null;
  can_view?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
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

type RolePermissionInput = {
  permission_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

type UserRoleNameJoinRow = {
  roles?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

const normalizeRoleName = (value: string | null | undefined) =>
  (value || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

const isSuperAdminRoleName = (value: string | null | undefined) =>
  ["super admin", "superadmin"].includes(normalizeRoleName(value).replace(/\s/g, ""));

const rolePermissionInputSchema = z
  .object({
    permission_id: z.string().uuid(),
    can_view: z.boolean(),
    can_create: z.boolean(),
    can_edit: z.boolean(),
    can_delete: z.boolean(),
  })
  .strict();

const replaceRolePermissionsSchema = z
  .object({
    permissions: z.array(rolePermissionInputSchema).max(500),
  })
  .strict();

const permissionIdsSchema = z.array(z.string().uuid()).min(1).max(500);

const ROLE_WITH_PERMISSIONS_SELECT = `
  id,
  company_id,
  name,
  description,
  is_system_role,
  created_at,
  updated_at,
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
`;

const toRoleWithPermissions = (updatedRole: unknown) => {
  const role = updatedRole as RoleRow & {
    role_permissions?: RolePermissionWithPermission[] | null;
  };

  return {
    ...role,
    permissions:
      role.role_permissions?.map((rolePermission) => {
        const permission = Array.isArray(rolePermission.permissions)
          ? rolePermission.permissions[0]
          : rolePermission.permissions;

        return {
          permission_id: rolePermission.permission_id,
          resource: permission?.resource,
          description: permission?.description,
          can_view: rolePermission.can_view,
          can_create: rolePermission.can_create,
          can_edit: rolePermission.can_edit,
          can_delete: rolePermission.can_delete,
        };
      }) || [],
  };
};

const rolePermissionMutationErrorResponse = (message: string) => {
  const isViewDependencyFailure = [
    "ROLE_PERMISSION_PARENT_VIEW_REQUIRED",
    "ROLE_PERMISSION_VIEW_REQUIRED",
  ].some((code) => message.includes(code));

  if (isViewDependencyFailure) {
    return NextResponse.json(
      {
        error: "Invalid permission assignment",
        code: ROLE_PERMISSION_MUTATION_ERROR_CODES.VIEW_REQUIRED,
      },
      { status: 400 }
    );
  }

  const isInvalidPermissionSet = [
    "ROLE_PERMISSION_DUPLICATE_PERMISSION",
    "ROLE_PERMISSION_INVALID_PAYLOAD",
    "ROLE_PERMISSION_INVALID_PERMISSION",
  ].some((code) => message.includes(code));

  if (isInvalidPermissionSet) {
    return NextResponse.json(
      {
        error: "Invalid permission assignment",
        code: ROLE_PERMISSION_MUTATION_ERROR_CODES.INVALID_ASSIGNMENT,
      },
      { status: 400 }
    );
  }

  if (message.includes("ROLE_PERMISSION_ROLE_NOT_FOUND")) {
    return NextResponse.json(
      {
        error: "Role not found",
        code: ROLE_PERMISSION_MUTATION_ERROR_CODES.ROLE_NOT_FOUND,
      },
      { status: 404 }
    );
  }

  if (
    message.includes("ROLE_PERMISSION_FORBIDDEN") ||
    message.includes("ROLE_PERMISSION_SYSTEM_ROLE_FORBIDDEN")
  ) {
    return NextResponse.json(
      { error: "Forbidden", code: ROLE_PERMISSION_MUTATION_ERROR_CODES.FORBIDDEN },
      { status: 403 }
    );
  }

  return NextResponse.json(
    {
      error: "Failed to update permissions",
      code: ROLE_PERMISSION_MUTATION_ERROR_CODES.UPDATE_FAILED,
    },
    { status: 500 }
  );
};

async function hasSuperAdminRole(
  supabase: Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"],
  userId: string
): Promise<boolean> {
  // Prefer auth metadata role if available (not subject to user_roles table visibility quirks)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isSuperAdminRoleName(user?.user_metadata?.role as string | undefined)) {
    return true;
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select(
      `
      roles (
        name
      )
    `
    )
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (error || !data) {
    return false;
  }

  return (data as UserRoleNameJoinRow[]).some((row) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return isSuperAdminRoleName(role?.name);
  });
}

// POST /api/rbac/roles/[id]/permissions - Assign permissions to role
async function POSTHandler(request: NextRequest, context: RouteContext) {
  try {
    // Require 'roles' edit permission
    const unauthorized = await requirePermission(RESOURCES.ROLES, "edit");
    if (unauthorized) return unauthorized;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: roleId } = await context.params;
    const { supabase } = await createServerClientWithBU();

    const parsed = replaceRolePermissionsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid permission assignment",
          code: ROLE_PERMISSION_MUTATION_ERROR_CODES.INVALID_ASSIGNMENT,
        },
        { status: 400 }
      );
    }
    const permissions: RolePermissionInput[] = parsed.data.permissions;

    // Check if role exists and belongs to company
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("id, is_system_role, company_id")
      .eq("id", roleId)
      .eq("company_id", user.companyId)
      .is("deleted_at", null)
      .single();

    if (roleError || !role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const userIsSuperAdmin = await hasSuperAdminRole(supabase, user.id);

    // Prevent modifying system roles
    if (role.is_system_role && !userIsSuperAdmin) {
      return NextResponse.json(
        {
          error: "Cannot modify system role",
          details: "System role permissions cannot be changed",
        },
        { status: 403 }
      );
    }

    const { error: saveError } = await supabase.rpc("save_role_permissions", {
      p_actor_user_id: user.id,
      p_business_unit_id: user.businessUnitId ?? undefined,
      p_company_id: user.companyId,
      p_permissions: permissions,
      p_role_id: roleId,
    });

    if (saveError) {
      console.error("Failed to save role permissions:", saveError);
      return rolePermissionMutationErrorResponse(saveError.message);
    }

    // Invalidate permission cache for all users with this role
    invalidatePermissionCache();

    // Fetch updated role with permissions
    const { data: updatedRole, error: updatedRoleError } = await supabase
      .from("roles")
      .select(ROLE_WITH_PERMISSIONS_SELECT)
      .eq("id", roleId)
      .single();

    if (updatedRoleError || !updatedRole) {
      console.error("Failed to load the updated role permissions:", updatedRoleError);
      return NextResponse.json({ error: "Failed to load updated permissions" }, { status: 500 });
    }

    return NextResponse.json({
      message: "Permissions updated successfully",
      data: toRoleWithPermissions(updatedRole),
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/rbac/roles/[id]/permissions - Remove specific permissions from role
async function DELETEHandler(request: NextRequest, context: RouteContext) {
  try {
    // Require 'roles' edit permission
    const unauthorized = await requirePermission(RESOURCES.ROLES, "edit");
    if (unauthorized) return unauthorized;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: roleId } = await context.params;
    const { supabase } = await createServerClientWithBU();

    const permissionIds = request.nextUrl.searchParams
      .get("permissionIds")
      ?.split(",")
      .filter(Boolean);
    const parsedPermissionIds = permissionIdsSchema.safeParse(permissionIds);
    if (!parsedPermissionIds.success) {
      return NextResponse.json(
        {
          error: "Invalid permission assignment",
          code: ROLE_PERMISSION_MUTATION_ERROR_CODES.INVALID_ASSIGNMENT,
        },
        { status: 400 }
      );
    }

    // Check if role exists and belongs to company
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("id, is_system_role, company_id")
      .eq("id", roleId)
      .eq("company_id", user.companyId)
      .is("deleted_at", null)
      .single();

    if (roleError || !role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const userIsSuperAdmin = await hasSuperAdminRole(supabase, user.id);

    // Prevent modifying system roles
    if (role.is_system_role && !userIsSuperAdmin) {
      return NextResponse.json(
        {
          error: "Cannot modify system role",
          details: "System role permissions cannot be changed",
        },
        { status: 403 }
      );
    }

    const { error: removeError } = await supabase.rpc("remove_role_permissions", {
      p_actor_user_id: user.id,
      p_business_unit_id: user.businessUnitId ?? undefined,
      p_company_id: user.companyId,
      p_permission_ids: parsedPermissionIds.data,
      p_role_id: roleId,
    });

    if (removeError) {
      console.error("Failed to remove role permissions:", removeError);
      return rolePermissionMutationErrorResponse(removeError.message);
    }

    // Invalidate permission cache for all users with this role
    invalidatePermissionCache();

    // Fetch updated role with permissions
    const { data: updatedRole, error: updatedRoleError } = await supabase
      .from("roles")
      .select(ROLE_WITH_PERMISSIONS_SELECT)
      .eq("id", roleId)
      .single();

    if (updatedRoleError || !updatedRole) {
      console.error("Failed to load the updated role permissions:", updatedRoleError);
      return NextResponse.json({ error: "Failed to load updated permissions" }, { status: 500 });
    }

    return NextResponse.json({
      message: "Permissions removed successfully",
      data: toRoleWithPermissions(updatedRole),
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "assign_permission",
  resourceType: "roles",
  route: "/api/rbac/roles/[id]/permissions",
});
export const DELETE = withActivityLogging(DELETEHandler, {
  action: "remove_permission",
  resourceType: "roles",
  route: "/api/rbac/roles/[id]/permissions",
});
