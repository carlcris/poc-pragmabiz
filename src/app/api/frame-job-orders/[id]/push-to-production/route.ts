import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { asRpcClient, getClientErrorMessage, logQuotationError } from "../../../quotations/_shared";

type PushToProductionResult = {
  manufacturing_order_id: string;
  manufacturing_order_code: string;
};

async function POSTHandler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requireAnyPermission([
      [RESOURCES.MANUFACTURING, "create"],
      [RESOURCES.STOCK_TRANSFORMATIONS, "create"],
    ]);
    if (unauthorized) return unauthorized;

    const { id: jobOrderId } = await params;
    const { supabase } = await createServerClientWithBU();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await asRpcClient(supabase).rpc(
      "create_manufacturing_order_from_frame_job_order_transaction",
      {
        p_frame_job_order_id: jobOrderId,
      }
    );

    const rows = Array.isArray(data) ? (data as PushToProductionResult[]) : [];
    const result = rows[0];

    if (error || !result) {
      logQuotationError("Error pushing job order to production:", error);
      const message = getClientErrorMessage(error, "Failed to push job order to production");
      const status = message === "Job order not found" ? 404 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({
      success: true,
      jobOrderId,
      manufacturingOrder: {
        id: result.manufacturing_order_id,
        manufacturingOrderCode: result.manufacturing_order_code,
      },
    });
  } catch (error) {
    logQuotationError("Unexpected push to production error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "push_to_production",
  resourceType: "frame_job_orders",
  route: "/api/frame-job-orders/[id]/push-to-production",
});
