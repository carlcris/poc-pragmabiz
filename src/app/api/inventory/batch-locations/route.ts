import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

type BatchLocationRow = {
  id: string;
  item_id: string;
  warehouse_id: string;
  location_id: string;
  item_batch_id: string;
  batch_location_sku: string;
  qty_on_hand: number | string | null;
  qty_available: number | string | null;
  qty_reserved: number | string | null;
  item_batch:
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
  warehouse_location:
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

const toOne = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseLimit = (value: string | null) => {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
};

export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_ADJUSTMENTS, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId } = context;
    const searchParams = request.nextUrl.searchParams;

    const itemId = searchParams.get("itemId");
    const warehouseId = searchParams.get("warehouseId");
    const locationId = searchParams.get("locationId");
    const search = searchParams.get("search")?.trim();
    const limit = parseLimit(searchParams.get("limit"));

    if (!itemId || !UUID_REGEX.test(itemId)) {
      return NextResponse.json({ error: "Valid itemId is required" }, { status: 400 });
    }

    if (!warehouseId || !UUID_REGEX.test(warehouseId)) {
      return NextResponse.json({ error: "Valid warehouseId is required" }, { status: 400 });
    }

    if (locationId && !UUID_REGEX.test(locationId)) {
      return NextResponse.json({ error: "Invalid locationId" }, { status: 400 });
    }

    const matchingBatchIds =
      search && search.length > 0
        ? await supabase
            .from("item_batches")
            .select("id")
            .eq("company_id", companyId)
            .eq("item_id", itemId)
            .eq("warehouse_id", warehouseId)
            .ilike("batch_code", `%${search.replace(/[,%]/g, " ")}%`)
            .is("deleted_at", null)
            .limit(MAX_LIMIT)
        : { data: [] };

    const batchIds = ((matchingBatchIds.data || []) as Array<{ id: string }>).map((row) => row.id);

    let query = supabase
      .from("item_batch_locations")
      .select(
        `
        id,
        item_id,
        warehouse_id,
        location_id,
        item_batch_id,
        batch_location_sku,
        qty_on_hand,
        qty_available,
        qty_reserved,
        item_batch:item_batches!item_batch_locations_item_batch_id_fkey(
          id,
          batch_code,
          received_at
        ),
        warehouse_location:warehouse_locations!item_batch_locations_location_id_fkey(
          id,
          code,
          name
        )
      `
      )
      .eq("company_id", companyId)
      .eq("item_id", itemId)
      .eq("warehouse_id", warehouseId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    if (search) {
      const normalized = search.replace(/[,%]/g, " ");
      const filters = [`batch_location_sku.ilike.%${normalized}%`];
      if (batchIds.length > 0) {
        filters.push(`item_batch_id.in.(${batchIds.join(",")})`);
      }
      query = query.or(filters.join(","));
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading item batch locations:", error);
      return NextResponse.json({ error: "Failed to load item batches" }, { status: 500 });
    }

    const rows = (data || []) as BatchLocationRow[];
    const formatted = rows.map((row) => {
      const itemBatch = toOne(row.item_batch);
      const location = toOne(row.warehouse_location);

      return {
        id: row.id,
        itemId: row.item_id,
        warehouseId: row.warehouse_id,
        locationId: row.location_id,
        itemBatchId: row.item_batch_id,
        batchLocationSku: row.batch_location_sku,
        batchCode: itemBatch?.batch_code || "",
        receivedAt: itemBatch?.received_at || "",
        qtyOnHand: toNumber(row.qty_on_hand),
        qtyAvailable: toNumber(row.qty_available),
        qtyReserved: toNumber(row.qty_reserved),
        locationCode: location?.code || null,
        locationName: location?.name || null,
      };
    });

    return NextResponse.json({ data: formatted });
  } catch (error) {
    console.error("Error loading item batch locations:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
