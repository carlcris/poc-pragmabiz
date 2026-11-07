import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requireAnyPermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";

async function GETHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requireAnyPermission([
      [RESOURCES.ITEMS, "view"],
      [RESOURCES.VIEW_LOCATION_STOCK, "view"],
    ]);
    if (denied) return denied;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { id } = await params;
    const floorMapId = request.nextUrl.searchParams.get("floorMapId");
    if (
      !z.string().uuid().safeParse(id).success ||
      !z.string().uuid().safeParse(floorMapId).success
    ) {
      return NextResponse.json({ error: "Invalid item or floor" }, { status: 400 });
    }
    const { data: floor, error: floorError } = await context.supabase
      .from("warehouse_floor_maps")
      .select("id, warehouse:warehouses!inner(business_unit_id)")
      .eq("id", floorMapId!)
      .eq("company_id", context.companyId)
      .eq("warehouse.business_unit_id", context.currentBusinessUnitId)
      .maybeSingle();
    if (floorError) throw floorError;
    if (!floor) return NextResponse.json({ error: "Floor not found" }, { status: 404 });
    const { data, error } = await context.supabase.rpc("get_item_floor_stock", {
      p_company_id: context.companyId,
      p_item_id: id,
      p_floor_map_id: floor.id,
    });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to load item floor stock", error);
    return NextResponse.json({ error: "Failed to load item floor stock" }, { status: 500 });
  }
}
export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "items",
  route: "/api/items/[id]/location-map-stock",
});
