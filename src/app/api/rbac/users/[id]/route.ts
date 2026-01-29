import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission, getAuthenticatedUser } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/rbac/users/[id] - Get user details
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // Require 'users' view permission
    const unauthorized = await requirePermission(RESOURCES.USERS, "view");
    if (unauthorized) return unauthorized;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Fetch user
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .eq("company_id", user.companyId)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/rbac/users/[id] - Update user (e.g., toggle active status)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    // Require 'users' edit permission
    const unauthorized = await requirePermission(RESOURCES.USERS, "edit");
    if (unauthorized) return unauthorized;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Parse request body
    const body = await request.json();
    const { is_active } = body;

    // Check if user exists and belongs to company
    const { data: existingUser, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .eq("company_id", user.companyId)
      .is("deleted_at", null)
      .single();

    if (userError || !existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update user
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({
        is_active,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update user", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
