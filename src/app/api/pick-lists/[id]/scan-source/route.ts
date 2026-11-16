import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  ensurePickListActorAuthorized,
  fetchPickListHeader,
  getPickListAuthContext,
} from "../../_lib";
import { fetchWarehouseLocationNamePaths } from "@/lib/warehouse-location-name-path";
import type { Database } from "@/types/database.types";
import type { PickSourceResolution, PickSourceResult } from "@/types/pick-source";

type RouteContext = { params: Promise<{ id: string }> };
type SourceRow = Database["public"]["Functions"]["get_pick_item_batch_sources"]["Returns"][number];
// Matches the RPC page: three displayed choices plus one lookahead row for hasMore.
const SOURCE_PAGE_SIZE = 3;
const querySchema = z
  .object({
    itemId: z.string().uuid(),
    batchCode: z.string().trim().min(1).max(100),
    locationId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict();
const scanError = (error: string, code: string, status = 400) =>
  NextResponse.json({ error, code }, { status });

async function GETHandler(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.PICK_LISTS, "edit");
    if (unauthorized) return unauthorized;
    const auth = await getPickListAuthContext();
    if (auth instanceof NextResponse) return auth;
    const { id } = await context.params;
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!z.string().uuid().safeParse(id).success || !parsed.success) {
      return scanError("Scan a valid item and batch QR", "ITEM_BATCH_QR_REQUIRED");
    }
    const { itemId, batchCode, locationId, page } = parsed.data;
    const header = await fetchPickListHeader(auth.supabase, auth.companyId, id);
    if (!header) return scanError("Pick list not found", "PICK_LIST_NOT_FOUND", 404);
    const permission = await ensurePickListActorAuthorized(
      auth.supabase,
      auth.companyId,
      header.business_unit_id,
      id,
      auth.userId
    );
    if (!permission.ok) return scanError("Picking access denied", "PICK_SOURCE_FORBIDDEN", 403);
    if (header.status !== "in_progress") {
      return scanError("Start picking before scanning", "PICK_SOURCE_NOT_ACTIVE", 409);
    }

    const { data, error } = await auth.supabase.rpc("get_pick_item_batch_sources", {
      p_company_id: auth.companyId,
      p_pick_list_id: id,
      p_item_id: itemId,
      p_batch_code: batchCode,
      p_location_id: locationId ?? undefined,
      p_page: locationId ? 1 : page,
    });
    if (error) {
      console.error("Failed to resolve item-batch picking sources", error);
      if (error.message.includes("PICK_SOURCE_FORBIDDEN")) {
        return scanError("Picking access denied", "PICK_SOURCE_FORBIDDEN", 403);
      }
      if (error.message.includes("PICK_SOURCE_NOT_ACTIVE")) {
        return scanError("Start picking before scanning", "PICK_SOURCE_NOT_ACTIVE", 409);
      }
      return scanError("Unable to load picking locations", "PICK_SOURCE_LOOKUP_FAILED", 500);
    }
    const rows: SourceRow[] = data ?? [];
    if (!rows.length && (page === 1 || locationId)) {
      return scanError(
        "No eligible stock for this item and batch. Refresh the pick list and scan again.",
        "PICK_SOURCE_UNAVAILABLE",
        409
      );
    }
    const visibleRows = rows.slice(0, SOURCE_PAGE_SIZE);
    const { data: paths, error: pathError } = await fetchWarehouseLocationNamePaths(
      auth.supabase,
      auth.companyId,
      visibleRows.map((row) => ({
        id: row.location_id,
        code: row.location_code,
        name: row.location_name,
        path_ids: row.location_path_ids,
      }))
    );
    if (pathError) {
      console.error("Failed to load picking location names", pathError);
      return scanError("Unable to load picking locations", "PICK_SOURCE_LOOKUP_FAILED", 500);
    }
    const sources = visibleRows.map(
      (row): PickSourceResolution => ({
        batchLocationSku: row.batch_location_sku,
        source: {
          itemId,
          warehouseId: row.warehouse_id,
          warehouseName: row.warehouse_name,
          locationId: row.location_id,
          locationCode: row.location_code,
          locationName: paths.get(row.location_id) || row.location_name || row.location_code,
          batchCode,
          batchReceivedAt: row.batch_received_at,
          qtyOnHand: Number(row.qty_on_hand),
          availableBaseQty: Number(row.available_base_qty),
        },
        line: {
          pickListItemId: row.pick_list_item_id,
          deliveryNoteItemId: row.delivery_note_item_id,
          allocatedQty: Number(row.allocated_qty),
          pickedQty: Number(row.picked_qty),
          remainingQty: Math.max(0, Number(row.allocated_qty) - Number(row.picked_qty)),
          remainingBaseQty: Number(row.remaining_base_qty),
          maxPickQty: Number(row.max_pick_qty),
        },
        isMismatch: !row.is_suggested,
      })
    );
    // A page after the first is always part of an explicit location selection.
    if (!locationId && (rows.length > 1 || page > 1)) {
      return NextResponse.json<{ data: PickSourceResult }>({
        data: {
          kind: "choose_location",
          sources,
          page,
          hasMore: rows.length > SOURCE_PAGE_SIZE,
        },
      });
    }
    return NextResponse.json<{ data: PickSourceResult }>({
      data: { kind: "resolved", resolution: sources[0] },
    });
  } catch (error) {
    console.error("Unexpected item-batch scan failure", error);
    return scanError("Unable to load picking locations", "PICK_SOURCE_LOOKUP_FAILED", 500);
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "pick_lists",
  route: "/api/pick-lists/[id]/scan-source",
});
