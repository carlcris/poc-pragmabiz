import { NextResponse } from "next/server";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { RESOURCES } from "@/constants/resources";
import { getUserCapabilities, hasCapability } from "@/services/permissions/permissionResolver";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type RelatedRow = {
  company_id: string | null;
  deleted_at: string | null;
};

type BatchPrintRow = {
  id: string;
  item_id: string;
  location_id: string;
  batch_location_sku: string | null;
  qty_on_hand: number | string | null;
  item?:
    | (RelatedRow & { item_code: string | null; item_name: string | null })
    | (RelatedRow & { item_code: string | null; item_name: string | null })[]
    | null;
  item_batch?:
    | (RelatedRow & { batch_code: string | null; received_at: string | null })
    | (RelatedRow & { batch_code: string | null; received_at: string | null })[]
    | null;
  warehouse?:
    | (RelatedRow & {
        warehouse_code: string | null;
        business_unit_id: string | null;
      })
    | (RelatedRow & {
        warehouse_code: string | null;
        business_unit_id: string | null;
      })[]
    | null;
  location?:
    | (RelatedRow & { code: string | null })
    | (RelatedRow & { code: string | null })[]
    | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const one = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const toNumber = (value: number | string | null) => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

async function GETHandler(_request: Request, routeContext: RouteContext) {
  try {
    const context = await requireRequestContext();
    if ("status" in context) return context;

    const capabilities = await getUserCapabilities(context.userId, context.currentBusinessUnitId);
    const canPrintBatchQr =
      hasCapability(capabilities, RESOURCES.ITEMS, "view") &&
      hasCapability(capabilities, GRANULAR_CAPABILITIES.ITEM_BATCH_QR_PRINT, "view");
    if (!canPrintBatchQr) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await routeContext.params;
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: "Invalid batch location" }, { status: 400 });
    }

    const { data, error } = await context.supabase
      .from("item_batch_locations")
      .select(
        `
        id,
        item_id,
        location_id,
        batch_location_sku,
        qty_on_hand,
        item:items!item_batch_locations_item_id_fkey(
          item_code,
          item_name,
          company_id,
          deleted_at
        ),
        item_batch:item_batches!item_batch_locations_item_batch_id_fkey(
          batch_code,
          received_at,
          company_id,
          deleted_at
        ),
        warehouse:warehouses!item_batch_locations_warehouse_id_fkey(
          warehouse_code,
          business_unit_id,
          company_id,
          deleted_at
        ),
        location:warehouse_locations!item_batch_locations_location_id_fkey(
          code,
          company_id,
          deleted_at
        )
      `
      )
      .eq("id", id)
      .eq("company_id", context.companyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("Failed to load item batch QR label", error);
      return NextResponse.json({ error: "Failed to load batch QR label" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Batch location not found" }, { status: 404 });
    }

    const row = data as unknown as BatchPrintRow;
    const item = one(row.item);
    const batch = one(row.item_batch);
    const warehouse = one(row.warehouse);
    const location = one(row.location);
    const relatedRows = [item, batch, warehouse, location];
    const isInScope =
      relatedRows.every(
        (related) => related?.company_id === context.companyId && related.deleted_at === null
      ) &&
      (!context.currentBusinessUnitId ||
        warehouse?.business_unit_id === context.currentBusinessUnitId);

    if (!isInScope) {
      return NextResponse.json({ error: "Batch location not found" }, { status: 404 });
    }
    if (
      !row.batch_location_sku ||
      !item?.item_code ||
      !item.item_name ||
      !batch?.batch_code ||
      !batch.received_at ||
      !warehouse?.warehouse_code ||
      !location?.code
    ) {
      return NextResponse.json({ error: "Batch QR label is unavailable" }, { status: 409 });
    }

    return NextResponse.json({
      data: {
        batchLocationId: row.id,
        itemId: row.item_id,
        batchLocationSku: row.batch_location_sku,
        batchCode: batch.batch_code,
        receivedAt: batch.received_at,
        qtyOnHand: toNumber(row.qty_on_hand),
        itemCode: item.item_code,
        itemName: item.item_name,
        warehouseCode: warehouse.warehouse_code,
        locationId: row.location_id,
        locationCode: location.code,
      },
    });
  } catch (error) {
    console.error("Unexpected item batch QR label error", error);
    return NextResponse.json({ error: "Failed to load batch QR label" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "item_batch_locations",
  route: "/api/item-batch-locations/[id]/print-label",
});
