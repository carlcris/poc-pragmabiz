import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { mapStockRequest } from "../stock-request-mapper";
import type { StockRequest, UpdateStockRequestPayload } from "@/types/stock-request";
import { STOCK_REQUEST_SELECT } from "../stock-request-select";
import { mapStockRequestDraftRpcError } from "../stock-request-draft-errors";
import { validateStockRequestDraftPayload } from "../stock-request-draft-validation";

type StockRequestDbRecord = Parameters<typeof mapStockRequest>[0];

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/stock-requests/[id] - Get single stock request
async function GETHandler(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "view");
    if (unauthorized) return unauthorized;

    const requestContext = await requireRequestContext();
    if ("status" in requestContext) return requestContext;
    const { supabase, companyId } = requestContext;
    const { id } = await context.params;

    const { data: stockRequest, error } = await supabase
      .from("stock_requests")
      .select(STOCK_REQUEST_SELECT)
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (error) {
      console.error("Error fetching stock request:", error);
      return NextResponse.json({ error: "Stock request not found" }, { status: 404 });
    }

    if (!stockRequest) {
      return NextResponse.json({ error: "Stock request not found" }, { status: 404 });
    }

    const mapped = mapStockRequest(stockRequest as StockRequestDbRecord) as StockRequest;

    const [{ data: headerLinks }, { data: itemLinks }] = await Promise.all([
      supabase
        .from("delivery_note_sources")
        .select("dn_id")
        .eq("sr_id", id)
        .eq("company_id", companyId),
      supabase
        .from("delivery_note_items")
        .select("dn_id")
        .eq("sr_id", id)
        .eq("company_id", companyId),
    ]);

    const dnIds = Array.from(
      new Set([
        ...(headerLinks || []).map((row) => row.dn_id).filter(Boolean),
        ...(itemLinks || []).map((row) => row.dn_id).filter(Boolean),
      ])
    );

    if (dnIds.length > 0) {
      const { data: notes } = await supabase
        .from("delivery_notes")
        .select("id, dn_no, status, created_at")
        .in("id", dnIds)
        .eq("status", "received")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      mapped.fulfilling_delivery_notes = (notes || []).map((note) => ({
        id: note.id,
        dn_no: note.dn_no,
        status: note.status,
        created_at: note.created_at,
      }));
      mapped.fulfilling_delivery_note = mapped.fulfilling_delivery_notes[0] || null;
    } else {
      mapped.fulfilling_delivery_notes = [];
      mapped.fulfilling_delivery_note = null;
    }

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Error in stock-request GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/stock-requests/[id] - Update stock request (draft only)
async function PATCHHandler(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const requestContext = await requireRequestContext();
    if ("status" in requestContext) return requestContext;
    const { supabase, companyId } = requestContext;
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as UpdateStockRequestPayload | null;
    const validationError = validateStockRequestDraftPayload(body, {
      requireFulfillingBusinessUnit: false,
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

    if ("fulfilling_business_unit_id" in body) {
      return NextResponse.json(
        {
          code: "STOCK_REQUEST_FULFILLING_BUSINESS_UNIT_IMMUTABLE",
          error: "The fulfilling business unit cannot be changed after creation.",
        },
        { status: 400 }
      );
    }

    const { data: existingRequest, error: checkError } = await supabase
      .from("stock_requests")
      .select("id, status, fulfilling_business_unit_id")
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (checkError || !existingRequest) {
      return NextResponse.json({ error: "Stock request not found" }, { status: 404 });
    }

    if (existingRequest.status !== "draft") {
      return NextResponse.json(
        {
          code: "STOCK_REQUEST_NOT_DRAFT",
          error: "Only draft stock requests can be updated.",
        },
        { status: 409 }
      );
    }

    if (!existingRequest.fulfilling_business_unit_id) {
      return NextResponse.json(
        {
          code: "STOCK_REQUEST_FULFILLING_BUSINESS_UNIT_INVALID",
          error: "The stock request does not have a valid fulfilling business unit.",
        },
        { status: 409 }
      );
    }

    const rpcItems = (body.items || []).map((item) => ({
      item_id: item.item_id,
      requested_qty: item.requested_qty,
      item_unit_option_id: item.item_unit_option_id,
      selected_item_batch_id: item.selected_item_batch_id || null,
      uom_id: item.uom_id,
      notes: item.notes || null,
    }));

    const { error: saveError } = await supabase.rpc("update_stock_request_draft", {
      p_stock_request_id: id,
      p_request_date: body.request_date,
      p_required_date: body.required_date,
      p_department: body.department || null,
      p_priority: body.priority,
      p_purpose: body.purpose || null,
      p_notes: body.notes || null,
      p_items: rpcItems,
    });

    if (saveError) {
      console.error("Error updating stock request draft:", saveError);
      const mappedError = mapStockRequestDraftRpcError(saveError.message);
      return NextResponse.json(mappedError.body, { status: mappedError.status });
    }

    const { data: updatedRequest, error: fetchError } = await supabase
      .from("stock_requests")
      .select(STOCK_REQUEST_SELECT)
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !updatedRequest) {
      console.error("Error fetching updated stock request:", fetchError);
      return NextResponse.json({ error: "Stock request not found" }, { status: 404 });
    }

    return NextResponse.json(mapStockRequest(updatedRequest as StockRequestDbRecord));
  } catch (error) {
    console.error("Error in stock-request PATCH:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/stock-requests/[id] - Delete stock request (draft only)
async function DELETEHandler(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "delete");
    if (unauthorized) return unauthorized;

    const requestContext = await requireRequestContext();
    if ("status" in requestContext) return requestContext;
    const { supabase, userId, companyId } = requestContext;
    const { id } = await context.params;

    // Check if request exists and is draft
    const { data: existingRequest, error: checkError } = await supabase
      .from("stock_requests")
      .select("id, status")
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (checkError || !existingRequest) {
      return NextResponse.json({ error: "Stock request not found" }, { status: 404 });
    }

    if (existingRequest.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft stock requests can be deleted" },
        { status: 400 }
      );
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from("stock_requests")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", id)
      .eq("company_id", companyId);

    if (deleteError) {
      console.error("Error deleting stock request:", deleteError);
      return NextResponse.json({ error: "Failed to delete stock request" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in stock-request DELETE:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "stock_requests",
  route: "/api/stock-requests/[id]",
});
export const PATCH = withActivityLogging(PATCHHandler, {
  action: "update",
  resourceType: "stock_requests",
  route: "/api/stock-requests/[id]",
});
export const DELETE = withActivityLogging(DELETEHandler, {
  action: "delete",
  resourceType: "stock_requests",
  route: "/api/stock-requests/[id]",
});
