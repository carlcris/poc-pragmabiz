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
        sku: string | null;
        category_id: string | null;
        cost_price: number | string | null;
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
        sku: string | null;
        category_id: string | null;
        cost_price: number | string | null;
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
      }
    | {
        id: string;
        code: string | null;
        name: string | null;
      }[]
    | null;
};

type AgeBucket = "all" | "0_30" | "31_60" | "61_90" | "91_180" | "181_plus" | "90_plus";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const one = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const ageInDays = (receivedAt: string | null) => {
  if (!receivedAt) return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(receivedAt).getTime()) / (1000 * 60 * 60 * 24))
  );
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

export async function GET(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.REPORTS, "view");
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

    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = clampPageSize(searchParams.get("limit"), 25);
    const search = searchParams.get("search")?.trim() || undefined;
    const categoryFilter = searchParams.get("category") || undefined;
    const ageBucket = (searchParams.get("ageBucket") || "90_plus") as AgeBucket;

    let query = supabase
      .from("item_location_batch")
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
        item_batch:item_batch!item_location_batch_item_batch_id_fkey(
          id,
          batch_code,
          received_at
        ),
        item:items!item_location_batch_item_id_fkey(
          id,
          item_code,
          item_name,
          sku,
          category_id,
          cost_price,
          purchase_price,
          category:item_categories(id, name)
        ),
        warehouse:warehouses!item_location_batch_warehouse_id_fkey(
          id,
          warehouse_code,
          warehouse_name,
          business_unit_id
        ),
        location:warehouse_locations!item_location_batch_location_id_fkey(
          id,
          code,
          name
        )
      `
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
          return NextResponse.json({ error: "Failed to fetch stock aging report" }, { status: 500 });
        }

        if (!categoryData?.id) {
          return NextResponse.json({
            data: [],
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
              currentBusinessUnitId: currentBusinessUnitId || null,
            },
          });
        }

        query = query.eq("item.category_id", categoryData.id);
      }
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: "Failed to fetch stock aging report" }, { status: 500 });
    }

    const scopedRows = ((data || []) as StockAgingRowSource[])
      .filter((row) => {
        if (!currentBusinessUnitId) return true;
        const warehouse = one(row.warehouse);
        return warehouse?.business_unit_id === currentBusinessUnitId;
      })
      .map((row) => {
        const item = one(row.item);
        const warehouse = one(row.warehouse);
        const location = one(row.location);
        const batch = one(row.item_batch);
        const category = one(item?.category)?.name || "Uncategorized";
        const qtyOnHand = toNumber(row.qty_on_hand);
        const qtyReserved = toNumber(row.qty_reserved);
        const qtyAvailable = toNumber(row.qty_available);
        const receivedAt = batch?.received_at || null;
        const ageDays = ageInDays(receivedAt);
        const resolvedAgeBucket = ageBucketOf(ageDays);
        const unitCost = Math.max(0, toNumber(item?.cost_price), toNumber(item?.purchase_price));

        return {
          id: row.id,
          itemId: row.item_id,
          itemCode: item?.item_code || null,
          itemName: item?.item_name || null,
          itemSku: item?.sku || null,
          category,
          warehouseId: row.warehouse_id,
          warehouseCode: warehouse?.warehouse_code || null,
          warehouseName: warehouse?.warehouse_name || null,
          locationId: row.location_id,
          locationCode: location?.code || null,
          locationName: location?.name || null,
          itemBatchId: row.item_batch_id,
          batchCode: batch?.batch_code || null,
          batchReceivedAt: receivedAt,
          batchAgeDays: ageDays,
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
        const haystack = [
          row.itemCode,
          row.itemName,
          row.itemSku,
          row.batchCode,
          row.batchLocationSku,
        ]
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

      const locationCompare = `${left.warehouseCode || ""}-${left.locationCode || ""}`.localeCompare(
        `${right.warehouseCode || ""}-${right.locationCode || ""}`
      );
      if (locationCompare !== 0) {
        return locationCompare;
      }

      return (left.batchCode || "").localeCompare(right.batchCode || "");
    });

    const total = sortedRows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const pagedRows = sortedRows.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      data: pagedRows,
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
        currentBusinessUnitId: currentBusinessUnitId || null,
      },
    });
  } catch (error) {
    console.error("Error generating stock aging report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
