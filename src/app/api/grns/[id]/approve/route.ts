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
            package_id,
            base_package:item_packaging!package_id(id, uom_id, qty_per_pack)
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
    const items = grn.items as any[];
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "GRN has no items" }, { status: 400 });
    }

    // Generate stock transaction code with timestamp to avoid duplicates
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");
    const milliseconds = now.getTime().toString().slice(-4);
    const stockTxCode = `ST-${dateStr}${milliseconds}`;

    // Create stock transaction header
    const { data: stockTransaction, error: stockTxError } = await supabase
      .from("stock_transactions")
      .insert({
        company_id: grn.company_id,
        business_unit_id: grn.business_unit_id,
        transaction_code: stockTxCode,
        transaction_type: "in",
        transaction_date: now.toISOString().split("T")[0],
        warehouse_id: grn.warehouse_id,
        reference_type: "grn",
        reference_id: grn.id,
        status: "posted",
        notes: body.notes || `Auto-created from GRN ${grn.grn_number}`,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (stockTxError) {
      console.error("Error creating stock transaction:", stockTxError);
      return NextResponse.json(
        { error: "Failed to create stock transaction" },
        { status: 500 }
      );
    }

    // Process each GRN item
    for (const item of items) {
      // Create stock entry item
      // Update item_warehouse inventory levels
      // First, check if record exists
      const { data: existingInventory } = await supabase
        .from("item_warehouse")
        .select("id, in_transit, current_stock")
        .eq("item_id", item.item_id)
        .eq("warehouse_id", grn.warehouse_id)
        .eq("company_id", grn.company_id)
        .single();

      const currentBalance = existingInventory
        ? parseFloat(String(existingInventory.current_stock))
        : 0;
      const receivedQty = parseFloat(String(item.received_qty));
      const newBalance = currentBalance + receivedQty;

      const postingDate = now.toISOString().split("T")[0];
      const postingTime = now.toTimeString().split(" ")[0];
      const basePackage = item.item?.base_package;
      const basePackageId = item.item?.package_id || basePackage?.id || null;
      const uomId = basePackage?.uom_id || null;
      const conversionFactor = basePackage?.qty_per_pack || 1.0;

      if (!uomId || !basePackageId) {
        return NextResponse.json(
          { error: "Item base package not found for stock transaction" },
          { status: 400 }
        );
      }

      const { error: stockTxItemError } = await supabase
        .from("stock_transaction_items")
        .insert({
          company_id: grn.company_id,
          transaction_id: stockTransaction.id,
          item_id: item.item_id,
          input_qty: receivedQty,
          input_packaging_id: basePackageId,
          conversion_factor: conversionFactor,
          normalized_qty: receivedQty,
          base_package_id: basePackageId,
          quantity: receivedQty,
          uom_id: uomId,
          qty_before: currentBalance,
          qty_after: newBalance,
          posting_date: postingDate,
          posting_time: postingTime,
          notes: item.damaged_qty > 0 ? `Damaged: ${item.damaged_qty}` : null,
          created_by: user.id,
          updated_by: user.id,
        });

      if (stockTxItemError) {
        console.error("Error creating stock transaction item:", stockTxItemError);
        return NextResponse.json(
          { error: "Failed to create stock transaction items" },
          { status: 500 }
        );
      }

      if (existingInventory) {
        // Update existing record: decrement in_transit, increment current_stock
        const remainingInTransit = Math.max(
          0,
          parseFloat(String(existingInventory.in_transit)) - receivedQty
        );
        const { error: updateError } = await supabase
          .from("item_warehouse")
          .update({
            in_transit: remainingInTransit,
            estimated_arrival_date: remainingInTransit > 0 ? undefined : null,
            current_stock: newBalance,
            updated_by: user.id,
          })
          .eq("id", existingInventory.id);

        if (updateError) {
          console.error("Error updating item_warehouse:", updateError);
          return NextResponse.json(
            { error: "Failed to update inventory levels" },
            { status: 500 }
          );
        }
      } else {
        // Create new inventory record if it doesn't exist
        const { error: insertError } = await supabase.from("item_warehouse").insert({
          item_id: item.item_id,
          warehouse_id: grn.warehouse_id,
          company_id: grn.company_id,
          current_stock: item.received_qty,
          in_transit: 0,
          estimated_arrival_date: null,
          reserved_stock: 0,
          created_by: user.id,
          updated_by: user.id,
        });

        if (insertError) {
          console.error("Error creating item_warehouse:", insertError);
          return NextResponse.json(
            { error: "Failed to create inventory record" },
            { status: 500 }
          );
        }
      }
    }

    // Update GRN status to approved
    const { error: updateGRNError } = await supabase
      .from("grns")
      .update({
        status: "approved",
        checked_by: user.id,
        updated_by: user.id,
      })
      .eq("id", grn.id);

    if (updateGRNError) {
      console.error("Error updating GRN status:", updateGRNError);
      return NextResponse.json(
        { error: "Failed to approve GRN" },
        { status: 500 }
      );
    }

    // Update Load List status to received
    const { error: updateLLError } = await supabase
      .from("load_lists")
      .update({
        status: "received",
        updated_by: user.id,
      })
      .eq("id", grn.load_list_id);

    if (updateLLError) {
      console.error("Error updating load list status:", updateLLError);
      // Don't fail the entire operation if LL update fails
    } else if (grn.load_list_id) {
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
      stockTransactionCode: stockTransaction.transaction_code,
      status: "approved",
      message: "GRN approved and inventory updated successfully",
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
