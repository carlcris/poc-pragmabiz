import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { asRpcClient, getClientErrorMessage, logQuotationError } from "../../../quotations/_shared";

type CreateFrameJobOrderResult = {
  job_order_id: string;
  job_order_code: string;
  billing_mode: string;
};

async function POSTHandler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.SALES_ORDERS, "edit");
    if (unauthorized) return unauthorized;

    const { id: salesOrderId } = await params;
    const { supabase } = await createServerClientWithBU();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await asRpcClient(supabase).rpc(
      "create_frame_job_order_from_sales_order_transaction",
      {
        p_sales_order_id: salesOrderId,
      }
    );

    const rows = Array.isArray(data) ? (data as CreateFrameJobOrderResult[]) : [];

    if (error || rows.length === 0) {
      logQuotationError("Error creating job order from sales order:", error);
      const message = getClientErrorMessage(error, "Failed to create job order");
      const status = message === "Sales order not found" ? 404 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    // A mixed order spawns one job order per billing mode, so every created job
    // is returned. `frameJobOrder` stays as the first for callers written
    // against the single-job contract.
    const frameJobOrders = rows.map((row) => ({
      id: row.job_order_id,
      jobOrderCode: row.job_order_code,
      billingMode: row.billing_mode,
    }));

    return NextResponse.json({
      success: true,
      salesOrderId,
      frameJobOrder: frameJobOrders[0],
      frameJobOrders,
    });
  } catch (error) {
    logQuotationError("Unexpected sales order job order creation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "create_frame_job_order",
  resourceType: "sales_orders",
  route: "/api/sales-orders/[id]/create-frame-job-order",
});
