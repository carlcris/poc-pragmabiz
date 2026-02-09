import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission, getAuthenticatedUser } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
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
  role_id: string;
  permission_id: string;
  permissions?: PermissionRow | PermissionRow[] | null;
};

type RoleWithPermissions = RoleRow & {
  role_permissions?: Array<RolePermissionRow> | null;
};

// GET /api/rbac/roles - List all roles
export async function GET(request: NextRequest) {
  try {
    // Require 'roles' view permission
    const unauthorized = await requirePermission(RESOURCES.ROLES, "view");
    if (unauthorized) return unauthorized;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { supabase } = await createServerClientWithBU();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const includePermissions = searchParams.get("includePermissions") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Build query
    const selectQuery = includePermissions
      ? `
          *,
          role_permissions(
            permission_id,
            permissions(*)
          )
        `
      : "*";

    const rolesQuery = supabase.from("roles");
    let query = rolesQuery
      .select(selectQuery, { count: "exact" })
      .eq("company_id", user.companyId)
      .is("deleted_at", null)
      .order("is_system_role", { ascending: false })
      .order("name", { ascending: true });

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch roles", details: error.message },
        { status: 500 }
      );
    }

    // Transform data if permissions are included
    const rawRoles = Array.isArray(data) ? data : [];
    const roles = includePermissions
      ? (rawRoles as unknown as RoleWithPermissions[]).map((role) => ({
          ...role,
          permissions: (role.role_permissions || [])
            .flatMap((rp) => (Array.isArray(rp.permissions) ? rp.permissions : [rp.permissions]))
            .filter(Boolean),
        }))
      : rawRoles;

    return NextResponse.json({
      data: roles,
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

// POST /api/rbac/roles - Create new role
export async function POST(request: NextRequest) {
  try {
    // Require 'roles' create permission
    const unauthorized = await requirePermission(RESOURCES.ROLES, "create");
    if (unauthorized) return unauthorized;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { supabase } = await createServerClientWithBU();

    // Parse request body
    const body = await request.json();
    const { name, description, permissionIds } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Missing required field", details: "name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate role name
    const { data: existing } = await supabase
      .from("roles")
      .select("id")
      .eq("company_id", user.companyId)
      .eq("name", name)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Role name already exists", details: `Role "${name}" already exists` },
        { status: 409 }
      );
    }

    // Create role
    const { data: newRole, error: insertError } = await supabase
      .from("roles")
      .insert({
        company_id: user.companyId,
        name,
        description: description || null,
        is_system_role: false,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create role", details: insertError.message },
        { status: 500 }
      );
    }

    // Assign permissions if provided
    if (permissionIds && Array.isArray(permissionIds) && permissionIds.length > 0) {
      const rolePermissions = permissionIds.map((permissionId: string) => ({
        role_id: newRole.id,
        permission_id: permissionId,
        created_by: user.id,
      }));

      const { error: permError } = await supabase.from("role_permissions").insert(rolePermissions);

      if (permError) {
        // Role created but permissions failed - log but don't fail the request
      }
    }

    // Fetch role with permissions
    const { data: roleWithPermissions } = await supabase
      .from("roles")
      .select(
        `
        *,
        role_permissions(
          permission_id,
          permissions(*)
        )
      `
      )
      .eq("id", newRole.id)
      .single();

    return NextResponse.json({ data: roleWithPermissions }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
