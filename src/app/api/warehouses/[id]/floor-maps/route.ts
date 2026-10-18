import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseFloorNumber } from "@/lib/validations/warehouse-floor-map";
import { getScopedWarehouse } from "@/services/warehouse-floor-map-service";

async function GETHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requirePermission(RESOURCES.WAREHOUSES, "view");
    if (denied)
      return denied.status === 401
        ? denied
        : NextResponse.json(
            {
              error: "You do not have permission to view warehouse floors",
              code: "FLOOR_MAP_PERMISSION_DENIED",
            },
            { status: 403 }
          );

    const { id } = await context.params;
    const scoped = await getScopedWarehouse(id);
    if (!scoped)
      return NextResponse.json(
        { error: "Warehouse not found", code: "WAREHOUSE_NOT_FOUND" },
        { status: 404 }
      );

    const params = request.nextUrl.searchParams;
    const page = Number(params.get("page") ?? "1");
    const limit = Number(params.get("limit") ?? "5");
    const search = (params.get("search") ?? "").trim();
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 100_000 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 50 ||
      search.length > 120
    ) {
      return NextResponse.json(
        { error: "Invalid floor search", code: "INVALID_FLOOR_MAP" },
        { status: 400 }
      );
    }

    let query = createAdminClient()
      .from("warehouse_floor_maps")
      .select("id, floor_number, name", { count: "exact" })
      .eq("company_id", scoped.companyId)
      .eq("warehouse_id", id)
      .order("floor_number", { ascending: true })
      .range((page - 1) * limit, page * limit - 1);
    if (search) {
      const normalizedSearch = search.replace(/[^\p{L}\p{N}\s-]/gu, " ");
      const floorNumber = parseFloorNumber(search);
      query =
        floorNumber === null
          ? query.ilike("name", `%${normalizedSearch}%`)
          : query.or(`floor_number.eq.${floorNumber},name.ilike.%${normalizedSearch}%`);
    }
    const { data, error, count } = await query;
    if (error) {
      console.error("Failed to list warehouse floors", error);
      return NextResponse.json(
        { error: "Failed to load warehouse floors", code: "FLOOR_MAP_LOAD_FAILED" },
        { status: 500 }
      );
    }
    return NextResponse.json({
      data: (data ?? []).map((floor) => ({
        id: floor.id,
        floorNumber: floor.floor_number,
        name: floor.name,
      })),
      pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    });
  } catch (error) {
    console.error("Unexpected warehouse floor request failure", error);
    return NextResponse.json(
      { error: "Warehouse floor request failed", code: "FLOOR_MAP_LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "warehouse_floor_maps",
  route: "/api/warehouses/[id]/floor-maps",
});
