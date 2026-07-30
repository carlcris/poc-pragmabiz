import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { mapStockRequest } from "../../stock-request-mapper";
import { notifyBusinessUnits } from "@/app/api/_lib/workflow-notifications";
import { STOCK_REQUEST_SELECT } from "../../stock-request-select";

type StockRequestDbRecord = Parameters<typeof mapStockRequest>[0];

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/stock-requests/[id]/submit - Submit stock request for approval
async function POSTHandler(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const requestContext = await requireRequestContext();
    if ("status" in requestContext) return requestContext;
    const { supabase, userId, companyId, currentBusinessUnitId } = requestContext;
    const { id } = await context.params;

    // Check if request exists and is draft
    const { data: existingRequest, error: checkError } = await supabase
      .from("stock_requests")
      .select("id, status, request_code, business_unit_id, fulfilling_business_unit_id")
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (checkError || !existingRequest) {
      return NextResponse.json({ error: "Stock request not found" }, { status: 404 });
    }

    if (existingRequest.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft stock requests can be submitted" },
        { status: 400 }
      );
    }
    if (existingRequest.business_unit_id !== currentBusinessUnitId) {
      return NextResponse.json(
        { error: "Only the requesting business unit can submit this stock request" },
        { status: 403 }
      );
    }

    // Update status to submitted
    const { error: updateError } = await supabase
      .from("stock_requests")
      .update({
        status: "submitted",
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("company_id", companyId);

    if (updateError) {
      console.error("Error submitting stock request:", updateError);
      return NextResponse.json({ error: "Failed to submit stock request" }, { status: 500 });
    }

    try {
      await notifyBusinessUnits({
        supabase,
        companyId,
        actorUserId: userId,
        businessUnitIds: [existingRequest.fulfilling_business_unit_id],
        title: "New stock request",
        message: `New Stock request ${existingRequest.request_code} received.`,
        type: "stock_request_workflow",
        metadata: {
          stock_request_id: existingRequest.id,
          request_code: existingRequest.request_code,
          status: "submitted",
          requesting_business_unit_id: existingRequest.business_unit_id,
          fulfilling_business_unit_id: existingRequest.fulfilling_business_unit_id,
        },
      });
    } catch (notificationError) {
      console.error("Error creating stock request submission notifications:", notificationError);
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
    console.error("Error in stock-request submit:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "submit",
  resourceType: "stock_requests",
  route: "/api/stock-requests/[id]/submit",
});
