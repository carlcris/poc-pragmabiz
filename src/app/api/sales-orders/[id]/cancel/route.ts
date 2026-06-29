import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type RpcError = {
  message?: string;
};

type RpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: RpcError | null }>;
};

const getClientErrorMessage = (error: RpcError | null | undefined) => {
  const message = error?.message || "";
  if (
    message === "Sales order not found" ||
    message === "Invoiced sales orders cannot be cancelled"
  ) {
    return message;
  }
  return "Failed to cancel sales order";
};

async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.SALES_ORDERS, "edit");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await (supabase as unknown as RpcClient).rpc(
      "cancel_sales_order_transaction",
      {
        p_sales_order_id: id,
      }
    );

    const rows = Array.isArray(data) ? data : [];
    if (error || rows.length === 0) {
      console.error("Error cancelling sales order:", error);
      const message = getClientErrorMessage(error);
      const status = message === "Sales order not found" ? 404 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({
      success: true,
      salesOrderId: id,
      status: "cancelled",
    });
  } catch (error) {
    console.error("Unexpected sales order cancellation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "cancel",
  resourceType: "sales_orders",
  route: "/api/sales-orders/[id]/cancel",
});
