import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

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
  item?: { id: string; item_code: string | null; item_name: string | null; sku: string | null }
    | { id: string; item_code: string | null; item_name: string | null; sku: string | null }[]
    | null;
  warehouse?:
    | { id: string; warehouse_code: string | null; warehouse_name: string | null }
    | { id: string; warehouse_code: string | null; warehouse_name: string | null }[]
    | null;
  location?:
    | { id: string; code: string | null; name: string | null }
    | { id: string; code: string | null; name: string | null }[]
    | null;
};

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const one = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

// GET /api/reports/item-location-batch
export async function GET(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.REPORTS, "view");
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

    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const requestedLimit = Number.parseInt(searchParams.get("limit") || "25", 10) || 25;
    const limit = Math.min(Math.max(requestedLimit, 10), 50);
    const offset = (page - 1) * limit;

    const warehouseId = searchParams.get("warehouseId") || undefined;
    const itemId = searchParams.get("itemId") || undefined;
    const search = (searchParams.get("search") || "").trim();
    const stockStatus = (searchParams.get("stockStatus") || "all").trim();
    const sortBy = (searchParams.get("sortBy") || "updated_at") as
      | "updated_at"
      | "qty_on_hand"
      | "received_at";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? true : false;

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
          sku
        ),
        warehouse:warehouses!item_location_batch_warehouse_id_fkey(
          id,
          warehouse_code,
          warehouse_name
        ),
        location:warehouse_locations!item_location_batch_location_id_fkey(
          id,
          code,
          name
        )
      `,
        { count: "exact" }
      )
      .eq("company_id", userData.company_id)
      .is("deleted_at", null);

    if (warehouseId) query = query.eq("warehouse_id", warehouseId);
    if (itemId) query = query.eq("item_id", itemId);

    if (stockStatus === "zero") query = query.lte("qty_on_hand", 0);
    if (stockStatus === "available_only") query = query.gt("qty_available", 0);
    if (stockStatus === "reserved") query = query.gt("qty_reserved", 0);

    if (search) {
      // filter by related text and batch/location SKU
      query = query.or(
        [
          `batch_location_sku.ilike.%${search}%`,
          `item_batch.batch_code.ilike.%${search}%`,
          `item.item_code.ilike.%${search}%`,
          `item.item_name.ilike.%${search}%`,
          `item.sku.ilike.%${search}%`,
          `location.code.ilike.%${search}%`,
          `location.name.ilike.%${search}%`,
        ].join(",")
      );
    }

    if (sortBy === "qty_on_hand") {
      query = query.order("qty_on_hand", { ascending: sortOrder });
    } else if (sortBy === "received_at") {
      query = query.order("received_at", { foreignTable: "item_batch", ascending: sortOrder });
    } else {
      query = query.order("updated_at", { ascending: sortOrder });
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) {
      return NextResponse.json({ error: "Failed to fetch item location batch report" }, { status: 500 });
    }

    const rows = ((data || []) as ItemLocationBatchRow[]).map((row) => {
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
        itemSku: item?.sku || null,
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
        batchLocationSku: row.batch_location_sku || null,
        qtyOnHand,
        qtyReserved,
        qtyAvailable,
        updatedAt: row.updated_at,
      };
    });

    const summary = {
      rowCount: rows.length,
      totalRows: count || 0,
      totalQtyOnHand: rows.reduce((sum, r) => sum + r.qtyOnHand, 0),
      totalQtyReserved: rows.reduce((sum, r) => sum + r.qtyReserved, 0),
      totalQtyAvailable: rows.reduce((sum, r) => sum + r.qtyAvailable, 0),
      uniqueItems: new Set(rows.map((r) => r.itemId)).size,
      uniqueLocations: new Set(rows.map((r) => r.locationId)).size,
      uniqueBatches: new Set(rows.map((r) => r.itemBatchId)).size,
      rowsWithReserved: rows.filter((r) => r.qtyReserved > 0).length,
      zeroStockRows: rows.filter((r) => r.qtyOnHand <= 0).length,
    };

    return NextResponse.json({
      data: rows,
      summary,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
      },
      filters: {
        warehouseId: warehouseId || null,
        itemId: itemId || null,
        search: search || null,
        stockStatus,
        sortBy,
        sortOrder: sortOrder ? "asc" : "desc",
      },
    });
  } catch (error) {
    console.error("Error generating item location batch report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

