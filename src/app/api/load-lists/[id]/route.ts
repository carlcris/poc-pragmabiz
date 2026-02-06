import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// GET /api/load-lists/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.LOAD_LISTS, "view");
    const { id } = await params;
    const { supabase } = await createServerClientWithBU();

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

    // Fetch load list with related data
    const { data: ll, error } = await supabase
      .from("load_lists")
      .select(
        `
        *,
        supplier:suppliers(id, supplier_name, supplier_code, contact_person, email, phone),
        warehouse:warehouses(id, warehouse_name, warehouse_code),
        business_unit:business_units(id, name, code),
        created_by_user:users!load_lists_created_by_fkey(id, email, first_name, last_name),
        received_by_user:users!load_lists_received_by_fkey(id, email, first_name, last_name),
        approved_by_user:users!load_lists_approved_by_fkey(id, email, first_name, last_name),
        items:load_list_items(
          id,
          item_id,
          load_list_qty,
          received_qty,
          damaged_qty,
          shortage_qty,
          unit_price,
          total_price,
          notes,
          item:items(id, item_code, item_name)
        )
      `
      )
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (error) {
      console.error("Error fetching load list:", error);
      return NextResponse.json({ error: "Load list not found" }, { status: 404 });
    }

    // Format response
    const formattedLL = {
      id: ll.id,
      llNumber: ll.ll_number,
      supplierLlNumber: ll.supplier_ll_number,
      companyId: ll.company_id,
      businessUnitId: ll.business_unit_id,
      businessUnit: ll.business_unit
        ? {
            id: ll.business_unit.id,
            name: ll.business_unit.name,
            code: ll.business_unit.code,
          }
        : null,
      supplierId: ll.supplier_id,
      supplier: ll.supplier
        ? {
            id: ll.supplier.id,
            name: ll.supplier.supplier_name,
            code: ll.supplier.supplier_code,
            contactPerson: ll.supplier.contact_person,
            email: ll.supplier.email,
            phone: ll.supplier.phone,
          }
        : null,
      warehouseId: ll.warehouse_id,
      warehouse: ll.warehouse
        ? {
            id: ll.warehouse.id,
            name: ll.warehouse.warehouse_name,
            code: ll.warehouse.warehouse_code,
          }
        : null,
      containerNumber: ll.container_number,
      sealNumber: ll.seal_number,
      batchNumber: ll.batch_number,
      estimatedArrivalDate: ll.estimated_arrival_date,
      actualArrivalDate: ll.actual_arrival_date,
      loadDate: ll.load_date,
      status: ll.status,
      createdBy: ll.created_by,
      createdByUser: ll.created_by_user
        ? {
            id: ll.created_by_user.id,
            email: ll.created_by_user.email,
            firstName: ll.created_by_user.first_name,
            lastName: ll.created_by_user.last_name,
          }
        : null,
      receivedBy: ll.received_by,
      receivedByUser: ll.received_by_user
        ? {
            id: ll.received_by_user.id,
            email: ll.received_by_user.email,
            firstName: ll.received_by_user.first_name,
            lastName: ll.received_by_user.last_name,
          }
        : null,
      approvedBy: ll.approved_by,
      approvedByUser: ll.approved_by_user
        ? {
            id: ll.approved_by_user.id,
            email: ll.approved_by_user.email,
            firstName: ll.approved_by_user.first_name,
            lastName: ll.approved_by_user.last_name,
          }
        : null,
      receivedDate: ll.received_date,
      approvedDate: ll.approved_date,
      notes: ll.notes,
      items: ll.items?.map((item: any) => ({
        id: item.id,
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
        shortageQty: parseFloat(item.shortage_qty),
        unitPrice: parseFloat(item.unit_price),
        totalPrice: parseFloat(item.total_price),
        notes: item.notes,
      })),
      createdAt: ll.created_at,
      updatedAt: ll.updated_at,
      updatedBy: ll.updated_by,
    };

    return NextResponse.json(formattedLL);
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/load-lists/[id]
export async function PUT(
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

    // Check if load list exists
    const { data: existingLL, error: fetchError } = await supabase
      .from("load_lists")
      .select("id, status")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingLL) {
      return NextResponse.json({ error: "Load list not found" }, { status: 404 });
    }

    // Only allow editing draft and confirmed load lists
    if (!["draft", "confirmed"].includes(existingLL.status)) {
      return NextResponse.json(
        { error: "Only draft or confirmed load lists can be edited" },
        { status: 400 }
      );
    }

    // Update load list
    const { data: ll, error: updateError } = await supabase
      .from("load_lists")
      .update({
        supplier_ll_number: body.supplierLlNumber,
        supplier_id: body.supplierId,
        warehouse_id: body.warehouseId,
        container_number: body.containerNumber,
        seal_number: body.sealNumber,
        batch_number: body.batchNumber,
        estimated_arrival_date: body.estimatedArrivalDate,
        load_date: body.loadDate,
        notes: body.notes,
        updated_by: user.id,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating load list:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update load list" },
        { status: 500 }
      );
    }

    // Update line items if provided and status is draft
    if (body.items && body.items.length > 0 && existingLL.status === "draft") {
      // Delete existing items
      await supabase.from("load_list_items").delete().eq("load_list_id", id);

      // Insert new items
      const itemsToInsert = body.items.map(
        (item: { itemId: string; loadListQty: number; unitPrice: number; notes?: string }) => ({
          load_list_id: id,
          item_id: item.itemId,
          load_list_qty: item.loadListQty,
          unit_price: item.unitPrice,
          received_qty: 0,
          damaged_qty: 0,
          notes: item.notes,
        })
      );

      const { error: itemsError } = await supabase
        .from("load_list_items")
        .insert(itemsToInsert);

      if (itemsError) {
        console.error("Error updating load list items:", itemsError);
        return NextResponse.json(
          { error: "Failed to update load list items" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      id: ll.id,
      llNumber: ll.ll_number,
      status: ll.status,
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/load-lists/[id] (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.LOAD_LISTS, "delete");
    const { id } = await params;
    const { supabase } = await createServerClientWithBU();

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

    // Check if load list exists
    const { data: existingLL, error: fetchError } = await supabase
      .from("load_lists")
      .select("id, status")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingLL) {
      return NextResponse.json({ error: "Load list not found" }, { status: 404 });
    }

    // Only allow deleting draft and confirmed load lists
    if (!["draft", "confirmed"].includes(existingLL.status)) {
      return NextResponse.json(
        { error: "Only draft or confirmed load lists can be deleted" },
        { status: 400 }
      );
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from("load_lists")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting load list:", deleteError);
      return NextResponse.json({ error: "Failed to delete load list" }, { status: 500 });
    }

    return NextResponse.json({ message: "Load list deleted successfully" });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
