import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import type { UpdateQuotationRequest } from "@/types/quotation";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  asRpcClient,
  fetchQuotationById,
  getClientErrorMessage,
  logQuotationError,
} from "../_shared";

// GET /api/quotations/[id] - Get single quotation
async function GETHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(RESOURCES.SALES_QUOTATIONS, "view");

    const { id } = await params;
    const { supabase } = await createServerClientWithBU();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { quotation, error } = await fetchQuotationById(supabase, id);

    if (error || !quotation) {
      logQuotationError("Error fetching quotation:", error);
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    return NextResponse.json(quotation);
  } catch (error) {
    logQuotationError("Unexpected quotation fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/quotations/[id] - Update quotation
async function PUTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(RESOURCES.SALES_QUOTATIONS, "edit");

    const { id } = await params;
    const { supabase } = await createServerClientWithBU();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: UpdateQuotationRequest = await request.json();

    if (!body.quotationDate || !body.items || body.items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (body.status) {
      return NextResponse.json(
        { error: "Quotation status must be changed through the status endpoint" },
        { status: 400 }
      );
    }

    const { data: quotationId, error: rpcError } = await asRpcClient(supabase).rpc(
      "update_sales_quotation_transaction",
      {
        p_quotation_id: id,
        p_quotation_date: body.quotationDate,
        p_valid_until: body.validUntil || null,
        p_terms_conditions: body.termsConditions || null,
        p_notes: body.notes || null,
        p_items: body.items,
      }
    );

    if (rpcError || typeof quotationId !== "string") {
      logQuotationError("Error updating quotation:", rpcError);
      const message = getClientErrorMessage(rpcError, "Failed to update quotation");
      const status = message === "Quotation not found" ? 404 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    const { quotation, error: fetchError } = await fetchQuotationById(supabase, quotationId);

    if (fetchError || !quotation) {
      logQuotationError("Error fetching updated quotation:", fetchError);
      return NextResponse.json(
        { error: "Quotation was updated but could not be loaded" },
        { status: 500 }
      );
    }

    return NextResponse.json(quotation);
  } catch (error) {
    logQuotationError("Unexpected quotation update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/quotations/[id] - Soft delete quotation
async function DELETEHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.SALES_QUOTATIONS, "delete");

    const { id } = await params;
    const { supabase } = await createServerClientWithBU();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error: rpcError } = await asRpcClient(supabase).rpc(
      "delete_sales_quotation_transaction",
      {
        p_quotation_id: id,
      }
    );

    if (rpcError) {
      logQuotationError("Error deleting quotation:", rpcError);
      const message = getClientErrorMessage(rpcError, "Failed to delete quotation");
      const status = message === "Quotation not found" ? 404 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ message: "Quotation deleted successfully" });
  } catch (error) {
    logQuotationError("Unexpected quotation delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "quotations",
  route: "/api/quotations/[id]",
});
export const PUT = withActivityLogging(PUTHandler, {
  action: "update",
  resourceType: "quotations",
  route: "/api/quotations/[id]",
});
export const DELETE = withActivityLogging(DELETEHandler, {
  action: "delete",
  resourceType: "quotations",
  route: "/api/quotations/[id]",
});
