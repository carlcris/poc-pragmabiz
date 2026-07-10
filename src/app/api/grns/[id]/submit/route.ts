import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import {
  GRN_RECEIVING_SUBMIT_CAPABILITY,
  requireGrnReceivingOperation,
} from "@/lib/grns/permissions";
import { z } from "zod";

const submitGrnSchema = z
  .object({
    notes: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict();

const userSafeSubmitMessage = (message: string | undefined) => {
  const allowedMessages = new Set([
    "GRN not found",
    "Only draft or receiving GRNs can be submitted",
    "GRN has no items",
    "At least one GRN item must have a received quantity",
  ]);

  return message && allowedMessages.has(message) ? message : "Failed to submit GRN";
};

// POST /api/grns/[id]/submit - Submit GRN for confirmation
async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requireGrnReceivingOperation(GRN_RECEIVING_SUBMIT_CAPABILITY);
    if (unauthorized) return unauthorized;
    const { id } = await params;
    const { supabase } = await createServerClientWithBU();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = submitGrnSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid GRN submit payload" }, { status: 400 });
    }

    // Load response context; the RPC owns workflow validation and all writes.
    const { data: grn, error: fetchError } = await supabase
      .from("grns")
      .select("id, grn_number, company_id")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !grn) {
      return NextResponse.json({ error: "GRN not found" }, { status: 404 });
    }

    const { data: stockTransactionCode, error: submitError } = await supabase.rpc(
      "submit_grn_to_putaway",
      {
        p_company_id: grn.company_id,
        p_user_id: user.id,
        p_grn_id: grn.id,
        p_notes: parsed.data.notes || null,
      }
    );

    if (submitError) {
      console.error("Error submitting GRN to putaway:", submitError);
      const status = submitError.message === "Unauthorized" ? 403 : 400;
      return NextResponse.json({ error: userSafeSubmitMessage(submitError.message) }, { status });
    }

    return NextResponse.json({
      id: grn.id,
      grnNumber: grn.grn_number,
      stockTransactionCode: stockTransactionCode || null,
      status: "pending_approval",
      message: "GRN submitted for confirmation successfully",
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
