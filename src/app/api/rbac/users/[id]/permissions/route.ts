import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission, getAuthenticatedUser } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { getUserPermissions } from "@/services/permissions/permissionResolver";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/rbac/users/[userId]/permissions - Get user's effective permissions
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

    // Users can always fetch their own permissions
    // For other users, require 'users' view permission
    if (userId !== user.id) {
      const unauthorized = await requirePermission(RESOURCES.USERS, "view");
      if (unauthorized) return unauthorized;
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

    // Get aggregated permissions for the user
    const permissions = await getUserPermissions(userId, businessUnitId || null);

    // Transform to array format for easier display
    const permissionsArray = Object.entries(permissions).map(([resource, perms]) => ({
      resource,
      ...perms,
    }));

    // SECURITY: Add cache-control headers to prevent caching of permission data
    // Permissions are security-critical and must always be fresh
    const response = NextResponse.json({
      data: {
        userId,
        businessUnitId: businessUnitId || null,
        permissions: permissionsArray,
      },
    });

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
