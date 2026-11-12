import {
  getItemLocationGroupSubtotals,
  isItemLocationReportGroupBy,
  orderItemLocationReportRows,
} from "@/lib/reports/item-location-report-groups";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

const PDF_ROW_LIMIT = 10_000;
const FETCH_BATCH_SIZE = 1_000;
// Twice the full-size read count, so exports still complete when PostgREST
// max_rows caps each read at half the batch size, while bounding tiny-read loops.
const MAX_FETCH_BATCHES = (PDF_ROW_LIMIT / FETCH_BATCH_SIZE) * 2;

type ItemLocationBatchRow = {
  id: string;
  item_id: string;
  warehouse_id: string;
  location_id: string;
  item_batch_id: string;
  qty_on_hand: number | string | null;
  qty_reserved: number | string | null;
  qty_available: number | string | null;
  batch_location_sku?: string | null;
  updated_at: string;
  item_batch?:
    | {
        id: string;
        batch_code: string;
        received_at: string;
      }
    | {
        id: string;
        batch_code: string;
        received_at: string;
      }[]
    | null;
  item?:
    | { id: string; item_code: string | null; item_name: string | null }
    | { id: string; item_code: string | null; item_name: string | null }[]
    | null;
  warehouse?:
    | { id: string; warehouse_code: string | null; warehouse_name: string | null }
    | { id: string; warehouse_code: string | null; warehouse_name: string | null }[]
    | null;
  location?:
    | { id: string; code: string | null; name: string | null; location_path: string }
    | { id: string; code: string | null; name: string | null; location_path: string }[]
    | null;
};

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const one = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

