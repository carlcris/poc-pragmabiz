import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { asRpcClient, getClientErrorMessage, logQuotationError } from "../../../quotations/_shared";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.SALES_QUOTATIONS, "edit");
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

    const { error } = await asRpcClient(supabase).rpc("complete_frame_job_order_transaction", {
      p_job_order_id: jobOrderId,
    });

    if (error) {
      logQuotationError("Error completing job order:", error);
      const message = getClientErrorMessage(error, "Failed to complete job order");
      const status = message === "Job order not found" ? 404 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ success: true, jobOrderId });
  } catch (error) {
    logQuotationError("Unexpected job order completion error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
