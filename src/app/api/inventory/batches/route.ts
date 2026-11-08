import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import type { Database } from "@/types/database.types";
import { RESOURCES } from "@/constants/resources";

const querySchema = z.object({
  itemId: z.uuid(),
  warehouseId: z.uuid(),
  locationId: z.uuid(),
  exactBatchCode: z.string().trim().min(1).max(150).optional(),
  search: z.string().trim().max(150).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_ADJUSTMENTS, "view");
    if (unauthorized) return unauthorized;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid batch search parameters" }, { status: 400 });
    }
    const { supabase, companyId, currentBusinessUnitId } = context;
    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Select a business unit" }, { status: 400 });
    }
    const { itemId, warehouseId, locationId, search, limit, exactBatchCode } = parsed.data;
    const { data: location, error: locationError } = await supabase
      .from("warehouse_locations")
      .select("id, code, name, warehouses!inner(business_unit_id)")
      .eq("company_id", companyId)
      .eq("warehouse_id", warehouseId)
      .eq("warehouses.business_unit_id", currentBusinessUnitId)
      .eq("id", locationId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (locationError) throw locationError;
    if (!location) {
      return NextResponse.json(
        { error: "Select an active location in this business unit" },
        { status: 400 }
      );
    }
    if (exactBatchCode !== undefined) {
      const { data, error } = await supabase
        .from("item_batches")
        .select("id")
        .eq("company_id", companyId)
        .eq("warehouse_id", warehouseId)
        .eq("batch_code", exactBatchCode)
        .is("deleted_at", null)
        .limit(1);
      if (error) throw error;
      return NextResponse.json({ exists: Boolean(data?.length) });
    }
    const { data, error } = await supabase.rpc("search_stock_adjustment_batches", {
      p_company_id: companyId,
      p_item_id: itemId,
      p_warehouse_id: warehouseId,
      p_location_id: locationId,
      p_search: search,
      p_limit: limit,
    });
    if (error) throw error;
    const batches = (data ??
      []) as Database["public"]["Functions"]["search_stock_adjustment_batches"]["Returns"];
    return NextResponse.json({
      data: batches.map((batch) => {
        return {
          id: batch.item_batch_location_id ?? batch.item_batch_id,
          itemBatchLocationId: batch.item_batch_location_id ?? null,
          itemBatchId: batch.item_batch_id,
          itemId,
          warehouseId,
          locationId,
          batchCode: batch.batch_code,
          receivedAt: batch.received_at,
          batchLocationSku: batch.batch_location_sku ?? "",
          qtyOnHand: Number(batch.qty_on_hand ?? 0),
          qtyAvailable: Number(batch.qty_available ?? 0),
          qtyReserved: Number(batch.qty_reserved ?? 0),
          locationCode: location.code,
          locationName: location.name,
        };
      }),
    });
  } catch (error) {
    console.error("Error searching adjustment batches:", error);
    return NextResponse.json({ error: "Failed to load item batches" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "inventory",
  route: "/api/inventory/batches",
});
