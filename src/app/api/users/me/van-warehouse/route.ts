import { NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

export async function GET() {
  try {
    // Check permission first
    const unauthorized = await requirePermission(RESOURCES.WAREHOUSES, "view");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's van warehouse assignment and employee ID
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select(
        `
        id,
        first_name,
        last_name,
        email,
        van_warehouse_id,
        employee_id,
        warehouses!van_warehouse_id (
          id,
          warehouse_code,
          warehouse_name,
          is_van
        )
      `
      )
      .eq("id", user.id)
      .single();

    if (userError) {
      return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
    }

    // Concatenate first and last name
    const fullName = [userData.first_name, userData.last_name].filter(Boolean).join(" ") || "User";

    const vanWarehouse = Array.isArray(userData.warehouses)
      ? userData.warehouses[0] ?? null
      : userData.warehouses ?? null;

    // Return user data with van warehouse info and employee ID
    return NextResponse.json({
      data: {
        userId: userData.id,
        fullName,
        email: userData.email,
        employeeId: userData.employee_id,
        vanWarehouseId: userData.van_warehouse_id,
        vanWarehouse: vanWarehouse
          ? {
              id: vanWarehouse.id,
              code: vanWarehouse.warehouse_code,
              name: vanWarehouse.warehouse_name,
              isVan: vanWarehouse.is_van,
            }
          : null,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Endpoint to assign/unassign van warehouse to user
export async function PATCH(request: Request) {
  try {
    // Check permission first
    const unauthorized = await requirePermission(RESOURCES.WAREHOUSES, "edit");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { van_warehouse_id } = body;

    // Validate that the warehouse is actually a van warehouse (if provided)
    if (van_warehouse_id) {
      const { data: warehouse, error: warehouseError } = await supabase
        .from("warehouses")
        .select("id, is_van")
        .eq("id", van_warehouse_id)
        .single();

      if (warehouseError || !warehouse) {
        return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
      }

      if (!warehouse.is_van) {
        return NextResponse.json({ error: "Warehouse is not a van warehouse" }, { status: 400 });
      }
    }

    // Update user's van warehouse assignment
    const { error: updateError } = await supabase
      .from("users")
      .update({ van_warehouse_id: van_warehouse_id || null })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update van warehouse assignment" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: van_warehouse_id
        ? "Van warehouse assigned successfully"
        : "Van warehouse unassigned successfully",
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
