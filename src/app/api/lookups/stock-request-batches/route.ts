import { NextRequest, NextResponse } from "next/server";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { createAdminClient } from "@/lib/supabase/admin";
import { RESOURCES } from "@/constants/resources";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESULT_LIMIT = 5;

type StockRequestBatchLookupRow = {
  batch_id: string;
  batch_code: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  rack_summary: string;
  received_at: string;
  available_base_qty: number | string;
  total_count: number | string;
};

const parsePage = (value: string | null) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;

    const searchParams = request.nextUrl.searchParams;
    const fulfillingBusinessUnitId = searchParams.get("fulfillingBusinessUnitId")?.trim() || "";
    const itemId = searchParams.get("itemId")?.trim() || "";
    const rawSearch = searchParams.get("search")?.trim() || "";
    const page = parsePage(searchParams.get("page"));

    if (!UUID_PATTERN.test(fulfillingBusinessUnitId) || !UUID_PATTERN.test(itemId)) {
      return NextResponse.json({ error: "Invalid batch lookup context" }, { status: 400 });
    }

    if (rawSearch.length > 100) {
      return NextResponse.json({ error: "Batch search is too long" }, { status: 400 });
    }

    const search = rawSearch.replace(/[,%]/g, " ").trim() || null;
    const { data, error } = await createAdminClient().rpc(
      "search_stock_request_fulfillment_batches",
      {
        p_company_id: context.companyId,
        p_fulfilling_business_unit_id: fulfillingBusinessUnitId,
        p_item_id: itemId,
        p_search: search,
        p_page: page,
        p_limit: RESULT_LIMIT,
      }
    );

    if (error) {
      console.error("Failed to load stock-request batch options:", error);
      return NextResponse.json({ error: "Failed to load fulfillment batches" }, { status: 500 });
    }

    const rows = (data || []) as StockRequestBatchLookupRow[];
    const total = Number(rows[0]?.total_count ?? 0);

    return NextResponse.json({
      data: rows.map((row) => ({
        id: row.batch_id,
        batchCode: row.batch_code,
        warehouseId: row.warehouse_id,
        warehouseCode: row.warehouse_code,
        warehouseName: row.warehouse_name,
        rackSummary: row.rack_summary,
        receivedAt: row.received_at,
        availableBaseQty: Number(row.available_base_qty ?? 0),
      })),
      pagination: {
        page,
        limit: RESULT_LIMIT,
        total,
        totalPages: Math.ceil(total / RESULT_LIMIT),
      },
    });
  } catch (error) {
    console.error("Unexpected stock-request batch lookup failure:", error);
    return NextResponse.json({ error: "Failed to load fulfillment batches" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "lookups",
  route: "/api/lookups/stock-request-batches",
});
