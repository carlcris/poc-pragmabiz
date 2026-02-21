import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { mapStockRequest } from "../../stock-request-mapper";

type StockRequestDbRecord = Parameters<typeof mapStockRequest>[0];

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/stock-requests/[id]/cancel - Cancel stock request
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const requestContext = await requireRequestContext();
    if ("status" in requestContext) return requestContext;
    const { supabase, userId, companyId } = requestContext;
    const { id } = await context.params;
    const body = await request.json();
    const { data: userProfile } = await supabase
      .from("users")
      .select("email")
      .eq("id", userId)
      .maybeSingle();

    // Check if request exists and is not already completed or cancelled
    const { data: existingRequest, error: checkError } = await supabase
      .from("stock_requests")
      .select("id, status, notes")
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (checkError || !existingRequest) {
      return NextResponse.json({ error: "Stock request not found" }, { status: 404 });
    }

    if (existingRequest.status === "completed") {
      return NextResponse.json(
        { error: "Completed stock requests cannot be cancelled" },
        { status: 400 }
      );
    }

    if (existingRequest.status === "cancelled") {
      return NextResponse.json({ error: "Stock request is already cancelled" }, { status: 400 });
    }

    // Append cancellation reason to notes
    const actorEmail = userProfile?.email || userId;
    const cancellationNote = body.reason
      ? `\n[CANCELLED by ${actorEmail}]: ${body.reason}`
      : `\n[CANCELLED by ${actorEmail}]`;
    const updatedNotes = (existingRequest.notes || "") + cancellationNote;

    // Update status to cancelled
    const { error: updateError } = await supabase
      .from("stock_requests")
      .update({
        status: "cancelled",
        notes: updatedNotes,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("company_id", companyId);

    if (updateError) {
      console.error("Error cancelling stock request:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Fetch updated request
    const { data: updatedRequest } = await supabase
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
        )
      `
      )
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (!updatedRequest) {
      return NextResponse.json({ error: "Stock request not found" }, { status: 404 });
    }

    return NextResponse.json(mapStockRequest(updatedRequest as StockRequestDbRecord));
  } catch (error) {
    console.error("Error in stock-request cancel:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
