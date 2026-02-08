import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/tablet/purchase-receipts/[id]/receive-all
// Auto-fill all line items with expected quantities
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.PURCHASE_RECEIPTS, "edit");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id } = await context.params;

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

    // Verify receipt exists and is in draft status
    const { data: receipt, error: receiptError } = await supabase
      .from("purchase_receipts")
      .select("id, status")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    if (receipt.status !== "draft") {
      return NextResponse.json({ error: "Only draft receipts can be modified" }, { status: 400 });
    }

    // Update all line items to set quantity_received = quantity_ordered
    const { error: updateError } = await supabase.rpc("receive_all_items", {
      p_receipt_id: id,
      p_user_id: user.id,
    });

    if (updateError) {
      // If RPC doesn't exist, fall back to manual update
      const { data: items, error: itemsError } = await supabase
        .from("purchase_receipt_items")
        .select("id, quantity_ordered")
        .eq("receipt_id", id)
        .is("deleted_at", null);

      if (itemsError) {
        console.error("Error fetching items:", itemsError);
        return NextResponse.json({ error: itemsError.message }, { status: 500 });
      }

      // Update each item
      const updatePromises = items?.map((item) =>
        supabase
          .from("purchase_receipt_items")
          .update({
            quantity_received: item.quantity_ordered,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id)
      );

      if (updatePromises) {
        const results = await Promise.all(updatePromises);
        const errors = results.filter((r) => r.error);

        if (errors.length > 0) {
          console.error("Error updating items:", errors);
          return NextResponse.json({ error: "Failed to update all items" }, { status: 500 });
        }
      }
    }

    // Fetch updated receipt
    const { data: updatedReceipt } = await supabase
      .from("purchase_receipts")
      .select(
        `
        id,
        company_id,
        purchase_order_id,
        warehouse_id,
        receipt_code,
        receipt_date,
        status,
        supplier_invoice_number,
        supplier_invoice_date,
        notes,
        created_at,
        created_by,
        updated_at,
        updated_by,
        purchase_receipt_items(
          id,
          quantity_ordered,
          quantity_received
        )
      `
      )
      .eq("id", id)
      .single();

    return NextResponse.json({
      message: "All items marked as received",
      receipt: updatedReceipt,
    });
  } catch (error) {
    console.error("Error in receive-all:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
