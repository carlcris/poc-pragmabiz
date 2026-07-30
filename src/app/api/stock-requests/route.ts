import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { mapStockRequest } from "./stock-request-mapper";
import type { CreateStockRequestPayload } from "@/types/stock-request";
import { STOCK_REQUEST_SELECT } from "./stock-request-select";
import { mapStockRequestDraftRpcError } from "./stock-request-draft-errors";
import { validateStockRequestDraftPayload } from "./stock-request-draft-validation";

type StockRequestDbRecord = Parameters<typeof mapStockRequest>[0];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const VALID_STATUSES = new Set([
  "draft",
  "submitted",
  "approved",
  "picking",
  "picked",
  "delivered",
  "received",
  "completed",
  "cancelled",
  "allocating",
  "partially_allocated",
  "allocated",
  "dispatched",
  "partially_fulfilled",
  "fulfilled",
]);
const VALID_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeSearch = (value: string | null) => {
  if (!value) return null;
  const normalized = value.trim().slice(0, 100).replace(/[,%]/g, " ");
  return normalized.length > 0 ? normalized : null;
};

// GET /api/stock-requests - List stock requests
async function GETHandler(request: NextRequest) {
  try {
    // Require 'stock_requests' view permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId } = context;
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const search = normalizeSearch(searchParams.get("search"));
    const requestingBusinessUnitId = searchParams.get("requestingBusinessUnitId");
    const fulfillingBusinessUnitId = searchParams.get("fulfillingBusinessUnitId");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
    const offset = (page - 1) * limit;

    if (requestingBusinessUnitId && !UUID_REGEX.test(requestingBusinessUnitId)) {
      return NextResponse.json(
        { error: "Invalid requesting business unit filter" },
        { status: 400 }
      );
    }
    if (fulfillingBusinessUnitId && !UUID_REGEX.test(fulfillingBusinessUnitId)) {
      return NextResponse.json(
        { error: "Invalid fulfilling business unit filter" },
        { status: 400 }
      );
    }
    if (status && !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }
    if (priority && !VALID_PRIORITIES.has(priority)) {
      return NextResponse.json({ error: "Invalid priority filter" }, { status: 400 });
    }

    // Build query
    let query = supabase
      .from("stock_requests")
      .select(STOCK_REQUEST_SELECT, { count: "exact" })
      .eq("company_id", companyId)
      .is("deleted_at", null);

    if (currentBusinessUnitId) {
      query = query.or(
        `business_unit_id.eq.${currentBusinessUnitId},and(fulfilling_business_unit_id.eq.${currentBusinessUnitId},status.neq.draft)`
      );
    }

    // Apply filters
    if (search) {
      query = query.or(
        `request_code.ilike.%${search}%,purpose.ilike.%${search}%,department.ilike.%${search}%`
      );
    }
    if (requestingBusinessUnitId) {
      query = query.eq("business_unit_id", requestingBusinessUnitId);
    }
    if (fulfillingBusinessUnitId) {
      query = query.eq("fulfilling_business_unit_id", fulfillingBusinessUnitId);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (priority) {
      query = query.eq("priority", priority);
    }
    if (startDate) {
      query = query.gte("request_date", startDate);
    }
    if (endDate) {
      query = query.lte("request_date", endDate);
    }

    // Execute query
    const {
      data: requests,
      error,
      count,
    } = await query
      .order("request_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching stock requests:", error);
      return NextResponse.json({ error: "Failed to load stock requests" }, { status: 500 });
    }

    const formattedRequests = ((requests || []) as StockRequestDbRecord[]).map((request) =>
      mapStockRequest(request)
    );

    return NextResponse.json({
      data: formattedRequests,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error in stock-requests API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/stock-requests - Create new stock request
async function POSTHandler(request: NextRequest) {
  try {
    // Require 'stock_requests' create permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "create");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId } = context;
    const body = (await request.json().catch(() => null)) as CreateStockRequestPayload | null;
    const validationError = validateStockRequestDraftPayload(body, {
      requireFulfillingBusinessUnit: true,
    });
    if (validationError) {
      return NextResponse.json(validationError, { status: 400 });
    }
    if (!body) {
      return NextResponse.json(
        {
          code: "STOCK_REQUEST_HEADER_INVALID",
          error: "Complete the required stock request details before saving.",
        },
        { status: 400 }
      );
    }

    // Validate business unit context
    if (!currentBusinessUnitId) {
      return NextResponse.json(
        {
          code: "STOCK_REQUEST_CONTEXT_INVALID",
          error: "Select a valid business unit before saving the stock request.",
        },
        { status: 400 }
      );
    }

    const fulfillingBusinessUnitId = body.fulfilling_business_unit_id;

    if (currentBusinessUnitId === fulfillingBusinessUnitId) {
      return NextResponse.json(
        {
          code: "STOCK_REQUEST_BUSINESS_UNITS_MUST_DIFFER",
          error: "The requesting and fulfilling business units must be different.",
        },
        { status: 400 }
      );
    }

    const rpcItems = body.items.map((item) => ({
      item_id: item.item_id,
      requested_qty: item.requested_qty,
      item_unit_option_id: item.item_unit_option_id,
      selected_item_batch_id: item.selected_item_batch_id || null,
      uom_id: item.uom_id,
      notes: item.notes || null,
    }));

    const { data: stockRequestId, error: saveError } = await supabase.rpc(
      "create_stock_request_draft",
      {
        p_business_unit_id: currentBusinessUnitId,
        p_fulfilling_business_unit_id: fulfillingBusinessUnitId,
        p_request_date: body.request_date,
        p_required_date: body.required_date,
        p_department: body.department || null,
        p_priority: body.priority,
        p_purpose: body.purpose || null,
        p_notes: body.notes || null,
        p_items: rpcItems,
      }
    );

    if (saveError || !stockRequestId) {
      console.error("Error creating stock request draft:", saveError);
      const mappedError = mapStockRequestDraftRpcError(saveError?.message || "");
      return NextResponse.json(mappedError.body, { status: mappedError.status });
    }

    // Fetch the complete request with items
    const { data: completeRequest, error: fetchError } = await supabase
      .from("stock_requests")
      .select(STOCK_REQUEST_SELECT)
      .eq("id", stockRequestId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !completeRequest) {
      console.error("Error fetching created stock request:", fetchError);
      return NextResponse.json({ error: "Failed to fetch created request" }, { status: 500 });
    }

    return NextResponse.json(mapStockRequest(completeRequest as StockRequestDbRecord), {
      status: 201,
    });
  } catch (error) {
    console.error("Error in stock-requests POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "stock_requests",
  route: "/api/stock-requests",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "stock_requests",
  route: "/api/stock-requests",
});
