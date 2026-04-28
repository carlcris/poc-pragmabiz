import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { asRpcClient, getClientErrorMessage, logQuotationError } from "../../_shared";

type ConvertQuotationResult = {
  sales_order_id: string;
  order_code: string;
};

// POST /api/quotations/[id]/convert-to-sales-order
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(RESOURCES.SALES_QUOTATIONS, "edit");

    const { id: quotationId } = await params;
    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const { data, error } = await asRpcClient(supabase).rpc(
      "convert_sales_quotation_to_order_transaction",
      {
        p_quotation_id: quotationId,
        p_business_unit_id: currentBusinessUnitId,
      }
    );

    const rows = Array.isArray(data) ? (data as ConvertQuotationResult[]) : [];
    const salesOrder = rows[0];

    if (error || !salesOrder) {
      logQuotationError("Error converting quotation to sales order:", error);
      const message = getClientErrorMessage(error, "Failed to convert quotation to sales order");
      const status = message === "Quotation not found" ? 404 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({
      success: true,
      message: "Quotation successfully converted to Sales Order",
      salesOrder: {
        id: salesOrder.sales_order_id,
        orderNumber: salesOrder.order_code,
      },
    });
  } catch (error) {
    logQuotationError("Unexpected quotation conversion error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
