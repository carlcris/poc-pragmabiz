import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { mapStockRequest } from "../../stock-request-mapper";
import { STOCK_REQUEST_SELECT } from "../../stock-request-select";

type StockRequestDbRecord = Parameters<typeof mapStockRequest>[0];

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/stock-requests/[id]/approve - Approve stock request
async function POSTHandler(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const requestContext = await requireRequestContext();
    if ("status" in requestContext) return requestContext;
    const { supabase, userId, companyId, currentBusinessUnitId } = requestContext;
    const { id } = await context.params;

    // Check if request exists and is submitted
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

    if (existingRequest.status !== "submitted") {
      return NextResponse.json(
        { error: "Only submitted stock requests can be approved" },
        { status: 400 }
      );
    }

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    if (existingRequest.fulfilling_business_unit_id !== currentBusinessUnitId) {
      return NextResponse.json(
        { error: "Only the fulfillment business unit can approve this request" },
        { status: 403 }
      );
    }

    // Update status to approved
    const { error: updateError } = await supabase
      .from("stock_requests")
      .update({
        status: "approved",
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("company_id", companyId);

    if (updateError) {
      console.error("Error approving stock request:", updateError);
      return NextResponse.json({ error: "Failed to approve stock request" }, { status: 500 });
    }

    // Fetch updated request
    const { data: updatedRequest } = await supabase
      .from("stock_requests")
      .select(STOCK_REQUEST_SELECT)
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (!updatedRequest) {
      return NextResponse.json({ error: "Stock request not found" }, { status: 404 });
    }

    return NextResponse.json(mapStockRequest(updatedRequest as StockRequestDbRecord));
  } catch (error) {
    console.error("Error in stock-request approve:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "approve",
  resourceType: "stock_requests",
  route: "/api/stock-requests/[id]/approve",
});
