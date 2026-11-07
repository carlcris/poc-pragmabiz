import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { z } from "zod";

const querySchema = z
  .object({
    warehouseId: z.string().uuid(),
    parentId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(50),
  })
  .refine((query) => !query.locationId || (!query.parentId && query.page === 1), {
    message: "Exact location queries cannot include a parent or later page",
  });

async function GETHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requireAnyPermission([
      [RESOURCES.VIEW_LOCATION_STOCK, "view"],
      [RESOURCES.ITEMS, "view"],
    ]);
    if (unauthorized) return unauthorized;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { id } = await params;
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!z.string().uuid().safeParse(id).success || !parsed.success) {
      return NextResponse.json({ error: "Invalid item location stock query" }, { status: 400 });
    }
    const { data, error } = await context.supabase.rpc("get_item_location_stock_tree", {
      p_company_id: context.companyId,
      p_item_id: id,
      p_warehouse_id: parsed.data.warehouseId,
      p_business_unit_id: context.currentBusinessUnitId,
      p_parent_id: parsed.data.parentId,
      p_location_id: parsed.data.locationId,
      p_page: parsed.data.page,
      p_limit: parsed.data.limit,
    });
    if (error) {
      console.error("Failed to load item location stock tree", error);
      return NextResponse.json({ error: "Failed to load item location stock" }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Unexpected item location stock tree error", error);
    return NextResponse.json({ error: "Failed to load item location stock" }, { status: 500 });
  }
}
export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "items",
  route: "/api/items/[id]/location-stock-tree",
});
