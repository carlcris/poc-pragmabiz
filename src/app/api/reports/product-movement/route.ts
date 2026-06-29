import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import type {
  ProductMovementReportResponse,
  ProductMovementReportRow,
  ProductMovementReportType,
} from "@/hooks/useProductMovementReport";

type RpcError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

type RpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: RpcError | null }>;
};

type ProductMovementRpcRow = {
  item_id?: string | null;
  item_code?: string | null;
  item_name?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  uom?: string | null;
  quantity_sold?: number | string | null;
  revenue?: number | string | null;
  transaction_count?: number | string | null;
  current_stock?: number | string | null;
  available_stock?: number | string | null;
  unit_cost?: number | string | null;
  stock_value?: number | string | null;
  average_daily_quantity?: number | string | null;
  days_of_cover?: number | string | null;
  last_sold_at?: string | null;
  movement_rank?: number | string | null;
  total_count?: number | string | null;
  summary_total_quantity_sold?: number | string | null;
  summary_total_revenue?: number | string | null;
  summary_total_stock_value?: number | string | null;
  summary_zero_sales_count?: number | string | null;
  summary_average_daily_quantity?: number | string | null;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
const VALID_MOVEMENT_TYPES: ProductMovementReportType[] = ["fast", "slow"];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const asRpcClient = (client: unknown): RpcClient => client as RpcClient;

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseMovementType = (value: string | null): ProductMovementReportType =>
  VALID_MOVEMENT_TYPES.includes(value as ProductMovementReportType)
    ? (value as ProductMovementReportType)
    : "fast";

const parsePositiveInt = (value: string | null, fallback: number, max = MAX_PAGE_SIZE) => {
  const parsed = Number.parseInt(value || "", 10);
  const normalized = Number.isFinite(parsed) ? Math.max(parsed, 1) : fallback;
  return Math.min(normalized, max);
};

const parseCategoryId = (value: string | null) => {
  if (!value || value === "all") return null;
  return UUID_REGEX.test(value) ? value : null;
};

const transformRow = (row: ProductMovementRpcRow): ProductMovementReportRow | null => {
  if (!row.item_id || !row.item_code || !row.item_name) return null;

  return {
    itemId: row.item_id,
    itemCode: row.item_code,
    itemName: row.item_name,
    categoryId: row.category_id || null,
    categoryName: row.category_name || null,
    uom: row.uom || null,
    quantitySold: toNumber(row.quantity_sold),
    revenue: toNumber(row.revenue),
    transactionCount: toNumber(row.transaction_count),
    currentStock: toNumber(row.current_stock),
    availableStock: toNumber(row.available_stock),
    unitCost: toNumber(row.unit_cost),
    stockValue: toNumber(row.stock_value),
    averageDailyQuantity: toNumber(row.average_daily_quantity),
    daysOfCover: row.days_of_cover == null ? null : toNumber(row.days_of_cover),
    lastSoldAt: row.last_sold_at || null,
    movementRank: toNumber(row.movement_rank),
  };
};

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.REPORTS, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId } = context;

    const searchParams = request.nextUrl.searchParams;
    const movementType = parseMovementType(searchParams.get("movementType"));
    const page = parsePositiveInt(searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePositiveInt(searchParams.get("limit"), DEFAULT_PAGE_SIZE);
    const dateFrom = searchParams.get("dateFrom") || null;
    const dateTo = searchParams.get("dateTo") || null;
    const categoryId = parseCategoryId(searchParams.get("categoryId"));
    const search = searchParams.get("search")?.trim() || null;

    const result = await asRpcClient(supabase).rpc("get_product_movement_report", {
      p_company_id: companyId,
      p_business_unit_id: currentBusinessUnitId || null,
      p_movement_type: movementType,
      p_date_from: dateFrom,
      p_date_to: dateTo,
      p_category_id: categoryId,
      p_search: search,
      p_page: page,
      p_limit: limit,
    });

    if (result.error) {
      console.error("Failed to fetch product movement report:", result.error);
      return NextResponse.json(
        { error: "Failed to fetch product movement report" },
        { status: 500 }
      );
    }

    const rpcRows = Array.isArray(result.data) ? (result.data as ProductMovementRpcRow[]) : [];
    const rows = rpcRows
      .map(transformRow)
      .filter((row): row is ProductMovementReportRow => Boolean(row));
    const firstRow = rpcRows[0];
    const total = toNumber(firstRow?.total_count);

    const response: ProductMovementReportResponse = {
      data: rows,
      summary: {
        rowCount: total,
        totalQuantitySold: toNumber(firstRow?.summary_total_quantity_sold),
        totalRevenue: toNumber(firstRow?.summary_total_revenue),
        totalStockValue: toNumber(firstRow?.summary_total_stock_value),
        zeroSalesCount: toNumber(firstRow?.summary_zero_sales_count),
        averageDailyQuantity: toNumber(firstRow?.summary_average_daily_quantity),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      filters: {
        movementType,
        dateFrom,
        dateTo,
        categoryId,
        search,
        currentBusinessUnitId: currentBusinessUnitId || null,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected product movement report error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "product_movement",
  route: "/api/reports/product-movement",
});
