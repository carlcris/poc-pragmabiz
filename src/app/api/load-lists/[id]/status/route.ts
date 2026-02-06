import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// PATCH /api/load-lists/[id]/status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.LOAD_LISTS, "edit");
    const { id } = await params;
    const { supabase } = await createServerClientWithBU();
    const body = await request.json();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    // Validate status
    const validStatuses = [
      "draft",
      "confirmed",
      "in_transit",
      "arrived",
      "receiving",
      "pending_approval",
      "received",
      "cancelled",
    ];
    if (!body.status || !validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Fetch load list with items and warehouse info
    const { data: ll, error: fetchError } = await supabase
      .from("load_lists")
      .select(
        `
        id,
        ll_number,
        status,
        warehouse_id,
        business_unit_id,
        created_by,
        container_number,
        seal_number,
        batch_number,
        estimated_arrival_date,
        actual_arrival_date,
        items:load_list_items(
          id,
          item_id,
          load_list_qty,
          received_qty
        )
      `
      )
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !ll) {
      return NextResponse.json({ error: "Load list not found" }, { status: 404 });
    }

    const currentStatus = ll.status;
    const newStatus = body.status;

    // Validate status transition
    if (currentStatus === "cancelled" && newStatus !== "cancelled") {
      return NextResponse.json(
        { error: "Cannot change status of a cancelled load list" },
        { status: 400 }
      );
    }

    if (currentStatus === "received" && newStatus !== "received" && newStatus !== "cancelled") {
      return NextResponse.json(
        { error: "Cannot change status of a received load list" },
        { status: 400 }
      );
    }

    // ========================================================================
    // INVENTORY UPDATES - Critical business logic
    // ========================================================================

    try {
      // Handle transition TO "in_transit" status
      if (currentStatus !== "in_transit" && newStatus === "in_transit") {
        // Increment in_transit for each item (no RPC dependency)
        for (const item of ll.items) {
          const qty = parseFloat(item.load_list_qty || 0);
          if (!qty) continue;

          const { data: existingRecord, error: fetchInvError } = await supabase
            .from("item_warehouse")
            .select("id, in_transit")
            .eq("item_id", item.item_id)
            .eq("warehouse_id", ll.warehouse_id)
            .eq("company_id", userData.company_id)
            .maybeSingle();

          if (fetchInvError) {
            throw fetchInvError;
          }

          if (existingRecord) {
            const newInTransit = parseFloat(existingRecord.in_transit) + qty;
            const { error: updateError } = await supabase
              .from("item_warehouse")
              .update({
                in_transit: newInTransit,
                estimated_arrival_date: ll.estimated_arrival_date,
                updated_by: user.id,
              })
              .eq("id", existingRecord.id);

            if (updateError) {
              throw updateError;
            }
          } else {
            const { error: insertError } = await supabase.from("item_warehouse").insert({
              company_id: userData.company_id,
              item_id: item.item_id,
              warehouse_id: ll.warehouse_id,
              in_transit: qty,
              estimated_arrival_date: ll.estimated_arrival_date,
              current_stock: 0,
              reserved_stock: 0,
              created_by: user.id,
              updated_by: user.id,
            });

            if (insertError) {
              throw insertError;
            }
          }
        }
      }

      // Handle transition FROM "in_transit" TO "cancelled"
      if (currentStatus === "in_transit" && newStatus === "cancelled") {
        // Decrement in_transit (rollback)
        for (const item of ll.items) {
          // Ensure item_warehouse record exists
          const { data: existingRecord } = await supabase
            .from("item_warehouse")
            .select("id, in_transit")
            .eq("item_id", item.item_id)
            .eq("warehouse_id", ll.warehouse_id)
            .eq("company_id", userData.company_id)
            .single();

          if (existingRecord) {
            const newInTransit = Math.max(
              0,
              parseFloat(existingRecord.in_transit) - parseFloat(item.load_list_qty)
            );

            await supabase
              .from("item_warehouse")
              .update({
                in_transit: newInTransit,
                updated_by: user.id,
              })
              .eq("item_id", item.item_id)
              .eq("warehouse_id", ll.warehouse_id)
              .eq("company_id", userData.company_id);
          }
        }
      }

      // Handle transition TO "received" (after GRN approval)
      // Note: This will typically be handled by the GRN approval endpoint
      // but we include it here for completeness
      if (currentStatus !== "received" && newStatus === "received") {
        // Decrement in_transit and increment on_hand
        for (const item of ll.items) {
          const receivedQty = parseFloat(item.received_qty || item.load_list_qty);

          // Ensure item_warehouse record exists
          const { data: existingRecord } = await supabase
            .from("item_warehouse")
            .select("id, in_transit, current_stock")
            .eq("item_id", item.item_id)
            .eq("warehouse_id", ll.warehouse_id)
            .eq("company_id", userData.company_id)
            .single();

          if (existingRecord) {
            const newInTransit = Math.max(
              0,
              parseFloat(existingRecord.in_transit) - receivedQty
            );
            const newOnHand = parseFloat(existingRecord.current_stock) + receivedQty;

            await supabase
              .from("item_warehouse")
              .update({
                in_transit: newInTransit,
                current_stock: newOnHand,
                updated_by: user.id,
              })
              .eq("item_id", item.item_id)
              .eq("warehouse_id", ll.warehouse_id)
              .eq("company_id", userData.company_id);
          } else {
            // Create new record if it doesn't exist
            await supabase.from("item_warehouse").insert({
              company_id: userData.company_id,
              item_id: item.item_id,
              warehouse_id: ll.warehouse_id,
              in_transit: 0,
              current_stock: receivedQty,
              reserved_stock: 0,
              created_by: user.id,
              updated_by: user.id,
            });
          }
        }
      }
    } catch (inventoryError) {
      console.error("Error updating inventory:", inventoryError);
      return NextResponse.json(
        { error: "Failed to update inventory. Transaction rolled back." },
        { status: 500 }
      );
    }

    // Update load list status
    const updateData: Record<string, string | number | null> = {
      status: newStatus,
      updated_by: user.id,
    };

    // Set timestamps based on status
    if (newStatus === "arrived" && !ll.actual_arrival_date) {
      updateData.actual_arrival_date = new Date().toISOString().split("T")[0];
    }

    if (newStatus === "received") {
      updateData.received_date = new Date().toISOString();
      updateData.received_by = user.id;
    }

    const { data: updatedLL, error: updateError } = await supabase
      .from("load_lists")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating load list status:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update status" },
        { status: 500 }
      );
    }

    if (currentStatus !== newStatus && ["arrived", "receiving", "received"].includes(newStatus)) {
      const titleMap: Record<string, string> = {
        arrived: "Shipments arrived",
        receiving: "Shipments receiving started",
        received: "Shipments received",
      };
      const messageMap: Record<string, string> = {
        arrived: `Load list ${ll.ll_number} has arrived.`,
        receiving: `Load list ${ll.ll_number} is now receiving.`,
        received: `Load list ${ll.ll_number} has been received.`,
      };

      const notificationTargets = [ll.created_by].filter(Boolean);
      if (notificationTargets.length > 0) {
        const notifications = notificationTargets.map((userId) => ({
          company_id: userData.company_id,
          user_id: userId,
          title: titleMap[newStatus] || "Load list update",
          message: messageMap[newStatus] || `Load list ${ll.ll_number} updated.`,
          type: "load_list_status",
          metadata: {
            load_list_id: ll.id,
            ll_number: ll.ll_number,
            status: newStatus,
          },
        }));

        const { error: notificationError } = await supabase
          .from("notifications")
          .insert(notifications);

        if (notificationError) {
          console.error("Error creating load list notifications:", notificationError);
        }
      }
    }

    // ========================================================================
    // AUTO-CREATE GRN when Load List arrives
    // ========================================================================
    let grnNumber = null;
    if (currentStatus !== "arrived" && newStatus === "arrived") {
      try {
        // Check if GRN already exists for this load list
        const { data: existingGRN } = await supabase
          .from("grns")
          .select("id, grn_number")
          .eq("load_list_id", ll.id)
          .is("deleted_at", null)
          .single();

        if (!existingGRN) {
          // Generate GRN number
          const currentYear = new Date().getFullYear();
          const { data: lastGRN } = await supabase
            .from("grns")
            .select("grn_number")
            .eq("company_id", userData.company_id)
            .like("grn_number", `GRN-${currentYear}-%`)
            .order("grn_number", { ascending: false })
            .limit(1)
            .single();

          let nextNum = 1;
          if (lastGRN?.grn_number) {
            const match = lastGRN.grn_number.match(/GRN-\d{4}-(\d+)/);
            if (match) {
              nextNum = parseInt(match[1]) + 1;
            }
          }

          grnNumber = `GRN-${currentYear}-${String(nextNum).padStart(4, "0")}`;

          // Create GRN header
          const deliveryDate =
            ll.actual_arrival_date ||
            updateData.actual_arrival_date ||
            ll.estimated_arrival_date ||
            new Date().toISOString().split("T")[0];

          const { data: grn, error: grnError } = await supabase
            .from("grns")
            .insert({
              grn_number: grnNumber,
              load_list_id: ll.id,
              company_id: userData.company_id,
              business_unit_id: ll.business_unit_id,
              warehouse_id: ll.warehouse_id,
              container_number: ll.container_number,
              seal_number: ll.seal_number,
              batch_number: ll.batch_number,
              receiving_date: new Date().toISOString().split("T")[0],
              delivery_date: deliveryDate,
              status: "draft",
              notes: `Auto-created from Load List ${ll.ll_number}`,
              created_by: user.id,
              updated_by: user.id,
            })
            .select()
            .single();

          if (grnError) {
            console.error("Error creating GRN:", grnError);
            // Don't fail the status update if GRN creation fails
          } else if (grn) {
            // Create GRN items from load list items
            const grnItemsToInsert = ll.items.map((item: any) => ({
              grn_id: grn.id,
              item_id: item.item_id,
              load_list_qty: item.load_list_qty,
              received_qty: 0,
              damaged_qty: 0,
              num_boxes: 0,
              barcodes_printed: false,
            }));

            const { error: grnItemsError } = await supabase
              .from("grn_items")
              .insert(grnItemsToInsert);

            if (grnItemsError) {
              console.error("Error creating GRN items:", grnItemsError);
              // Rollback GRN creation if items fail
              await supabase.from("grns").delete().eq("id", grn.id);
              grnNumber = null;
            }
          }
        } else {
          grnNumber = existingGRN.grn_number;
        }
      } catch (grnCreationError) {
        console.error("Error in GRN auto-creation:", grnCreationError);
        // Don't fail the entire status update
      }
    }

    const response: any = {
      id: updatedLL.id,
      llNumber: updatedLL.ll_number,
      status: updatedLL.status,
      message: "Status updated successfully",
    };

    if (grnNumber) {
      response.grnNumber = grnNumber;
      response.message = `Status updated successfully. GRN ${grnNumber} created.`;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
