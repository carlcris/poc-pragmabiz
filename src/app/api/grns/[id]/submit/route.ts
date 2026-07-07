import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// POST /api/grns/[id]/submit - Submit GRN for approval
async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(RESOURCES.GOODS_RECEIPT_NOTES, "edit");
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

    const body = await request.json().catch(() => ({} as { notes?: string | null }));

    // Fetch GRN
    const { data: grn, error: fetchError } = await supabase
      .from("grns")
      .select("id, grn_number, status, company_id, items:grn_items(id, received_qty)")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !grn) {
      return NextResponse.json({ error: "GRN not found" }, { status: 404 });
    }

    // Only allow submitting GRNs in draft or receiving status
    if (!["draft", "receiving"].includes(grn.status)) {
      return NextResponse.json(
        { error: "Only draft or receiving GRNs can be submitted" },
        { status: 400 }
      );
    }

    // Validate at least one item has a received quantity. Partial receiving is allowed.
    type GrnSubmitItem = {
      received_qty: number | string | null;
    };
    const items = Array.isArray(grn.items) ? (grn.items as GrnSubmitItem[]) : [];
    if (items.length === 0) {
      return NextResponse.json({ error: "GRN has no items" }, { status: 400 });
    }

    const hasReceivedQty = items.some((item) => Number(item.received_qty ?? 0) > 0);
    if (!hasReceivedQty) {
      return NextResponse.json(
        { error: "At least one item must have a received quantity" },
        { status: 400 }
      );
    }

    const { data: stockTransactionCode, error: submitError } = await supabase.rpc(
      "submit_grn_to_putaway",
      {
        p_company_id: grn.company_id,
        p_user_id: user.id,
        p_grn_id: grn.id,
        p_notes: body.notes || null,
      }
    );

    if (submitError) {
      console.error("Error submitting GRN to putaway:", submitError);
      return NextResponse.json({ error: submitError.message }, { status: 400 });
    }

    return NextResponse.json({
      id: grn.id,
      grnNumber: grn.grn_number,
      stockTransactionCode: stockTransactionCode || null,
      status: "pending_approval",
      message: "GRN submitted for approval successfully",
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
