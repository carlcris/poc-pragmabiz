import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { mapStockRequest } from "./stock-request-mapper";
import type { CreateStockRequestPayload } from "@/types/stock-request";

type StockRequestDbRecord = Parameters<typeof mapStockRequest>[0];
type StockRequestItemInput = CreateStockRequestPayload["items"][number];

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
  const normalized = value.trim().replace(/[,%]/g, " ");
  return normalized.length > 0 ? normalized : null;
};

// GET /api/stock-requests - List stock requests
export async function GET(request: NextRequest) {
  try {
    // Require 'stock_requests' view permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "view");
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
    const searchParams = request.nextUrl.searchParams;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    // Parse query parameters
    const search = normalizeSearch(searchParams.get("search"));
    const requestingWarehouseId = searchParams.get("requestingWarehouseId");
    const fulfillingWarehouseId = searchParams.get("fulfillingWarehouseId");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
    const offset = (page - 1) * limit;

    if (requestingWarehouseId && !UUID_REGEX.test(requestingWarehouseId)) {
      return NextResponse.json({ error: "Invalid requesting warehouse filter" }, { status: 400 });
    }
    if (fulfillingWarehouseId && !UUID_REGEX.test(fulfillingWarehouseId)) {
      return NextResponse.json({ error: "Invalid fulfilling warehouse filter" }, { status: 400 });
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
      .select(
        `
        *,
        requesting_warehouse:warehouses!stock_requests_requesting_warehouse_id_fkey(
          id,
          warehouse_code,
          warehouse_name,
          business_unit_id
        ),
        fulfilling_warehouse:warehouses!stock_requests_fulfilling_warehouse_id_fkey(
          id,
          warehouse_code,
          warehouse_name,
          business_unit_id
        ),
        requested_by_user:users!stock_requests_requested_by_user_id_fkey(
          id,
          email,
          first_name,
          last_name
        ),
        received_by_user:users!stock_requests_received_by_fkey(
          id,
          email,
          first_name,
          last_name
        ),
        stock_request_items(
          *,
          items(item_code, item_name),
          units_of_measure(code, symbol)
        ),
        delivery_note_sources(
          created_at,
          delivery_notes!delivery_note_sources_dn_id_fkey(
            id,
            dn_no,
            status,
            created_at
          )
        )
      `,
        { count: "exact" }
      )
      .eq("company_id", userData.company_id)
      .is("deleted_at", null);

    if (currentBusinessUnitId) {
      const { data: currentBuWarehouseRows, error: currentBuWarehousesError } = await supabase
        .from("warehouses")
        .select("id")
        .eq("company_id", userData.company_id)
        .eq("business_unit_id", currentBusinessUnitId)
        .is("deleted_at", null);

      if (currentBuWarehousesError) {
        return NextResponse.json(
          { error: "Failed to resolve current business unit warehouses" },
          { status: 500 }
        );
      }

      const currentBuWarehouseIds = (currentBuWarehouseRows || [])
        .map((row) => row.id)
        .filter((value): value is string => Boolean(value));

      if (currentBuWarehouseIds.length > 0) {
        query = query.or(
          `business_unit_id.eq.${currentBusinessUnitId},and(fulfilling_warehouse_id.in.(${currentBuWarehouseIds.join(",")}),status.neq.draft)`
        );
      } else {
        query = query.eq("business_unit_id", currentBusinessUnitId);
      }
    }

    // Apply filters
    if (search) {
      query = query.or(
        `request_code.ilike.%${search}%,purpose.ilike.%${search}%,department.ilike.%${search}%`
      );
    }
    if (requestingWarehouseId) {
      query = query.eq("requesting_warehouse_id", requestingWarehouseId);
    }
    if (fulfillingWarehouseId) {
      query = query.eq("fulfilling_warehouse_id", fulfillingWarehouseId);
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
    const { data: requests, error, count } = await query
      .order("request_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching stock requests:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const typedRequests = (requests || []) as StockRequestDbRecord[];
    const formattedRequests = typedRequests.map((request) =>
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
export async function POST(request: NextRequest) {
  try {
    // Require 'stock_requests' create permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "create");
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
    const body = (await request.json()) as CreateStockRequestPayload;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id, first_name, last_name, email")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    // Validate business unit context
    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const requestingWarehouseId = body.requesting_warehouse_id;
    const fulfillingWarehouseId = body.fulfilling_warehouse_id;

    // Validate required fields
    if (
      !body.request_date ||
      !body.required_date ||
      !requestingWarehouseId ||
      !fulfillingWarehouseId ||
      !body.priority
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    // Generate request code
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");
    const milliseconds = now.getTime().toString().slice(-4);
    const requestCode = `SR-${dateStr}${milliseconds}`;

    // Build requested_by_name from first_name and last_name
    const requestedByName =
      [userData.first_name, userData.last_name].filter(Boolean).join(" ") ||
      userData.email ||
      user.email;

    // Create stock request header
    const { data: stockRequest, error: requestError } = await supabase
      .from("stock_requests")
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        request_code: requestCode,
        request_date: body.request_date,
        required_date: body.required_date,
        requesting_warehouse_id: requestingWarehouseId,
        fulfilling_warehouse_id: fulfillingWarehouseId,
        department: body.department || null,
        status: "draft",
        priority: body.priority,
        purpose: body.purpose || null,
        notes: body.notes || null,
        requested_by_user_id: user.id,
        requested_by_name: requestedByName,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (requestError) {
      console.error("Error creating stock request:", requestError);
      return NextResponse.json({ error: requestError.message }, { status: 500 });
    }

    // Create stock request items
    const requestItems = body.items.map((item: StockRequestItemInput) => ({
      stock_request_id: stockRequest.id,
      item_id: item.item_id,
      requested_qty: item.requested_qty,
      picked_qty: 0,
      uom_id: item.uom_id,
      notes: item.notes || null,
    }));

    const { error: itemsError } = await supabase.from("stock_request_items").insert(requestItems);

    if (itemsError) {
      console.error("Error creating stock request items:", itemsError);
      // Rollback request
      await supabase.from("stock_requests").delete().eq("id", stockRequest.id);
      return NextResponse.json({ error: "Failed to create request items" }, { status: 500 });
    }

    // Fetch the complete request with items
    const { data: completeRequest } = await supabase
      .from("stock_requests")
      .select(
        `
        *,
        requesting_warehouse:warehouses!stock_requests_requesting_warehouse_id_fkey(
          id,
          warehouse_code,
          warehouse_name,
          business_unit_id
        ),
        fulfilling_warehouse:warehouses!stock_requests_fulfilling_warehouse_id_fkey(
          id,
          warehouse_code,
          warehouse_name,
          business_unit_id
        ),
        requested_by_user:users!stock_requests_requested_by_user_id_fkey(
          id,
          email,
          first_name,
          last_name
        ),
        received_by_user:users!stock_requests_received_by_fkey(
          id,
          email,
          first_name,
          last_name
        ),
        stock_request_items(
          *,
          items(item_code, item_name),
          units_of_measure(code, symbol)
        ),
        delivery_note_sources(
          created_at,
          delivery_notes!delivery_note_sources_dn_id_fkey(
            id,
            dn_no,
            status,
            created_at
          )
        )
      `
      )
      .eq("id", stockRequest.id)
      .single();

    if (!completeRequest) {
      return NextResponse.json({ error: "Failed to fetch created request" }, { status: 500 });
    }

    return NextResponse.json(mapStockRequest(completeRequest as StockRequestDbRecord));
  } catch (error) {
    console.error("Error in stock-requests POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
