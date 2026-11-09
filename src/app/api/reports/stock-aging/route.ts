import type { StockAgingReportRow } from "@/types/stock-aging-report";
import { fetchStockAgingLocationPaths } from "@/lib/reports/stock-aging-location-paths";
import { calculateStockAge } from "@/lib/reports/stock-aging-age";
import { groupStockAgingRows } from "@/lib/reports/stock-aging-groups";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type StockAgingRowSource = {
  id: string;
  item_id: string;
  warehouse_id: string;
  location_id: string;
  item_batch_id: string;
  qty_on_hand: number | string | null;
  qty_reserved: number | string | null;
  qty_available: number | string | null;
  batch_location_sku: string | null;
  updated_at: string;
  item_batch?:
    | {
        id: string;
        batch_code: string | null;
        received_at: string | null;
      }
    | {
        id: string;
        batch_code: string | null;
        received_at: string | null;
      }[]
    | null;
  item?:
    | {
        id: string;
        item_code: string | null;
        item_name: string | null;
        category_id: string | null;
        purchase_price: number | string | null;
        category?:
          | {
              name: string | null;
            }
          | {
              name: string | null;
            }[]
          | null;
      }
    | {
        id: string;
        item_code: string | null;
        item_name: string | null;
        category_id: string | null;
        purchase_price: number | string | null;
        category?:
          | {
              name: string | null;
            }
          | {
              name: string | null;
            }[]
          | null;
      }[]
    | null;
  warehouse?:
    | {
        id: string;
        warehouse_code: string | null;
        warehouse_name: string | null;
        business_unit_id: string | null;
      }
    | {
        id: string;
        warehouse_code: string | null;
        warehouse_name: string | null;
        business_unit_id: string | null;
      }[]
    | null;
  location?:
    | {
        id: string;
        code: string | null;
        name: string | null;
        path_ids: string[];
      }
    | {
        id: string;
        code: string | null;
        name: string | null;
        path_ids: string[];
      }[]
    | null;
};

type AgeBucket = "all" | "0_30" | "31_60" | "61_90" | "91_180" | "181_plus" | "90_plus";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SOURCE_ROWS = 5000;
const SOURCE_PAGE_SIZE = 1000;

const one = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const ageBucketOf = (ageDays: number): Exclude<AgeBucket, "all"> => {
  if (ageDays <= 30) return "0_30";
  if (ageDays <= 60) return "31_60";
  if (ageDays <= 90) return "61_90";
  if (ageDays <= 180) return "91_180";
  return "181_plus";
};

