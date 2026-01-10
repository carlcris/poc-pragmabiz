import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from '@/lib/auth';
import { RESOURCES } from '@/constants/resources';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// GET /api/employees/[id]/territories - Get employee territories
export const GET = async (
  req: NextRequest,
  context: RouteContext
) => {
  try {
    await requirePermission(RESOURCES.EMPLOYEES, 'view');
    const { id } = await context.params;
    const { supabase } = await createServerClientWithBU();

    const { data, error } = await supabase
      .from("employee_distribution_locations")
      .select("*")
      .eq("employee_id", id)
      .is("deleted_at", null)
      .order("is_primary", { ascending: false })
      .order("city", { ascending: true });

    if (error) {

      return NextResponse.json(
        { error: "Failed to fetch territories", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

// POST /api/employees/[id]/territories - Add territory to employee
export const POST = async (
  req: NextRequest,
  context: RouteContext
) => {
  try {
    await requirePermission(RESOURCES.EMPLOYEES, 'edit');
    const { id } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company_id
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const body = await req.json();

    // Validate required fields
    if (!body.city || !body.regionState) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["city", "regionState"],
        },
        { status: 400 }
      );
    }

    // Check if territory already exists for this employee
    const { data: existing } = await supabase
      .from("employee_distribution_locations")
      .select("id")
      .eq("employee_id", id)
      .eq("city", body.city)
      .eq("region_state", body.regionState)
      .is("deleted_at", null)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Territory already assigned to this employee" },
        { status: 409 }
      );
    }

    // If this is a primary territory, unset other primary territories
    if (body.isPrimary) {
      await supabase
        .from("employee_distribution_locations")
        .update({ is_primary: false, updated_by: user.id })
        .eq("employee_id", id)
        .eq("is_primary", true)
        .is("deleted_at", null);
    }

    // Insert territory
    const { data, error } = await supabase
      .from("employee_distribution_locations")
      .insert({
        company_id: userData.company_id,
        employee_id: id,
        city: body.city,
        region_state: body.regionState,
        is_primary: body.isPrimary || false,
        assigned_date: body.assignedDate || new Date().toISOString().split("T")[0],
        notes: body.notes || null,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) {

      return NextResponse.json(
        { error: "Failed to add territory", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};
