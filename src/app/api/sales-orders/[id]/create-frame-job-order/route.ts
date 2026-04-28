import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { asRpcClient, getClientErrorMessage, logQuotationError } from "../../../quotations/_shared";

type CreateFrameJobOrderResult = {
  job_order_id: string;
  job_order_code: string;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.SALES_ORDERS, "edit");
    if (unauthorized) return unauthorized;

    const { id: salesOrderId } = await params;
    const body = (await request.json().catch(() => ({}))) as { warehouseId?: string | null };
    const { supabase } = await createServerClientWithBU();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!body.warehouseId) {
      return NextResponse.json(
        { error: "Warehouse is required to reserve frame materials" },
        { status: 400 }
      );
    }

    const { data, error } = await asRpcClient(supabase).rpc(
      "create_frame_job_order_from_sales_order_transaction",
      {
        p_sales_order_id: salesOrderId,
        p_warehouse_id: body.warehouseId,
      }
    );

    const rows = Array.isArray(data) ? (data as CreateFrameJobOrderResult[]) : [];
    const result = rows[0];

    if (error || !result) {
      logQuotationError("Error creating job order from sales order:", error);
      const message = getClientErrorMessage(error, "Failed to create job order");
      const status = message === "Sales order not found" ? 404 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({
      success: true,
      salesOrderId,
      frameJobOrder: {
        id: result.job_order_id,
        jobOrderCode: result.job_order_code,
      },
    });
  } catch (error) {
    logQuotationError("Unexpected sales order job order creation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
