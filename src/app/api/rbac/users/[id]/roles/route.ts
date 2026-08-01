import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { getAuthenticatedUser, checkPermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { invalidatePermissionCache } from "@/services/permissions/permissionResolver";
type RouteContext = {
  params: Promise<{ id: string }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const USER_ROLE_RPC_ERRORS = {
  USER_ROLE_UNAUTHORIZED: {
    error: "Authentication is required to manage user roles",
    status: 401,
  },
  USER_ROLE_FORBIDDEN: {
    error: "You do not have permission to manage roles for this business unit",
    status: 403,
  },
  USER_ROLE_TARGET_NOT_FOUND: { error: "User not found", status: 404 },
  USER_ROLE_ROLE_NOT_FOUND: { error: "Role not found", status: 404 },
  USER_ROLE_BUSINESS_UNIT_NOT_FOUND: {
    error: "Business unit not found",
    status: 404,
  },
  USER_ROLE_ALREADY_ASSIGNED: {
    error: "The user already has this role in the selected business unit",
    status: 409,
  },
  USER_ROLE_NOT_ASSIGNED: {
    error: "The role assignment no longer exists",
    status: 404,
  },
} as const;

type UserRoleRpcErrorCode = keyof typeof USER_ROLE_RPC_ERRORS;

const getUserRoleRpcErrorCode = (message: string): UserRoleRpcErrorCode | null => {
  const code = Object.keys(USER_ROLE_RPC_ERRORS).find((candidate) => message.includes(candidate));
  return (code as UserRoleRpcErrorCode | undefined) ?? null;
};

const userRoleRpcErrorResponse = (
  error: { message: string },
  fallback: { code: "USER_ROLE_ASSIGNMENT_FAILED" | "USER_ROLE_REMOVAL_FAILED"; error: string }
) => {
  const code = getUserRoleRpcErrorCode(error.message);
  if (code) {
    const mapped = USER_ROLE_RPC_ERRORS[code];
    return NextResponse.json({ error: mapped.error, code }, { status: mapped.status });
  }

  return NextResponse.json({ error: fallback.error, code: fallback.code }, { status: 500 });
};

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);

type UserRoleRow = {
  id: string;
  user_id: string;
  role_id: string;
  business_unit_id: string;
};
type RoleRow = {
  id: string;
  name: string;
  description: string | null;
};
type BusinessUnitRow = {
  id: string;
  name: string;
};

type UserRoleWithJoins = UserRoleRow & {
  roles?:
    | Pick<RoleRow, "id" | "name" | "description">
    | Pick<RoleRow, "id" | "name" | "description">[]
    | null;
  business_units?:
    | Pick<BusinessUnitRow, "id" | "name">
    | Pick<BusinessUnitRow, "id" | "name">[]
    | null;
};

// GET /api/rbac/users/[userId]/roles - Get user's roles
async function GETHandler(request: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const businessUnitId = searchParams.get("businessUnitId");

    // Users can always fetch their own roles.
    // Only check permission when requesting another user's roles to avoid an extra
    // permission RPC during login/self-bootstrap flows.
    if (userId !== user.id) {
      const canViewUsers = await checkPermission(RESOURCES.USERS, "view");
      if (!canViewUsers) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Verify target user exists and belongs to same company
    const { data: targetUser, error: userError } = await supabase
      .from("users")
      .select("id, company_id")
      .eq("id", userId)
      .is("deleted_at", null)
      .single();

    if (userError || !targetUser || targetUser.company_id !== user.companyId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Build query for user roles with business unit details
    let query = supabase
      .from("user_roles")
      .select(
        `
        id,
        role_id,
        business_unit_id,
        roles (
          id,
          name,
          description
        ),
        business_units (
          id,
          name
        )
      `
      )
      .eq("user_id", userId)
      .is("deleted_at", null);

    // Filter by business unit if specified
    if (businessUnitId) {
      query = query.eq("business_unit_id", businessUnitId);
    }

    const { data: userRoles, error: rolesError } = await query;

    if (rolesError) {
      console.error("Failed to fetch user roles", rolesError);
      return NextResponse.json({ error: "Failed to fetch user roles" }, { status: 500 });
    }

    // Transform data to include business unit info
    const roles = ((userRoles as UserRoleWithJoins[] | null) || []).map((ur) => {
      const role = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
      const businessUnit = Array.isArray(ur.business_units)
        ? ur.business_units[0]
        : ur.business_units;
      return {
        id: role?.id,
        name: role?.name,
        description: role?.description,
        business_unit_id: ur.business_unit_id,
        business_unit_name: businessUnit?.name || "Unknown Business Unit",
      };
    });

    return NextResponse.json({
      data: roles,
    });
  } catch (error: unknown) {
    console.error("Unexpected error while fetching user roles", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/rbac/users/[userId]/roles - Assign role to user
async function POSTHandler(request: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await context.params;
    const { supabase } = await createServerClientWithBU();

    const body: unknown = await request.json().catch(() => null);
    const roleId =
      typeof body === "object" && body !== null && "roleId" in body ? body.roleId : null;
    const businessUnitId =
      typeof body === "object" && body !== null && "businessUnitId" in body
        ? body.businessUnitId
        : null;

    if (!isUuid(userId) || !isUuid(roleId) || !isUuid(businessUnitId)) {
      return NextResponse.json(
        { error: "Select a valid role and business unit", code: "USER_ROLE_INVALID_REQUEST" },
        { status: 400 }
      );
    }

    const { error: assignmentError } = await supabase.rpc("assign_user_role_to_business_unit", {
      p_actor_user_id: user.id,
      p_company_id: user.companyId,
      p_target_user_id: userId,
      p_role_id: roleId,
      p_business_unit_id: businessUnitId,
    });

    if (assignmentError) {
      console.error("Failed to assign user role and business unit access", assignmentError);
      return userRoleRpcErrorResponse(assignmentError, {
        code: "USER_ROLE_ASSIGNMENT_FAILED",
        error: "The role could not be assigned. Try again.",
      });
    }

    // User role assignments directly change effective permissions.
    invalidatePermissionCache(userId);

    return NextResponse.json({
      message: "Role assigned successfully",
    });
  } catch (error: unknown) {
    console.error("Unexpected error while assigning a user role", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/rbac/users/[userId]/roles - Remove role from user
async function DELETEHandler(request: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const roleId = searchParams.get("roleId");
    const businessUnitId = searchParams.get("businessUnitId");

    if (!isUuid(userId) || !isUuid(roleId) || !isUuid(businessUnitId)) {
      return NextResponse.json(
        { error: "Select a valid role assignment", code: "USER_ROLE_INVALID_REQUEST" },
        { status: 400 }
      );
    }

    const { error: removalError } = await supabase.rpc("remove_user_role_from_business_unit", {
      p_actor_user_id: user.id,
      p_company_id: user.companyId,
      p_target_user_id: userId,
      p_role_id: roleId,
      p_business_unit_id: businessUnitId,
    });

    if (removalError) {
      console.error("Failed to remove user role and reconcile business unit access", removalError);
      return userRoleRpcErrorResponse(removalError, {
        code: "USER_ROLE_REMOVAL_FAILED",
        error: "The role could not be removed. Try again.",
      });
    }

    // User role assignments directly change effective permissions.
    invalidatePermissionCache(userId);

    return NextResponse.json({
      message: "Role removed successfully",
    });
  } catch (error: unknown) {
    console.error("Unexpected error while removing a user role", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "users",
  route: "/api/rbac/users/[id]/roles",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "assign_role",
  resourceType: "users",
  route: "/api/rbac/users/[id]/roles",
});
export const DELETE = withActivityLogging(DELETEHandler, {
  action: "remove_role",
  resourceType: "users",
  route: "/api/rbac/users/[id]/roles",
});
