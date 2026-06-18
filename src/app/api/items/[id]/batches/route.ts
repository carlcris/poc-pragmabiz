import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

const parseLimit = (value: string | null) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, MAX_LIMIT)
    : DEFAULT_LIMIT;
};

const normalizeSearch = (value: string | null) => {
  const trimmed = value?.trim() || "";
  return trimmed.length > 0 ? trimmed.replace(/[,%]/g, " ") : null;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "view");
    if (unauthorized) return unauthorized;

    const requestContext = await requireRequestContext();
    if ("status" in requestContext) return requestContext;

    const { supabase, companyId } = requestContext;
    const { id: itemId } = await context.params;
    const warehouseId = request.nextUrl.searchParams.get("warehouseId")?.trim() || "";
    const search = normalizeSearch(request.nextUrl.searchParams.get("search"));
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

    if (!UUID_REGEX.test(itemId)) {
      return NextResponse.json({ error: "Invalid item" }, { status: 400 });
    }

    if (!UUID_REGEX.test(warehouseId)) {
      return NextResponse.json({ error: "Warehouse is required" }, { status: 400 });
    }

    let query = supabase
      .from("item_batches")
      .select(
        "id, batch_code, received_at, qty_on_hand, qty_reserved, qty_available",
        { count: "exact" }
      )
      .eq("company_id", companyId)
      .eq("item_id", itemId)
      .eq("warehouse_id", warehouseId)
      .is("deleted_at", null)
      .gt("qty_available", 0)
      .order("received_at", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(limit);

    if (search) {
      query = query.ilike("batch_code", `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Error loading item batch options:", error);
      return NextResponse.json({ error: "Failed to load item batches" }, { status: 500 });
    }

    return NextResponse.json({
      data: (data || []).map((batch) => ({
        id: batch.id,
        batchCode: batch.batch_code,
        receivedAt: batch.received_at,
        qtyOnHand: Number(batch.qty_on_hand ?? 0),
        qtyReserved: Number(batch.qty_reserved ?? 0),
        qtyAvailable: Number(batch.qty_available ?? 0),
      })),
      pagination: {
        total: count || 0,
        limit,
      },
    });
  } catch (error) {
    console.error("Unexpected error loading item batch options:", error);
    return NextResponse.json({ error: "Failed to load item batches" }, { status: 500 });
  }
}
