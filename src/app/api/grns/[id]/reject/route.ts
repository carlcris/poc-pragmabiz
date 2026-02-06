import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// POST /api/grns/[id]/reject - Reject GRN
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.GOODS_RECEIPT_NOTES, "edit");
    const { id } = await params;
    const { supabase } = await createServerClientWithBU();
    const body = await request.json();

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

    // Validate rejection reason
    if (!body.reason || body.reason.trim() === "") {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      );
    }

    // Fetch GRN
    const { data: grn, error: fetchError } = await supabase
      .from("grns")
      .select("id, grn_number, status, notes")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !grn) {
      return NextResponse.json({ error: "GRN not found" }, { status: 404 });
    }

    // Only allow rejecting GRNs in pending_approval status
    if (grn.status !== "pending_approval") {
      return NextResponse.json(
        { error: "Only GRNs in pending approval can be rejected" },
        { status: 400 }
      );
    }

    // Update GRN status to rejected and add rejection notes
    const { error: updateError } = await supabase
      .from("grns")
      .update({
        status: "rejected",
        notes: `${grn.notes ? grn.notes + "\n\n" : ""}REJECTED: ${body.reason}`,
        checked_by: user.id,
        updated_by: user.id,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error rejecting GRN:", updateError);
      return NextResponse.json(
        { error: "Failed to reject GRN" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: grn.id,
      grnNumber: grn.grn_number,
      status: "rejected",
      message: "GRN rejected successfully",
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
