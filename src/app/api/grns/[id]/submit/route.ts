import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// POST /api/grns/[id]/submit - Submit GRN for approval
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Fetch GRN
    const { data: grn, error: fetchError } = await supabase
      .from("grns")
      .select("id, grn_number, status, items:grn_items(id, received_qty)")
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

    // Validate all items have received quantities
    type GrnSubmitItem = {
      received_qty: number | string | null;
    };
    const items = Array.isArray(grn.items) ? (grn.items as GrnSubmitItem[]) : [];
    if (items.length === 0) {
      return NextResponse.json({ error: "GRN has no items" }, { status: 400 });
    }

    const hasReceivedQty = items.every((item) => Number(item.received_qty ?? 0) > 0);
    if (!hasReceivedQty) {
      return NextResponse.json(
        { error: "All items must have received quantities" },
        { status: 400 }
      );
    }

    // Update GRN status to pending_approval
    const { error: updateError } = await supabase
      .from("grns")
      .update({
        status: "pending_approval",
        updated_by: user.id,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error submitting GRN:", updateError);
      return NextResponse.json(
        { error: "Failed to submit GRN" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: grn.id,
      grnNumber: grn.grn_number,
      status: "pending_approval",
      message: "GRN submitted for approval successfully",
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
