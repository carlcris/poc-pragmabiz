import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";

async function GETHandler() {
  try {
    const unauthorized = await requirePermission(RESOURCES.LOAD_LISTS, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId } = context;

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("warehouses")
      .select("id, warehouse_code, warehouse_name")
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error resolving receiving warehouse:", error);
      return NextResponse.json({ error: "Failed to resolve receiving warehouse" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Receiving warehouse not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: data.id,
      warehouseId: data.id,
      code: data.warehouse_code,
      name: data.warehouse_name,
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "load_lists",
  route: "/api/load-lists/receiving-warehouse",
});
