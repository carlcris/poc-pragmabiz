import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// GET /api/grns/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.GOODS_RECEIPT_NOTES, "view");
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

    // Fetch GRN with all related data
    const { data: grn, error } = await supabase
      .from("grns")
      .select(
        `
        *,
        load_list:load_lists(
          id, ll_number, supplier_ll_number, supplier_id,
          supplier:suppliers(id, supplier_name, supplier_code)
        ),
        warehouse:warehouses(id, warehouse_name, warehouse_code),
        business_unit:business_units(id, name, code),
        created_by_user:users!grns_created_by_fkey(id, email, first_name, last_name),
        received_by_user:users!grns_received_by_fkey(id, email, first_name, last_name),
        checked_by_user:users!grns_checked_by_fkey(id, email, first_name, last_name),
        items:grn_items(
          id, item_id, load_list_qty, received_qty, damaged_qty, num_boxes, barcodes_printed, notes,
          item:items(id, item_code, item_name)
        )
      `
      )
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (error) {
      console.error("Error fetching GRN:", error);
      return NextResponse.json({ error: "GRN not found" }, { status: 404 });
    }

    // Format response
    const formattedGRN = {
      id: grn.id,
      batch: grn.batch,
      grnNumber: grn.grn_number,
      loadListId: grn.load_list_id,
      loadList: grn.load_list
        ? {
            id: grn.load_list.id,
            llNumber: grn.load_list.ll_number,
            supplierLlNumber: grn.load_list.supplier_ll_number,
            supplierId: grn.load_list.supplier_id,
            supplier: grn.load_list.supplier
              ? {
                  id: grn.load_list.supplier.id,
                  name: grn.load_list.supplier.supplier_name,
                  code: grn.load_list.supplier.supplier_code,
                }
              : null,
          }
        : null,
      companyId: grn.company_id,
      businessUnitId: grn.business_unit_id,
      businessUnit: grn.business_unit
        ? {
            id: grn.business_unit.id,
            name: grn.business_unit.name,
            code: grn.business_unit.code,
          }
        : null,
      warehouseId: grn.warehouse_id,
      warehouse: grn.warehouse
        ? {
            id: grn.warehouse.id,
            name: grn.warehouse.warehouse_name,
            code: grn.warehouse.warehouse_code,
          }
        : null,
      containerNumber: grn.container_number,
      sealNumber: grn.seal_number,
      batchNumber: grn.batch_number,
      receivingDate: grn.receiving_date,
      deliveryDate: grn.delivery_date,
      status: grn.status,
      notes: grn.notes,
      items: grn.items?.map((item: any) => ({
        id: item.id,
        grnId: grn.id,
        itemId: item.item_id,
        item: item.item
          ? {
              id: item.item.id,
              code: item.item.item_code,
              name: item.item.item_name,
            }
          : null,
        loadListQty: parseFloat(item.load_list_qty),
        receivedQty: parseFloat(item.received_qty),
        damagedQty: parseFloat(item.damaged_qty),
        numBoxes: item.num_boxes,
        barcodesPrinted: item.barcodes_printed,
        notes: item.notes,
      })),
      receivedBy: grn.received_by,
      receivedByUser: grn.received_by_user
        ? {
            id: grn.received_by_user.id,
            email: grn.received_by_user.email,
            firstName: grn.received_by_user.first_name,
            lastName: grn.received_by_user.last_name,
          }
        : null,
      checkedBy: grn.checked_by,
      checkedByUser: grn.checked_by_user
        ? {
            id: grn.checked_by_user.id,
            email: grn.checked_by_user.email,
            firstName: grn.checked_by_user.first_name,
            lastName: grn.checked_by_user.last_name,
          }
        : null,
      createdBy: grn.created_by,
      createdByUser: grn.created_by_user
        ? {
            id: grn.created_by_user.id,
            email: grn.created_by_user.email,
            firstName: grn.created_by_user.first_name,
            lastName: grn.created_by_user.last_name,
          }
        : null,
      createdAt: grn.created_at,
      updatedAt: grn.updated_at,
      updatedBy: grn.updated_by,
    };

    return NextResponse.json(formattedGRN);
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/grns/[id] - Update GRN (receiving quantities)
export async function PUT(
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

    // Check if GRN exists and is editable
    const { data: existingGRN, error: fetchError } = await supabase
      .from("grns")
      .select("id, status, load_list_id")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingGRN) {
      return NextResponse.json({ error: "GRN not found" }, { status: 404 });
    }

    // Only allow editing draft and receiving status
    if (!["draft", "receiving"].includes(existingGRN.status)) {
      return NextResponse.json(
        { error: "Only draft or receiving GRNs can be edited" },
        { status: 400 }
      );
    }

    // Update GRN header
    const { error: updateError } = await supabase
      .from("grns")
      .update({
        receiving_date: body.receivingDate,
        notes: body.notes,
        status: "receiving", // Auto-change to receiving when items are being entered
        received_by: user.id,
        updated_by: user.id,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating GRN:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update GRN" },
        { status: 500 }
      );
    }

    // Update GRN items if provided
    if (body.items && body.items.length > 0) {
      for (const item of body.items) {
        const { error: itemError } = await supabase
          .from("grn_items")
          .update({
            received_qty: item.receivedQty,
            damaged_qty: item.damagedQty,
            num_boxes: item.numBoxes,
            notes: item.notes,
          })
          .eq("id", item.id);

        if (itemError) {
          console.error("Error updating GRN item:", itemError);
          return NextResponse.json({ error: "Failed to update GRN items" }, { status: 500 });
        }
      }
    }

    if (existingGRN.load_list_id) {
      const { data: loadList } = await supabase
        .from("load_lists")
        .select("id, status, ll_number, created_by")
        .eq("id", existingGRN.load_list_id)
        .eq("company_id", userData.company_id)
        .is("deleted_at", null)
        .single();

      if (
        loadList &&
        loadList.status !== "receiving" &&
        loadList.status !== "received" &&
        loadList.status !== "cancelled"
      ) {
        const { error: updateLoadListError } = await supabase
          .from("load_lists")
          .update({
            status: "receiving",
            updated_by: user.id,
          })
          .eq("id", loadList.id);

        if (updateLoadListError) {
          console.error("Error updating load list status:", updateLoadListError);
        } else if (loadList.created_by) {
          const { error: notificationError } = await supabase.from("notifications").insert({
            company_id: userData.company_id,
            user_id: loadList.created_by,
            title: "Shipments receiving started",
            message: `Load list ${loadList.ll_number} is now receiving.`,
            type: "load_list_status",
            metadata: {
              load_list_id: loadList.id,
              ll_number: loadList.ll_number,
              status: "receiving",
            },
          });

          if (notificationError) {
            console.error("Error creating load list notification:", notificationError);
          }
        }
      }
    }

    return NextResponse.json({ id, message: "GRN updated successfully" });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/grns/[id] - Soft delete GRN
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.GOODS_RECEIPT_NOTES, "delete");
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

    // Check if GRN exists and is deletable
    const { data: existingGRN, error: fetchError } = await supabase
      .from("grns")
      .select("id, status, grn_number")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingGRN) {
      return NextResponse.json({ error: "GRN not found" }, { status: 404 });
    }

    // Only allow deleting draft GRNs
    if (existingGRN.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft GRNs can be deleted" },
        { status: 400 }
      );
    }

    // Soft delete GRN
    const { error: deleteError } = await supabase
      .from("grns")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting GRN:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete GRN" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id,
      grnNumber: existingGRN.grn_number,
      message: "GRN deleted successfully",
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
