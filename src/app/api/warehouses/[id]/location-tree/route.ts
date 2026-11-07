import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { requireAnyPermission, requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

const locationTreeQuerySchema = z.object({
  itemId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(500),
});

async function GETHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = locationTreeQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    if (!z.string().uuid().safeParse(id).success || !parsed.success) {
      return NextResponse.json({ error: "Invalid location tree query" }, { status: 400 });
    }
    const unauthorized = parsed.data.itemId
      ? await requireAnyPermission([
          [RESOURCES.VIEW_LOCATION_STOCK, "view"],
          [RESOURCES.ITEMS, "view"],
        ])
      : await requirePermission(RESOURCES.MANAGE_LOCATIONS, "view");
    if (unauthorized) return unauthorized;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    if (!context.currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }
    const { data, error } = await context.supabase.rpc("get_warehouse_location_tree_page", {
      p_company_id: context.companyId,
      p_warehouse_id: id,
      p_business_unit_id: context.currentBusinessUnitId,
      p_item_id: parsed.data.itemId,
      p_page: parsed.data.page,
      p_limit: parsed.data.limit,
    });
    if (error) {
      console.error("Failed to load warehouse location tree", error);
      return NextResponse.json({ error: "Failed to load locations" }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Unexpected warehouse location tree error", error);
    return NextResponse.json({ error: "Failed to load locations" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "warehouse_locations",
  route: "/api/warehouses/[id]/location-tree",
});