const clampPageSize = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 10), 50);
};

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.REPORTS, "view");
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
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

    const exportMode = searchParams.get("exportMode") === "pdf" ? "pdf" : null;
    const page =
      exportMode === "pdf"
        ? 1
        : Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit =
      exportMode === "pdf" ? MAX_SOURCE_ROWS : clampPageSize(searchParams.get("limit"), 25);
    const groupBy = searchParams.get("groupBy") || "item";
    if (groupBy !== "item" && groupBy !== "batch") {
      return NextResponse.json({ error: "Invalid stock aging grouping" }, { status: 400 });
    }
    const search = searchParams.get("search")?.trim() || undefined;
    const categoryFilter = searchParams.get("category") || undefined;
    const ageBucket = (searchParams.get("ageBucket") || "90_plus") as AgeBucket;

    let query = supabase
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
        item:items!inner(
          id,
          item_code,
          item_name,
          category_id,
          purchase_price,
          category:item_categories(id, name)
        ),
        warehouse:warehouses!inner(
          id,
          warehouse_code,
          warehouse_name,
          business_unit_id
        ),
        location:warehouse_locations!item_batch_locations_location_id_fkey(
          id,
          code,
          path_ids,
          name
        )
      `,
        { count: "exact" }
      )
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .gt("qty_on_hand", 0);

    if (categoryFilter) {
      if (UUID_REGEX.test(categoryFilter)) {
        query = query.eq("item.category_id", categoryFilter);
      } else {
        const { data: categoryData, error: categoryError } = await supabase
          .from("item_categories")
          .select("id")
          .eq("name", categoryFilter)
          .eq("company_id", userData.company_id)
          .is("deleted_at", null)
          .maybeSingle();

        if (categoryError) {
          return NextResponse.json(
            { error: "Failed to fetch stock aging report" },
            { status: 500 }
          );
        }

        if (!categoryData?.id) {
          return NextResponse.json({
            data: [],
            groups: [],
            summary: {
              rowCount: 0,
              totalQtyOnHand: 0,
              totalQtyReserved: 0,
              totalQtyAvailable: 0,
              totalStockValue: 0,
              aged90PlusRows: 0,
              aged90PlusQty: 0,
              oldestAgeDays: 0,
              uniqueLocations: 0,
              uniqueBatches: 0,
            },
            pagination: { page, limit, total: 0, totalPages: 1 },
            filters: {
              search: search || null,
              category: categoryFilter,
              ageBucket,
              groupBy,
              currentBusinessUnitId: currentBusinessUnitId || null,
            },
          });
        }

        query = query.eq("item.category_id", categoryData.id);
      }
    }

    if (currentBusinessUnitId) {
      query = query.eq("warehouse.business_unit_id", currentBusinessUnitId);
    }

    // PostgREST may cap each response below the requested range. Advance by the
    // actual number received and use the exact count, never a short-page heuristic.
    const data: StockAgingRowSource[] = [];
    let expectedCount: number | null = null;
    query = query.order("id", { ascending: true });
    while (true) {
      const result = await query.range(data.length, data.length + SOURCE_PAGE_SIZE - 1);
      if (result.error || result.count === null) {
        console.error("Failed to read stock aging source rows", result.error);
        return NextResponse.json({ error: "Failed to fetch stock aging report" }, { status: 500 });
      }
      if (result.count > MAX_SOURCE_ROWS) {
        return NextResponse.json(
          { error: "Stock aging report is too large. Narrow the category or business-unit scope." },
          { status: 413 }
        );
      }
      if (expectedCount !== null && expectedCount !== result.count) {
        return NextResponse.json(
          { error: "Stock aging data changed. Please retry." },
          { status: 409 }
        );
      }
      expectedCount = result.count;
      const rows = (result.data || []) as StockAgingRowSource[];
      if (rows.length === 0 && data.length < expectedCount) {
        return NextResponse.json({ error: "Failed to fetch stock aging report" }, { status: 500 });
      }
      data.push(...rows);
      if (data.length >= expectedCount) break;
    }

    const asOf = new Date();
    const scopedRows = data
      .map((row): StockAgingReportRow => {
        const item = one(row.item);
        const warehouse = one(row.warehouse);
        const location = one(row.location);
        const batch = one(row.item_batch);
        const category = one(item?.category)?.name || "Uncategorized";
        const qtyOnHand = toNumber(row.qty_on_hand);
        const qtyReserved = toNumber(row.qty_reserved);
        const qtyAvailable = toNumber(row.qty_available);
        const receivedAt = batch?.received_at || null;
        const { ageDays, duration } = calculateStockAge(receivedAt, asOf);
        const resolvedAgeBucket = ageBucketOf(ageDays);
        const unitCost = Math.max(0, toNumber(item?.purchase_price));

        return {
          id: row.id,
          itemId: row.item_id,
          itemCode: item?.item_code || null,
          itemName: item?.item_name || null,
          category,
          warehouseId: row.warehouse_id,
          warehouseCode: warehouse?.warehouse_code || null,
          warehouseName: warehouse?.warehouse_name || null,
          locationId: row.location_id,
          locationCode: location?.code || null,
          locationName: location?.name || null,
          locationPath: null,
          itemBatchId: row.item_batch_id,
          batchCode: batch?.batch_code || null,
          batchReceivedAt: receivedAt,
          batchAgeDays: ageDays,
          batchAgeDuration: duration,
          ageBucket: resolvedAgeBucket,
          qtyOnHand,
          qtyReserved,
          qtyAvailable,
          unitCost,
          stockValue: qtyOnHand * unitCost,
          batchLocationSku: row.batch_location_sku || null,
          updatedAt: row.updated_at,
        };
      })
      .filter((row) => {
        if (!search) return true;
        const haystack = [row.itemCode, row.itemName, row.batchCode, row.batchLocationSku]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(search.toLowerCase());
      })
      .filter((row) => {
        if (ageBucket === "all") return true;
        if (ageBucket === "90_plus") return row.batchAgeDays > 90;
        return row.ageBucket === ageBucket;
      });

    const sortedRows = scopedRows.sort((left, right) => {
      const ageCompare = right.batchAgeDays - left.batchAgeDays;
      if (ageCompare !== 0) return ageCompare;
      if (groupBy === "batch") {
        const batchCompare = (left.batchCode || left.itemBatchId).localeCompare(
          right.batchCode || right.itemBatchId
        );
        if (batchCompare !== 0) return batchCompare;
      }
      const itemNameCompare = (left.itemName || left.itemCode || "").localeCompare(
        right.itemName || right.itemCode || ""
      );
      if (itemNameCompare !== 0) {
        return itemNameCompare;
      }

      const receivedAtCompare =
        (left.batchReceivedAt ? new Date(left.batchReceivedAt).getTime() : 0) -
        (right.batchReceivedAt ? new Date(right.batchReceivedAt).getTime() : 0);
      if (receivedAtCompare !== 0) {
        return receivedAtCompare;
      }

      const locationCompare =
        `${left.warehouseCode || ""}-${left.locationCode || ""}`.localeCompare(
          `${right.warehouseCode || ""}-${right.locationCode || ""}`
        );
      if (locationCompare !== 0) {
        return locationCompare;
      }

      return (
        (left.batchCode || "").localeCompare(right.batchCode || "") ||
        left.id.localeCompare(right.id)
      );
    });

    const total = sortedRows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const pagedRows = sortedRows.slice(startIndex, startIndex + limit);

    const reportRows = exportMode === "pdf" ? sortedRows : pagedRows;
    const locationIds = new Set(reportRows.map((row) => row.locationId));
    const locations = new Map(
      data.flatMap((row) => {
        const location = one(row.location);
        return location && locationIds.has(location.id) ? [[location.id, location] as const] : [];
      })
    );
    const namePaths = await fetchStockAgingLocationPaths(supabase, userData.company_id, [
      ...locations.values(),
    ]);
    for (const row of reportRows) row.locationPath = namePaths.get(row.locationId) || null;

    const exportGroups = exportMode === "pdf" ? groupStockAgingRows(sortedRows, groupBy) : null;
    return NextResponse.json({
      data: exportGroups?.data ?? pagedRows,
      groups: exportGroups?.groups ?? [],
      summary: {
        rowCount: total,
        totalQtyOnHand: sortedRows.reduce((sum, row) => sum + row.qtyOnHand, 0),
        totalQtyReserved: sortedRows.reduce((sum, row) => sum + row.qtyReserved, 0),
        totalQtyAvailable: sortedRows.reduce((sum, row) => sum + row.qtyAvailable, 0),
        totalStockValue: sortedRows.reduce((sum, row) => sum + row.stockValue, 0),
        aged90PlusRows: sortedRows.filter((row) => row.batchAgeDays > 90).length,
        aged90PlusQty: sortedRows
          .filter((row) => row.batchAgeDays > 90)
          .reduce((sum, row) => sum + row.qtyOnHand, 0),
        oldestAgeDays: sortedRows.reduce((max, row) => Math.max(max, row.batchAgeDays), 0),
        uniqueLocations: new Set(sortedRows.map((row) => row.locationId)).size,
        uniqueBatches: new Set(sortedRows.map((row) => row.itemBatchId)).size,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      filters: {
        search: search || null,
        category: categoryFilter || null,
        ageBucket,
        groupBy,
        currentBusinessUnitId: currentBusinessUnitId || null,
      },
    });
  } catch (error) {
    console.error("Error generating stock aging report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "stock_aging",
  route: "/api/reports/stock-aging",
});
