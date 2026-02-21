import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";

// GET /api/load-lists/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.LOAD_LISTS, "view");
    if (unauthorized) return unauthorized;
    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId } = context;

    // Fetch load list with related data
    const { data: ll, error } = await supabase
      .from("load_lists")
      .select(
        `
        id,
        ll_number,
        supplier_ll_number,
        company_id,
        business_unit_id,
        supplier_id,
        warehouse_id,
        container_number,
        seal_number,
        batch_number,
        estimated_arrival_date,
        actual_arrival_date,
        load_date,
        status,
        created_by,
        received_by,
        approved_by,
        received_date,
        approved_date,
        notes,
        created_at,
        updated_at,
        updated_by,
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
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (error) {
      console.error("Error fetching load list:", error);
      return NextResponse.json({ error: "Load list not found" }, { status: 404 });
    }

    // Format response
    const businessUnit = Array.isArray(ll.business_unit)
      ? ll.business_unit[0]
      : ll.business_unit ?? null;
    const supplier = Array.isArray(ll.supplier) ? ll.supplier[0] : ll.supplier ?? null;
    const warehouse = Array.isArray(ll.warehouse) ? ll.warehouse[0] : ll.warehouse ?? null;
    const createdByUser = Array.isArray(ll.created_by_user)
      ? ll.created_by_user[0]
      : ll.created_by_user ?? null;
    const receivedByUser = Array.isArray(ll.received_by_user)
      ? ll.received_by_user[0]
      : ll.received_by_user ?? null;
    const approvedByUser = Array.isArray(ll.approved_by_user)
      ? ll.approved_by_user[0]
      : ll.approved_by_user ?? null;
    const formattedLL = {
      id: ll.id,
      llNumber: ll.ll_number,
      supplierLlNumber: ll.supplier_ll_number,
      companyId: ll.company_id,
      businessUnitId: ll.business_unit_id,
      businessUnit: businessUnit
        ? {
            id: businessUnit.id,
            name: businessUnit.name,
            code: businessUnit.code,
          }
        : null,
      supplierId: ll.supplier_id,
      supplier: supplier
        ? {
            id: supplier.id,
            name: supplier.supplier_name,
            code: supplier.supplier_code,
            contactPerson: supplier.contact_person,
            email: supplier.email,
            phone: supplier.phone,
          }
        : null,
      warehouseId: ll.warehouse_id,
      warehouse: warehouse
        ? {
            id: warehouse.id,
            name: warehouse.warehouse_name,
            code: warehouse.warehouse_code,
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
      createdByUser: createdByUser
        ? {
            id: createdByUser.id,
            email: createdByUser.email,
            firstName: createdByUser.first_name,
            lastName: createdByUser.last_name,
          }
        : null,
      receivedBy: ll.received_by,
      receivedByUser: receivedByUser
        ? {
            id: receivedByUser.id,
            email: receivedByUser.email,
            firstName: receivedByUser.first_name,
            lastName: receivedByUser.last_name,
          }
        : null,
      approvedBy: ll.approved_by,
      approvedByUser: approvedByUser
        ? {
            id: approvedByUser.id,
            email: approvedByUser.email,
            firstName: approvedByUser.first_name,
            lastName: approvedByUser.last_name,
          }
        : null,
      receivedDate: ll.received_date,
      approvedDate: ll.approved_date,
      notes: ll.notes,
      items: ll.items?.map((item: Record<string, unknown>) => {
        const itemDetails = Array.isArray(item.item)
          ? (item.item[0] as Record<string, unknown> | undefined)
          : (item.item as Record<string, unknown> | null);
        return {
          id: item.id,
          itemId: item.item_id as string,
          item: itemDetails
            ? {
                id: itemDetails.id as string,
                code: itemDetails.item_code as string,
                name: itemDetails.item_name as string,
              }
            : null,
          loadListQty: parseFloat(String(item.load_list_qty)),
          receivedQty: parseFloat(String(item.received_qty)),
          damagedQty: parseFloat(String(item.damaged_qty)),
          shortageQty: parseFloat(String(item.shortage_qty)),
          unitPrice: parseFloat(String(item.unit_price)),
          totalPrice: parseFloat(String(item.total_price)),
          notes: item.notes as string | null,
        };
      }),
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
    const unauthorized = await requirePermission(RESOURCES.LOAD_LISTS, "edit");
    if (unauthorized) return unauthorized;
    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId } = context;
    const body = await request.json();

    // Check if load list exists
    const { data: existingLL, error: fetchError } = await supabase
      .from("load_lists")
      .select("id, status")
      .eq("id", id)
      .eq("company_id", companyId)
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
        updated_by: userId,
      })
      .eq("id", id)
      .select("id, ll_number, status")
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
    const unauthorized = await requirePermission(RESOURCES.LOAD_LISTS, "delete");
    if (unauthorized) return unauthorized;
    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId } = context;

    // Check if load list exists
    const { data: existingLL, error: fetchError } = await supabase
      .from("load_lists")
      .select("id, status")
      .eq("id", id)
      .eq("company_id", companyId)
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
        updated_by: userId,
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