// GET /api/reports/item-location-batch
async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.REPORTS, "view");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { searchParams } = new URL(request.url);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();
    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    const warehouseId = searchParams.get("warehouseId") || undefined;
    const itemId = searchParams.get("itemId") || undefined;
    const groupBy = searchParams.get("groupBy") || "item";
    const includeEmpty = searchParams.get("includeEmptyBatches") || "false";
    const locale = searchParams.get("locale") || defaultLocale;
    if (
      !isItemLocationReportGroupBy(groupBy) ||
      !["true", "false"].includes(includeEmpty) ||
      !isLocale(locale)
    ) {
      return NextResponse.json({ error: "Invalid report filters" }, { status: 400 });
    }
    const includeEmptyBatches = includeEmpty === "true";

    // Count once up front so oversized exports are refused before any row is read.
    // Both reads apply the same company, warehouse, item, and empty-batch scope.
    let countQuery = supabase
      .from("item_batch_locations")
      .select("id", { count: "exact", head: true })
      .eq("company_id", userData.company_id)
      .is("deleted_at", null);
    if (warehouseId) countQuery = countQuery.eq("warehouse_id", warehouseId);
    if (itemId) countQuery = countQuery.eq("item_id", itemId);
    if (!includeEmptyBatches) countQuery = countQuery.gt("qty_on_hand", 0);
    const { count, error: countError } = await countQuery;
    if (countError) {
      console.error("Item location report count failed:", countError);
      return NextResponse.json(
        { error: "Failed to fetch item location batch report" },
        { status: 500 }
      );
    }
    const total = count ?? 0;
    if (total > PDF_ROW_LIMIT) {
      return NextResponse.json(
        {
          code: "REPORT_TOO_LARGE",
          error: "Report is too large. Narrow the warehouse or item filters.",
        },
        { status: 413 }
      );
    }

    let rowQuery = supabase
      .from("item_batch_locations")
      .select(
        `
        id,
        item_id,
        warehouse_id,
        location_id,
        item_batch_id,
        qty_on_hand,
        qty_reserved,
        qty_available,
        batch_location_sku,
        updated_at,
        item_batch:item_batches!item_batch_locations_item_batch_id_fkey(
          id,
          batch_code,
          received_at
        ),
        item:items!item_batch_locations_item_id_fkey(
          id,
          item_code,
          item_name
        ),
        warehouse:warehouses!item_batch_locations_warehouse_id_fkey(
          id,
          warehouse_code,
          warehouse_name
        ),
        location:warehouse_locations!item_batch_locations_location_id_fkey(
          id,
          code,
          location_path,
          name
        )
      `
      )
      .eq("company_id", userData.company_id)
      .is("deleted_at", null);
    if (warehouseId) rowQuery = rowQuery.eq("warehouse_id", warehouseId);
    if (itemId) rowQuery = rowQuery.eq("item_id", itemId);
    if (!includeEmptyBatches) rowQuery = rowQuery.gt("qty_on_hand", 0);
    const query = rowQuery
      .order(groupBy === "item" ? "item_id" : "item_batch_id", { ascending: true })
      .order(groupBy === "item" ? "item_batch_id" : "item_id", { ascending: true })
      .order("warehouse_id", { ascending: true })
      .order("location_id", { ascending: true })
      .order("id", { ascending: true });

    // Keep each read at or below the API row ceiling. Stop rather than publishing
    // partial totals if the dataset changes between reads.
    const sourceRows: ItemLocationBatchRow[] = [];
    const seenIds = new Set<string>();
    let fetchedBatches = 0;
    while (sourceRows.length < total && fetchedBatches < MAX_FETCH_BATCHES) {
      fetchedBatches += 1;
      const nextOffset = sourceRows.length;
      const next = await query.range(
        nextOffset,
        Math.min(nextOffset + FETCH_BATCH_SIZE, total) - 1
      );
      if (next.error) {
        console.error("Item location report batch query failed:", next.error);
        return NextResponse.json(
          { error: "Failed to fetch item location batch report" },
          { status: 500 }
        );
      }
      const nextRows = (next.data ?? []) as ItemLocationBatchRow[];
      if (nextRows.length === 0 || nextRows.some((row) => seenIds.has(row.id))) break;
      for (const row of nextRows) seenIds.add(row.id);
      sourceRows.push(...nextRows);
    }
    if (sourceRows.length !== total) {
      return NextResponse.json(
        {
          code: "REPORT_INCOMPLETE",
          error: "Report data changed or could not be loaded completely. Please retry.",
        },
        { status: 409 }
      );
    }

    const rows = sourceRows.map((row) => {
      const item = one(row.item);
      const warehouse = one(row.warehouse);
      const location = one(row.location);
      const batch = one(row.item_batch);
      const qtyOnHand = toNumber(row.qty_on_hand);
      const qtyReserved = toNumber(row.qty_reserved);
      const qtyAvailable = toNumber(row.qty_available);
      const receivedAt = batch?.received_at || null;
      const ageDays = receivedAt
        ? Math.max(
            0,
            Math.floor((Date.now() - new Date(receivedAt).getTime()) / (1000 * 60 * 60 * 24))
          )
        : null;

      return {
        id: row.id,
        itemId: row.item_id,
        itemCode: item?.item_code || null,
        itemName: item?.item_name || null,
        warehouseId: row.warehouse_id,
        warehouseCode: warehouse?.warehouse_code || null,
        warehouseName: warehouse?.warehouse_name || null,
        locationId: row.location_id,
        locationCode: location?.code || null,
        locationName: location?.name || null,
        locationPath: location?.location_path || null,
        itemBatchId: row.item_batch_id,
        batchCode: batch?.batch_code || null,
        batchReceivedAt: receivedAt,
        batchAgeDays: ageDays,
        batchLocationSku: row.batch_location_sku || null,
        qtyOnHand,
        qtyReserved,
        qtyAvailable,
        updatedAt: row.updated_at,
      };
    });

    const summary = {
      rowCount: rows.length,
      totalRows: total,
      totalQtyOnHand: rows.reduce((sum, r) => sum + r.qtyOnHand, 0),
      totalQtyReserved: rows.reduce((sum, r) => sum + r.qtyReserved, 0),
      totalQtyAvailable: rows.reduce((sum, r) => sum + r.qtyAvailable, 0),
      uniqueItems: new Set(rows.map((r) => r.itemId)).size,
      uniqueLocations: new Set(rows.map((r) => r.locationId)).size,
      uniqueBatches: new Set(rows.map((r) => r.itemBatchId)).size,
      rowsWithReserved: rows.filter((r) => r.qtyReserved > 0).length,
      zeroStockRows: rows.filter((r) => r.qtyOnHand <= 0).length,
    };

    const reportRows = orderItemLocationReportRows(rows, groupBy, locale);
    return NextResponse.json({
      data: reportRows,
      groupSubtotals: getItemLocationGroupSubtotals(reportRows, groupBy),
      summary,
      filters: {
        warehouseId: warehouseId || null,
        itemId: itemId || null,
        groupBy,
        includeEmptyBatches,
      },
    });
  } catch (error) {
    console.error("Error generating item location batch report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "item_location_batch",
  route: "/api/reports/item-location-batch",
});
