import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

// PATCH /api/tablet/purchase-receipts/[id]/items/[itemId]
// Update received quantity for a single line item
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.PURCHASE_RECEIPTS, "edit");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id, itemId } = await context.params;
    const body = await request.json();
    const { quantityReceived, notes } = body;

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

    // Verify item exists and get quantity_ordered for validation
    const { data: item, error: itemError } = await supabase
      .from("purchase_receipt_items")
      .select("id, quantity_ordered, receipt_id")
      .eq("id", itemId)
      .eq("receipt_id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Validate quantity_received
    if (quantityReceived < 0) {
      return NextResponse.json({ error: "Received quantity cannot be negative" }, { status: 400 });
    }

    if (quantityReceived > Number(item.quantity_ordered)) {
      return NextResponse.json(
        { error: "Received quantity cannot exceed ordered quantity" },
        { status: 400 }
      );
    }

    // Update the item
    const updateData: {
      quantity_received: number;
      updated_by: string;
      updated_at: string;
      notes?: string;
    } = {
      quantity_received: quantityReceived,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from("purchase_receipt_items")
      .update(updateData)
      .eq("id", itemId)
      .select(
        `
        id,
        item_id,
        quantity_ordered,
        quantity_received,
        rate,
        notes,
        item:items(
          id,
          item_code,
          item_name
        ),
        uom:units_of_measure(
          id,
          code,
          name,
          symbol
        ),
        packaging:item_packaging(
          id,
          pack_name,
          qty_per_pack
        )
      `
      )
      .single();

    if (updateError) {
      console.error("Error updating item:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Format response
    const formattedItem = {
      id: updatedItem.id,
      itemId: updatedItem.item_id,
      item: updatedItem.item,
      quantityOrdered: Number(updatedItem.quantity_ordered),
      quantityReceived: Number(updatedItem.quantity_received),
      uom: updatedItem.uom,
      packaging: updatedItem.packaging,
      rate: Number(updatedItem.rate),
      lineTotal: Number(updatedItem.quantity_received) * Number(updatedItem.rate),
      notes: updatedItem.notes,
      isFullyReceived:
        Number(updatedItem.quantity_received) === Number(updatedItem.quantity_ordered),
      remainingQty: Number(updatedItem.quantity_ordered) - Number(updatedItem.quantity_received),
    };

    return NextResponse.json(formattedItem);
  } catch (error) {
    console.error("Error updating receipt item:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
