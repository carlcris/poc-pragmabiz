import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { PickingValidationPolicy } from "@/types/settings";
import {
  ensurePickListActorAuthorized,
  fetchPickListHeader,
  getPickListAuthContext,
} from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type MatchablePickLine = {
  pickListItemId: string;
  deliveryNoteItemId: string;
  allocatedQty: number;
  pickedQty: number;
  remainingQty: number;
  suggestedBatchLocationSku: string;
  suggestedLocationId: string;
  suggestedBatchCode: string;
  suggestedBatchReceivedAt: string;
  item: {
    barcode: string | null;
    itemCode: string | null;
    itemName: string | null;
  } | null;
};

const scanValidationError = (error: string, code: string, status = 400) =>
  NextResponse.json({ error, code }, { status });

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const sameTimestamp = (left: string, right: string) =>
  new Date(left).getTime() === new Date(right).getTime();

const normalizePickingPolicy = (value: unknown): PickingValidationPolicy => {
  if (value === "batch_and_warehouse" || value === "batch_and_rack" || value === "batch_only") {
    return value;
  }
  return "batch_only";
};

async function GETHandler(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.PICK_LISTS, "edit");
    if (unauthorized) return unauthorized;

    const auth = await getPickListAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const batchLocationSku = request.nextUrl.searchParams.get("batchLocationSku")?.trim();
    const scannedItemId = request.nextUrl.searchParams.get("itemId")?.trim() || null;
    const scannedLocationId = request.nextUrl.searchParams.get("locationId")?.trim() || null;
    const scannedBatchCode = request.nextUrl.searchParams.get("batchCode")?.trim() || null;
    if (!batchLocationSku || !/^\d{10}$/.test(batchLocationSku)) {
      return scanValidationError(
        "Enter or scan a valid 10-digit batch-location SKU",
        "BATCH_LOCATION_SKU_REQUIRED"
      );
    }

    const header = await fetchPickListHeader(auth.supabase, auth.companyId, id);
    if (!header) return scanValidationError("Pick list not found", "PICK_LIST_NOT_FOUND", 404);

    const permission = await ensurePickListActorAuthorized(
      auth.supabase,
      auth.companyId,
      header.business_unit_id,
      id,
      auth.userId
    );
    if (!permission.ok) return scanValidationError(permission.error, "PICK_LIST_FORBIDDEN", 403);

    const [sourceResult, deliveryNoteResult, policyResult] = await Promise.all([
      auth.supabase
        .from("item_batch_locations")
        .select(
          `
          id,
          item_id,
          warehouse_id,
          location_id,
          qty_on_hand,
          batch_location_sku,
          warehouse:warehouses!item_batch_locations_warehouse_id_fkey(
            id,
            business_unit_id,
            is_active
          ),
          warehouse_location:warehouse_locations!item_batch_locations_location_id_fkey(
            id,
            code,
            name,
            is_active,
            is_pickable,
            is_storable,
            location_path
          ),
          item_batch:item_batches!item_batch_locations_item_batch_id_fkey(
            id,
            batch_code,
            received_at
          )
        `
        )
        .eq("company_id", auth.companyId)
        .eq("batch_location_sku", batchLocationSku)
        .is("deleted_at", null)
        .maybeSingle(),
      auth.supabase
        .from("delivery_notes")
        .select("fulfilling_business_unit_id, fulfilling_warehouse_id")
        .eq("company_id", auth.companyId)
        .eq("id", header.dn_id)
        .is("deleted_at", null)
        .maybeSingle(),
      auth.supabase
        .from("settings")
        .select("value")
        .eq("company_id", auth.companyId)
        .eq("business_unit_id", header.business_unit_id)
        .eq("group_key", "inventory")
        .eq("setting_key", "picking_validation_policy")
        .maybeSingle(),
    ]);

    if (sourceResult.error) {
      console.error("Failed to resolve pick-list scan source", sourceResult.error);
      return scanValidationError(
        "Failed to resolve scanned source",
        "PICK_SOURCE_LOOKUP_FAILED",
        500
      );
    }
    if (deliveryNoteResult.error || !deliveryNoteResult.data?.fulfilling_business_unit_id) {
      console.error(
        "Failed to resolve pick-list fulfilling business unit",
        deliveryNoteResult.error
      );
      return scanValidationError(
        "Failed to resolve the picking business unit",
        "PICKING_BUSINESS_UNIT_LOOKUP_FAILED",
        500
      );
    }
    if (policyResult.error) {
      console.error("Failed to resolve picking validation policy", policyResult.error);
      return scanValidationError(
        "Failed to resolve the picking policy",
        "PICKING_POLICY_LOOKUP_FAILED",
        500
      );
    }

    const sourceRow = sourceResult.data;
    if (!sourceRow) {
      return scanValidationError("Batch-location SKU not found", "BATCH_LOCATION_SKU_NOT_FOUND");
    }

    const warehouse = Array.isArray(sourceRow.warehouse)
      ? sourceRow.warehouse[0]
      : sourceRow.warehouse;
    const location = Array.isArray(sourceRow.warehouse_location)
      ? sourceRow.warehouse_location[0]
      : sourceRow.warehouse_location;
    const itemBatch = Array.isArray(sourceRow.item_batch)
      ? sourceRow.item_batch[0]
      : sourceRow.item_batch;

    if (
      !warehouse?.is_active ||
      !location?.is_active ||
      !location.is_pickable ||
      !location.is_storable ||
      !itemBatch?.batch_code ||
      !itemBatch.received_at ||
      !sourceRow.location_id
    ) {
      return scanValidationError(
        "The scanned source is inactive or unavailable for picking",
        "PICK_SOURCE_UNAVAILABLE"
      );
    }
    if (warehouse.business_unit_id !== deliveryNoteResult.data.fulfilling_business_unit_id) {
      return scanValidationError(
        "The scanned source is outside the fulfilling business unit",
        "SOURCE_OUTSIDE_FULFILLING_BUSINESS_UNIT"
      );
    }
    if (toNumber(sourceRow.qty_on_hand) <= 0) {
      return scanValidationError(
        "The scanned source has no available stock",
        "PICK_SOURCE_INSUFFICIENT_QUANTITY"
      );
    }
    if (scannedItemId && scannedItemId !== sourceRow.item_id) {
      return scanValidationError(
        "The scanned item does not match the batch-location SKU",
        "PICK_SOURCE_ITEM_MISMATCH"
      );
    }
    if (scannedLocationId && scannedLocationId !== sourceRow.location_id) {
      return scanValidationError(
        "The scanned location does not match the batch-location SKU",
        "PICK_SOURCE_LOCATION_MISMATCH"
      );
    }
    if (scannedBatchCode && scannedBatchCode !== itemBatch.batch_code) {
      return scanValidationError(
        "The scanned batch does not match the batch-location SKU",
        "PICK_SOURCE_BATCH_MISMATCH"
      );
    }

    const { data: pickItems, error: pickItemsError } = await auth.supabase
      .from("pick_list_items")
      .select(
        `
        id,
        dn_item_id,
        allocated_qty,
        picked_qty,
        suggested_pick_location_id,
        suggested_pick_batch_code,
        suggested_pick_batch_received_at,
        suggested_batch_location_sku,
        item_unit_options!pick_list_items_item_unit_option_id_fkey(barcode),
        delivery_note_items!pick_list_items_dn_item_id_fkey(
          items!delivery_note_items_item_id_fkey(item_code, item_name)
        )
      `
      )
      .eq("company_id", auth.companyId)
      .eq("pick_list_id", id)
      .eq("item_id", sourceRow.item_id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(100);

    if (pickItemsError) {
      console.error("Failed to load pick-list lines for scanned source", pickItemsError);
      return scanValidationError("Failed to match scanned source", "PICK_LINE_LOOKUP_FAILED", 500);
    }
    if (!pickItems?.length) {
      return scanValidationError("Item is not included in this pick list", "ITEM_NOT_IN_PICK_LIST");
    }

    const eligible: MatchablePickLine[] = pickItems
      .map((row) => {
        const dnLine = Array.isArray(row.delivery_note_items)
          ? row.delivery_note_items[0]
          : row.delivery_note_items;
        const item = dnLine?.items
          ? Array.isArray(dnLine.items)
            ? dnLine.items[0]
            : dnLine.items
          : null;
        const unitOption = Array.isArray(row.item_unit_options)
          ? row.item_unit_options[0]
          : row.item_unit_options;
        return {
          pickListItemId: row.id,
          deliveryNoteItemId: row.dn_item_id,
          allocatedQty: toNumber(row.allocated_qty),
          pickedQty: toNumber(row.picked_qty),
          remainingQty: Math.max(0, toNumber(row.allocated_qty) - toNumber(row.picked_qty)),
          suggestedBatchLocationSku: row.suggested_batch_location_sku || "",
          suggestedLocationId: row.suggested_pick_location_id || "",
          suggestedBatchCode: row.suggested_pick_batch_code || "",
          suggestedBatchReceivedAt: row.suggested_pick_batch_received_at || "",
          item: item
            ? {
                barcode: unitOption?.barcode || null,
                itemCode: item.item_code || null,
                itemName: item.item_name || null,
              }
            : null,
        };
      })
      .filter((row) => row.remainingQty > 0);

    if (!eligible.length) {
      return scanValidationError(
        "Item is already fully picked in this pick list",
        "PICK_LIST_ITEM_ALREADY_COMPLETE"
      );
    }

    const exactLine = eligible.find((row) => row.suggestedBatchLocationSku === batchLocationSku);
    const sameBatchLines = eligible.filter(
      (row) =>
        row.suggestedBatchCode === itemBatch.batch_code &&
        !!row.suggestedBatchReceivedAt &&
        sameTimestamp(row.suggestedBatchReceivedAt, itemBatch.received_at)
    );

    if (!exactLine && !sameBatchLines.length) {
      return scanValidationError(
        "The scanned source belongs to a different allocated batch",
        "PICK_SOURCE_BATCH_IDENTITY_MISMATCH"
      );
    }

    const policy = normalizePickingPolicy(policyResult.data?.value);
    const plannedWarehouseId = deliveryNoteResult.data.fulfilling_warehouse_id;
    const policyEligibleLines = (exactLine ? [exactLine] : sameBatchLines).filter((row) => {
      if (policy === "batch_and_rack") {
        return (
          sourceRow.warehouse_id === plannedWarehouseId &&
          sourceRow.location_id === row.suggestedLocationId
        );
      }
      if (policy === "batch_and_warehouse") {
        return sourceRow.warehouse_id === plannedWarehouseId;
      }
      return true;
    });

    if (!policyEligibleLines.length) {
      const code =
        policy === "batch_and_rack"
          ? "PICK_SOURCE_RACK_POLICY_MISMATCH"
          : "PICK_SOURCE_WAREHOUSE_POLICY_MISMATCH";
      const error =
        policy === "batch_and_rack"
          ? "The scanned source is not in the assigned rack"
          : "The scanned source is not in the assigned warehouse";
      return scanValidationError(error, code);
    }

    const selectedLine = policyEligibleLines[0];
    const isMismatch = selectedLine.suggestedBatchLocationSku !== batchLocationSku;

    return NextResponse.json({
      data: {
        batchLocationSku,
        policy,
        source: {
          itemId: sourceRow.item_id,
          warehouseId: sourceRow.warehouse_id,
          locationId: sourceRow.location_id,
          locationCode: location.code || null,
          locationName: location.location_path || null,
          batchCode: itemBatch.batch_code,
          batchReceivedAt: itemBatch.received_at,
          qtyOnHand: toNumber(sourceRow.qty_on_hand),
        },
        line: {
          pickListItemId: selectedLine.pickListItemId,
          deliveryNoteItemId: selectedLine.deliveryNoteItemId,
          allocatedQty: selectedLine.allocatedQty,
          pickedQty: selectedLine.pickedQty,
          remainingQty: selectedLine.remainingQty,
          item: selectedLine.item,
        },
        isMismatch,
        warningCode: isMismatch ? "PICK_SOURCE_ALTERNATIVE_CONFIRMATION_REQUIRED" : null,
      },
    });
  } catch (error) {
    console.error("Unexpected error resolving pick-list scan source", error);
    return scanValidationError(
      "Failed to resolve scanned source",
      "PICK_SOURCE_LOOKUP_FAILED",
      500
    );
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "pick_lists",
  route: "/api/pick-lists/[id]/scan-source",
});
