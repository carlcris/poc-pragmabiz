import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  ensurePickListActorAuthorized,
  fetchPickListHeader,
  getPickListAuthContext,
} from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const scanValidationError = (error: string) =>
  NextResponse.json({
    error,
    data: null,
  });

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

// GET /api/pick-lists/[id]/scan-source?batchLocationSku=1234567890[&itemId=...&locationId=...&batchCode=...]
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const auth = await getPickListAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const batchLocationSku = request.nextUrl.searchParams.get("batchLocationSku")?.trim();
    const scannedItemId = request.nextUrl.searchParams.get("itemId")?.trim() || null;
    const scannedLocationId = request.nextUrl.searchParams.get("locationId")?.trim() || null;
    const scannedBatchCode = request.nextUrl.searchParams.get("batchCode")?.trim() || null;
    if (!batchLocationSku) {
      return NextResponse.json({ error: "batchLocationSku is required" }, { status: 400 });
    }

    const header = await fetchPickListHeader(auth.supabase, auth.companyId, id);
    if (!header) {
      return NextResponse.json({ error: "Pick list not found" }, { status: 404 });
    }

    const permission = await ensurePickListActorAuthorized(
      auth.supabase,
      auth.companyId,
      header.business_unit_id,
      id,
      auth.userId
    );

    if (!permission.ok) {
      return NextResponse.json({ error: permission.error }, { status: 403 });
    }

    const { data: sourceRow, error: sourceError } = await auth.supabase
      .from("item_location_batch")
      .select(
        `
        id,
        item_id,
        warehouse_id,
        location_id,
        qty_on_hand,
        batch_location_sku,
        warehouse_location:warehouse_locations!item_location_batch_location_id_fkey(id, code, name),
        item_batch:item_batch!item_location_batch_item_batch_id_fkey(id, batch_code, received_at)
      `
      )
      .eq("company_id", auth.companyId)
      .eq("batch_location_sku", batchLocationSku)
      .is("deleted_at", null)
      .maybeSingle();

    if (sourceError) {
      return NextResponse.json({ error: sourceError.message }, { status: 500 });
    }

    if (!sourceRow) {
      return scanValidationError("Batch location SKU not found");
    }

    const itemBatch = Array.isArray(sourceRow.item_batch) ? sourceRow.item_batch[0] : sourceRow.item_batch;
    const location = Array.isArray(sourceRow.warehouse_location)
      ? sourceRow.warehouse_location[0]
      : sourceRow.warehouse_location;

    if (!itemBatch?.batch_code || !itemBatch?.received_at || !sourceRow.location_id) {
      return scanValidationError("Batch location SKU has incomplete source data");
    }

    if (scannedItemId && scannedItemId !== sourceRow.item_id) {
      return scanValidationError("Scanned QR item does not match the batch location SKU item");
    }
    if (scannedLocationId && scannedLocationId !== sourceRow.location_id) {
      return scanValidationError("Scanned QR location does not match the batch location SKU location");
    }
    if (scannedBatchCode && scannedBatchCode !== (itemBatch.batch_code as string)) {
      return scanValidationError("Scanned QR batch does not match the batch location SKU batch");
    }

    const { data: pickItems, error: pickItemsError } = await auth.supabase
      .from("pick_list_items")
      .select(
        `
        id,
        dn_item_id,
        item_id,
        allocated_qty,
        picked_qty,
        delivery_note_items!pick_list_items_dn_item_id_fkey(
          id,
          suggested_pick_location_id,
          suggested_pick_batch_code,
          suggested_pick_batch_received_at,
          items!delivery_note_items_item_id_fkey(item_code, item_name, sku)
        )
      `
      )
      .eq("company_id", auth.companyId)
      .eq("pick_list_id", id)
      .eq("item_id", sourceRow.item_id);

    if (pickItemsError) {
      return NextResponse.json({ error: pickItemsError.message }, { status: 500 });
    }
    if (!pickItems || pickItems.length === 0) {
      return scanValidationError("Scanned batch/location SKU item is not in this pick list");
    }

    const matchable = (pickItems || []).map((row) => {
      const dnLine = Array.isArray(row.delivery_note_items) ? row.delivery_note_items[0] : row.delivery_note_items;
      const remainingQty = Math.max(0, toNumber(row.allocated_qty) - toNumber(row.picked_qty));
      const isSuggestedMatch =
        (!dnLine?.suggested_pick_location_id || dnLine.suggested_pick_location_id === sourceRow.location_id) &&
        (!dnLine?.suggested_pick_batch_code || dnLine.suggested_pick_batch_code === itemBatch.batch_code);

      return {
        pickListItemId: row.id as string,
        deliveryNoteItemId: row.dn_item_id as string,
        itemId: row.item_id as string,
        allocatedQty: toNumber(row.allocated_qty),
        pickedQty: toNumber(row.picked_qty),
        remainingQty,
        isSuggestedMatch,
        suggestedPickLocationId: dnLine?.suggested_pick_location_id || null,
        suggestedPickBatchCode: dnLine?.suggested_pick_batch_code || null,
        item: dnLine?.items
          ? {
              itemCode: (Array.isArray(dnLine.items) ? dnLine.items[0] : dnLine.items)?.item_code || null,
              itemName: (Array.isArray(dnLine.items) ? dnLine.items[0] : dnLine.items)?.item_name || null,
              sku: (Array.isArray(dnLine.items) ? dnLine.items[0] : dnLine.items)?.sku || null,
            }
          : null,
      };
    });

    const eligible = matchable.filter((row) => row.remainingQty > 0);
    if (eligible.length === 0) {
      return scanValidationError("Item already fully picked in this pick list");
    }

    const suggestedEligible = eligible.filter((row) => row.isSuggestedMatch);
    const linePool = suggestedEligible.length > 0 ? suggestedEligible : eligible;
    const selectedLine = linePool.sort((a, b) => b.remainingQty - a.remainingQty)[0];

    return NextResponse.json({
      data: {
        batchLocationSku,
        source: {
          itemId: sourceRow.item_id,
          warehouseId: sourceRow.warehouse_id,
          locationId: sourceRow.location_id,
          locationCode: (location?.code as string | undefined) || null,
          locationName: (location?.name as string | undefined) || null,
          batchCode: itemBatch.batch_code as string,
          batchReceivedAt: itemBatch.received_at as string,
          qtyOnHand: toNumber(sourceRow.qty_on_hand as number | string),
        },
        line: selectedLine,
        isMismatch:
          !!selectedLine &&
          (!selectedLine.isSuggestedMatch &&
            (!!selectedLine.suggestedPickLocationId || !!selectedLine.suggestedPickBatchCode)),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
