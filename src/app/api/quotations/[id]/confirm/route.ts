import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { asRpcClient, getClientErrorMessage, logQuotationError } from "../../_shared";

type ConfirmQuotationResult = {
  quotation_id: string;
  frame_job_order_id: string | null;
  job_order_code: string | null;
  draft_invoice_id: string;
  invoice_code: string;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.SALES_QUOTATIONS, "edit");
    if (unauthorized) return unauthorized;

    const { id: quotationId } = await params;
    const body = (await request.json().catch(() => ({}))) as { warehouseId?: string | null };
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

    const { data, error } = await asRpcClient(supabase).rpc("confirm_sales_quotation_transaction", {
      p_quotation_id: quotationId,
      p_business_unit_id: currentBusinessUnitId,
      p_warehouse_id: body.warehouseId || null,
    });

    const rows = Array.isArray(data) ? (data as ConfirmQuotationResult[]) : [];
    const result = rows[0];

    if (error || !result) {
      logQuotationError("Error confirming quotation:", error);
      const message = getClientErrorMessage(error, "Failed to confirm quotation");
      const status = message === "Quotation not found" ? 404 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({
      success: true,
      quotationId: result.quotation_id,
      frameJobOrder: result.frame_job_order_id
        ? {
            id: result.frame_job_order_id,
            jobOrderCode: result.job_order_code,
          }
        : null,
      draftInvoice: {
        id: result.draft_invoice_id,
        invoiceCode: result.invoice_code,
      },
    });
  } catch (error) {
    logQuotationError("Unexpected quotation confirmation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
