import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// POST /api/grns/[id]/approve - Approve GRN and create stock entries
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

    // Fetch GRN with items
    const { data: grn, error: fetchError } = await supabase
      .from("grns")
      .select(
        `
        id, grn_number, status, load_list_id, warehouse_id, company_id, business_unit_id,
        items:grn_items(
          id,
          item_id,
          received_qty,
          damaged_qty,
          item:items(
            id,
            uom_id
          )
        )
      `
      )
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !grn) {
      return NextResponse.json({ error: "GRN not found" }, { status: 404 });
    }

    // Only allow approving GRNs in pending_approval status
    if (grn.status !== "pending_approval") {
      return NextResponse.json(
        { error: "Only GRNs in pending approval can be approved" },
        { status: 400 }
      );
    }

    // Validate all items have been received
    type GrnApproveItem = {
      item_id: string;
      received_qty: number | string | null;
      damaged_qty?: number | string | null;
      item?: { uom_id: string | null } | Array<{ uom_id: string | null }> | null;
    };
    const items = Array.isArray(grn.items) ? (grn.items as GrnApproveItem[]) : [];
    if (items.length === 0) {
      return NextResponse.json({ error: "GRN has no items" }, { status: 400 });
    }

    const { data: stockTransactionCode, error: approveError } = await supabase.rpc(
      "approve_grn_with_batch_inventory",
      {
        p_company_id: grn.company_id,
        p_user_id: user.id,
        p_grn_id: grn.id,
        p_notes: body.notes || null,
      }
    );

    if (approveError) {
      console.error("Error approving GRN via RPC:", approveError);
      return NextResponse.json({ error: approveError.message }, { status: 400 });
    }

    if (grn.load_list_id) {
      const { data: loadList } = await supabase
        .from("load_lists")
        .select("id, ll_number, created_by")
        .eq("id", grn.load_list_id)
        .eq("company_id", grn.company_id)
        .is("deleted_at", null)
        .single();

      if (loadList?.created_by) {
        const { error: notificationError } = await supabase.from("notifications").insert({
          company_id: grn.company_id,
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
      message: "GRN approved and inventory updated successfully",
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
