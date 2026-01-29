import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission, getAuthenticatedUser } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// GET /api/rbac/users - List all users in the company
export async function GET(request: NextRequest) {
  try {
    // Require 'users' view permission
    const unauthorized = await requirePermission(RESOURCES.USERS, "view");
    if (unauthorized) return unauthorized;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { supabase } = await createServerClientWithBU();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Build query
    let query = supabase
      .from("users")
      .select("*", { count: "exact" })
      .eq("company_id", user.companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // Apply search filter
    if (search) {
      query = query.or(
        `email.ilike.%${search}%,username.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`
      );
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch users", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
