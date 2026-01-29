import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { getAuthenticatedUser, checkPermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { Tables } from "@/types/supabase";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UserRoleRow = Tables<"user_roles">;
type RoleRow = Tables<"roles">;
type BusinessUnitRow = Tables<"business_units">;

type UserRoleWithJoins = UserRoleRow & {
  roles?: Pick<RoleRow, "id" | "name" | "description"> | null;
  business_units?: Pick<BusinessUnitRow, "id" | "name"> | null;
};

// GET /api/rbac/users/[userId]/roles - Get user's roles
export async function GET(request: NextRequest, context: RouteContext) {
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

    // Check if user has permission to view other users' roles OR is viewing their own
    const canViewUsers = await checkPermission(RESOURCES.USERS, "view");
    if (userId !== user.id && !canViewUsers) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      return NextResponse.json({ error: "Failed to fetch user roles" }, { status: 500 });
    }

    // Transform data to include business unit info
    const roles = ((userRoles as UserRoleWithJoins[] | null) || []).map((ur) => ({
      id: ur.roles?.id,
      name: ur.roles?.name,
      description: ur.roles?.description,
      business_unit_id: ur.business_unit_id,
      business_unit_name: ur.business_units?.name || "Unknown Business Unit",
    }));

    return NextResponse.json({
      data: roles,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/rbac/users/[userId]/roles - Assign role to user
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to edit users
    const canEditUsers = await checkPermission(RESOURCES.USERS, "edit");
    if (!canEditUsers) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: userId } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Parse request body
    const body = await request.json();
    const { roleId, businessUnitId } = body;

    if (!roleId || !businessUnitId) {
      return NextResponse.json(
        { error: "Invalid request", details: "roleId and businessUnitId are required" },
        { status: 400 }
      );
    }

    // Verify target user exists and belongs to same company
    const { data: targetUser, error: userError } = await supabase
      .from("users")
      .select("id, company_id")
      .eq("id", userId)
      .eq("company_id", user.companyId)
      .is("deleted_at", null)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify role exists and belongs to same company
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("id, company_id")
      .eq("id", roleId)
      .eq("company_id", user.companyId)
      .is("deleted_at", null)
      .single();

    if (roleError || !role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Check if user already has this role for this business unit
    const { data: existing } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_id", roleId)
      .eq("business_unit_id", businessUnitId)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "User already has this role for this business unit" },
        { status: 409 }
      );
    }

    // Assign role to user
    const { error: insertError } = await supabase.from("user_roles").insert({
      user_id: userId,
      role_id: roleId,
      business_unit_id: businessUnitId,
      created_by: user.id,
      updated_by: user.id,
    });

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to assign role", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Role assigned successfully",
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/rbac/users/[userId]/roles - Remove role from user
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to edit users
    const canEditUsers = await checkPermission(RESOURCES.USERS, "edit");
    if (!canEditUsers) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: userId } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const roleId = searchParams.get("roleId");
    const businessUnitId = searchParams.get("businessUnitId");

    if (!roleId || !businessUnitId) {
      return NextResponse.json(
        { error: "Invalid request", details: "roleId and businessUnitId are required" },
        { status: 400 }
      );
    }

    // Verify target user exists and belongs to same company
    const { data: targetUser, error: userError } = await supabase
      .from("users")
      .select("id, company_id")
      .eq("id", userId)
      .eq("company_id", user.companyId)
      .is("deleted_at", null)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Remove role from user
    const { error: deleteError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role_id", roleId)
      .eq("business_unit_id", businessUnitId);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to remove role", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Role removed successfully",
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
