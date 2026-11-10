import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { itemBatchExpirationSchema } from "@/lib/item-batch-expiration";

type RouteContext = { params: Promise<{ id: string; batchLocationId: string }> };
const notFound = () =>
  NextResponse.json(
    {
      error: "This batch is no longer available. Refresh and select it again.",
      code: "BATCH_EXPIRATION_NOT_FOUND",
    },
    { status: 404 }
  );

async function PATCHHandler(request: NextRequest, { params }: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "edit");
    if (unauthorized)
      return NextResponse.json(
        { error: "You cannot edit batch expiration dates.", code: "BATCH_EXPIRATION_FORBIDDEN" },
        { status: unauthorized.status }
      );
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { id, batchLocationId } = await params;
    const body = itemBatchExpirationSchema.safeParse(await request.json().catch(() => null));
    if (
      !z.uuid().safeParse(id).success ||
      !z.uuid().safeParse(batchLocationId).success ||
      !body.success
    ) {
      return NextResponse.json(
        { error: "Enter a valid expiration date or clear it.", code: "BATCH_EXPIRATION_INVALID" },
        { status: 400 }
      );
    }
    const { supabase, companyId, userId, currentBusinessUnitId, accessibleBusinessUnitIds } =
      context;
    let sourceQuery = supabase
      .from("item_batch_locations")
      .select(
        "item_batch_id, warehouse_id, warehouse:warehouses!inner(business_unit_id), item:items!inner(id)"
      )
      .eq("id", batchLocationId)
      .eq("item_id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .is("warehouse.deleted_at", null)
      .is("item.deleted_at", null)
      .in("warehouse.business_unit_id", accessibleBusinessUnitIds);
    if (currentBusinessUnitId)
      sourceQuery = sourceQuery.eq("warehouse.business_unit_id", currentBusinessUnitId);
    const { data: source, error: sourceError } = await sourceQuery.maybeSingle();
    if (sourceError) throw sourceError;
    if (!source) return notFound();

    const { data: updated, error } = await supabase
      .from("item_batches")
      .update({ expiration_date: body.data.expirationDate, updated_by: userId })
      .eq("id", source.item_batch_id)
      .eq("item_id", id)
      .eq("company_id", companyId)
      .eq("warehouse_id", source.warehouse_id)
      .is("deleted_at", null)
      .select("id, expiration_date")
      .maybeSingle();
    if (error) throw error;
    if (!updated) return notFound();
    return NextResponse.json({ expirationDate: updated.expiration_date });
  } catch (error) {
    console.error("Failed to update item batch expiration", error);
    return NextResponse.json(
      { error: "Could not save the expiration date. Try again." },
      { status: 500 }
    );
  }
}
export const PATCH = withActivityLogging(PATCHHandler, {
  action: "update",
  resourceType: "items",
  route: "/api/items/[id]/batch-locations/[batchLocationId]/expiration",
});
