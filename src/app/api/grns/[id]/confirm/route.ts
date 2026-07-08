import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

const userSafeConfirmMessage = (message: string | undefined) => {
  const allowedMessages = new Set([
    "GRN not found",
    "Only GRNs in pending confirmation can be confirmed",
    "GRN must be submitted before confirmation",
    "GRN has no items",
    "At least one GRN item must have a received quantity",
  ]);

  return message && allowedMessages.has(message) ? message : "Failed to confirm GRN";
};

// POST /api/grns/[id]/confirm - Confirm GRN after received stock has been staged to putaway
async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.GOODS_RECEIPT_NOTES, "edit");
    if (unauthorized) return unauthorized;
    const { id } = await params;
    const { supabase } = await createServerClientWithBU();
    const body = await request.json().catch(() => ({} as { notes?: string | null }));

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

    const { data: grn, error: fetchError } = await supabase
      .from("grns")
      .select("id, grn_number, status, load_list_id, company_id, items:grn_items(id)")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !grn) {
      return NextResponse.json({ error: "GRN not found" }, { status: 404 });
    }

    if (grn.status !== "pending_approval") {
      return NextResponse.json(
        { error: "Only GRNs in pending confirmation can be confirmed" },
        { status: 400 }
      );
    }

    const items = Array.isArray(grn.items) ? grn.items : [];
    if (items.length === 0) {
      return NextResponse.json({ error: "GRN has no items" }, { status: 400 });
    }

    const { data: stockTransactionCode, error: confirmError } = await supabase.rpc(
      "confirm_grn_with_putaway",
      {
        p_company_id: grn.company_id,
        p_user_id: user.id,
        p_grn_id: grn.id,
        p_notes: body.notes || null,
      }
    );

    if (confirmError) {
      console.error("Error confirming GRN via RPC:", confirmError);
      const status = confirmError.message === "Unauthorized" ? 403 : 400;
      return NextResponse.json({ error: userSafeConfirmMessage(confirmError.message) }, { status });
    }

    if (grn.load_list_id) {
      const { data: loadList } = await supabase
        .from("load_lists")
        .select("id, ll_number, created_by, business_unit_id")
        .eq("id", grn.load_list_id)
        .eq("company_id", grn.company_id)
        .is("deleted_at", null)
        .single();

      if (loadList?.created_by) {
        const { error: notificationError } = await supabase.from("notifications").insert({
          company_id: grn.company_id,
          business_unit_id: loadList.business_unit_id || null,
          user_id: loadList.created_by,
          title: "Shipments received",
          message: `Load list ${loadList.ll_number} has been received.`,
          type: "load_list_status",
          metadata: {
            load_list_id: loadList.id,
            ll_number: loadList.ll_number,
            status: "received",
          },
        });

        if (notificationError) {
          console.error("Error creating load list notification:", notificationError);
        }
      }
    }

    return NextResponse.json({
      id: grn.id,
      grnNumber: grn.grn_number,
      stockTransactionCode: stockTransactionCode || null,
      status: "approved",
      message: "GRN confirmed successfully",
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "confirm",
  resourceType: "grns",
  route: "/api/grns/[id]/confirm",
});
