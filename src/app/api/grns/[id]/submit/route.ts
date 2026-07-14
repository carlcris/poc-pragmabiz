import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import {
  GRN_RECEIVING_SUBMIT_CAPABILITY,
  requireGrnReceivingOperation,
} from "@/lib/grns/permissions";
import { fetchMobileGrnReceivingRecord } from "@/lib/grns/mobile-receiving-detail";
import { submitGrnReceivingSchema } from "@/lib/grns/receiving-validation";

const userSafeSubmitMessage = (message: string | undefined) => {
  const allowedMessages = new Set([
    "GRN not found",
    "Only draft, receiving, or pending confirmation GRNs can be staged",
    "Only receiving GRNs can be saved",
    "GRN item not found",
    "Duplicate GRN item",
    "Invalid GRN receiving payload",
    "GRN has no items",
    "At least one GRN item must have a received quantity",
  ]);

  return message && allowedMessages.has(message) ? message : "Failed to submit GRN";
};

// POST /api/grns/[id]/submit - Submit GRN for confirmation
async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireGrnReceivingOperation(GRN_RECEIVING_SUBMIT_CAPABILITY);
    if (access instanceof NextResponse) return access;
    const { id } = await params;
    const { supabase, userId, companyId, currentBusinessUnitId } = access.context;

    const body = await request.json().catch(() => ({}));
    const parsed = submitGrnReceivingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid GRN submit payload" }, { status: 400 });
    }

    const { data: stockTransactionCode, error: submitError } = await supabase.rpc(
      "submit_grn_receiving_transaction",
      {
        p_company_id: companyId,
        p_user_id: userId,
        p_grn_id: id,
        p_notes: parsed.data.notes || null,
        p_receiving_patch: parsed.data.receivingPatch ?? null,
      }
    );

    if (submitError) {
      console.error("Error submitting GRN to putaway:", submitError);
      const status = submitError.message === "Unauthorized" ? 403 : 400;
      return NextResponse.json({ error: userSafeSubmitMessage(submitError.message) }, { status });
    }

    const grn = await fetchMobileGrnReceivingRecord({
      supabase,
      companyId,
      currentBusinessUnitId,
      grnId: id,
    });
    if (!grn) {
      return NextResponse.json({ error: "Failed to load submitted GRN" }, { status: 500 });
    }

    return NextResponse.json({
      grn,
      stockTransactionCode: stockTransactionCode || null,
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "submit",
  resourceType: "grns",
  route: "/api/grns/[id]/submit",
});
