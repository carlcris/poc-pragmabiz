import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type RouteContext = {
  params: Promise<{
    id: string;
    territoryId: string;
  }>;
};

// DELETE /api/employees/[id]/territories/[territoryId] - Remove territory
export const DELETE = async (req: NextRequest, context: RouteContext) => {
  try {
    await requirePermission(RESOURCES.EMPLOYEES, "delete");
    const { id, territoryId } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if this is the last territory
    const { count } = await supabase
      .from("employee_distribution_locations")
      .select("*", { count: "exact", head: true })
      .eq("employee_id", id)
      .is("deleted_at", null);

    if (count && count <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last territory. Employee must have at least one territory." },
        { status: 400 }
      );
    }

    // Soft delete territory
    const { data, error } = await supabase
      .from("employee_distribution_locations")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", territoryId)
      .eq("employee_id", id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete territory", details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Territory not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
};

// PUT /api/employees/[id]/territories/[territoryId] - Update territory
export const PUT = async (req: NextRequest, context: RouteContext) => {
  try {
    await requirePermission(RESOURCES.EMPLOYEES, "edit");
    const { id, territoryId } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // If setting as primary, unset other primary territories
    if (body.isPrimary) {
      await supabase
        .from("employee_distribution_locations")
        .update({ is_primary: false, updated_by: user.id })
        .eq("employee_id", id)
        .eq("is_primary", true)
        .neq("id", territoryId)
        .is("deleted_at", null);
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (body.city !== undefined) updateData.city = body.city;
    if (body.regionState !== undefined) updateData.region_state = body.regionState;
    if (body.isPrimary !== undefined) updateData.is_primary = body.isPrimary;
    if (body.notes !== undefined) updateData.notes = body.notes;

    // Update territory
    const { data, error } = await supabase
      .from("employee_distribution_locations")
      .update(updateData)
      .eq("id", territoryId)
      .eq("employee_id", id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update territory", details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Territory not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
};
