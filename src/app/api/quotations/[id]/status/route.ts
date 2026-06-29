import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { fetchQuotationById, logQuotationError } from "../../_shared";
import type { QuotationStatus } from "@/types/quotation";

const validManualStatuses: QuotationStatus[] = ["sent", "accepted", "rejected", "expired"];

const getInvalidTransitionMessage = (currentStatus: string, nextStatus: string) => {
  if (currentStatus === "draft" && ["sent", "accepted", "rejected"].includes(nextStatus)) {
    return null;
  }

  if (currentStatus === "sent" && ["accepted", "rejected", "expired"].includes(nextStatus)) {
    return null;
  }

  if (nextStatus === "ordered") {
    return "Accepted quotations must be converted to orders through the conversion endpoint";
  }

  return `Cannot change status from ${currentStatus} to ${nextStatus}`;
};

// PATCH /api/quotations/[id]/status
async function PATCHHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(RESOURCES.SALES_QUOTATIONS, "edit");

    const { id: quotationId } = await params;
    const { status } = (await request.json()) as { status?: string };

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    if (!validManualStatuses.includes(status as QuotationStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { supabase } = await createServerClientWithBU();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: quotation, error: fetchError } = await supabase
      .from("sales_quotations")
      .select("status")
      .eq("id", quotationId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !quotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    const currentStatus = quotation.status || "draft";
    const invalidMessage = getInvalidTransitionMessage(currentStatus, status);
    if (invalidMessage) {
      return NextResponse.json({ error: invalidMessage }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("sales_quotations")
      .update({
        status,
        updated_by: user.id,
      })
      .eq("id", quotationId);

    if (updateError) {
      logQuotationError("Error updating quotation status:", updateError);
      return NextResponse.json({ error: "Failed to update quotation status" }, { status: 500 });
    }

    const { quotation: updatedQuotation, error: updatedFetchError } = await fetchQuotationById(
      supabase,
      quotationId
    );

    if (updatedFetchError || !updatedQuotation) {
      logQuotationError("Error fetching updated quotation status:", updatedFetchError);
      return NextResponse.json(
        { error: "Quotation status was updated but could not be loaded" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedQuotation);
  } catch (error) {
    logQuotationError("Unexpected quotation status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const PATCH = withActivityLogging(PATCHHandler, {
  action: "change_status",
  resourceType: "quotations",
  route: "/api/quotations/[id]/status",
});
