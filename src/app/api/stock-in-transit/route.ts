import { NextRequest, NextResponse } from "next/server";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import type { StockInTransitResponse, StockInTransitRow } from "@/types/stock-in-transit";

type StockInTransitRpcRow = {
  id: string;
  load_list_id: string;
  ll_number: string;
  supplier_code: string;
  supplier_name: string;
  source_business_unit_code: string;
  source_business_unit_name: string;
  item_id: string;
  item_code: string;
  item_name: string;
  unit_name: string;
  load_list_qty: number | string;
  qty_per_unit: number | string;
  base_quantity: number | string;
  estimated_arrival_date: string | null;
  liner_name: string | null;
  container_number: string | null;
  total_count: number | string;
  total_base_quantity: number | string;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;

const parsePositiveInteger = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toNumber = (value: number | string | null | undefined) => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeSearch = (value: string | null) => {
  const normalized = value?.trim().slice(0, 100).replaceAll("%", "").replaceAll("_", "");
  return normalized || null;
};

const mapRow = (row: StockInTransitRpcRow): StockInTransitRow => ({
  id: row.id,
  loadListId: row.load_list_id,
  loadListNumber: row.ll_number,
  supplierCode: row.supplier_code,
  supplierName: row.supplier_name,
  sourceBusinessUnitCode: row.source_business_unit_code,
  sourceBusinessUnitName: row.source_business_unit_name,
  itemId: row.item_id,
  itemCode: row.item_code,
  itemName: row.item_name,
  unitName: row.unit_name,
  loadListQuantity: toNumber(row.load_list_qty),
  quantityPerUnit: toNumber(row.qty_per_unit),
  baseQuantity: toNumber(row.base_quantity),
  estimatedArrivalDate: row.estimated_arrival_date,
  linerName: row.liner_name,
  containerNumber: row.container_number,
});

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;

    if (!context.currentBusinessUnitId) {
      return NextResponse.json(
        { error: "Select a business unit to view stock in transit" },
        { status: 400 }
      );
    }

    const page = parsePositiveInteger(request.nextUrl.searchParams.get("page"), 1);
    const limit = Math.min(
      parsePositiveInteger(request.nextUrl.searchParams.get("limit"), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const search = normalizeSearch(request.nextUrl.searchParams.get("search"));

    const { data, error } = await context.supabase.rpc("get_stock_in_transit_page", {
      p_company_id: context.companyId,
      p_business_unit_id: context.currentBusinessUnitId,
      p_search: search,
      p_page: page,
      p_limit: limit,
    });

    if (error) {
      console.error("Failed to fetch stock in transit:", error);
      return NextResponse.json({ error: "Failed to fetch stock in transit" }, { status: 500 });
    }

    const rows = (data || []) as StockInTransitRpcRow[];
    const total = rows.length > 0 ? toNumber(rows[0].total_count) : 0;
    const response: StockInTransitResponse = {
      data: rows.map(mapRow),
      summary: {
        totalBaseQuantity: rows.length > 0 ? toNumber(rows[0].total_base_quantity) : 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected stock in transit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "stock_in_transit",
  route: "/api/stock-in-transit",
});
