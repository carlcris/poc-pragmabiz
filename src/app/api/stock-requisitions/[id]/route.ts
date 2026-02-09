import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// GET /api/stock-requisitions/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.STOCK_REQUISITIONS, "view");
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

    // Fetch stock requisition with related data
    const { data: sr, error } = await supabase
      .from("stock_requisitions")
      .select(
        `
        *,
        supplier:suppliers(id, supplier_name, supplier_code, contact_person, email, phone),
        business_unit:business_units(id, name, code),
        requested_by_user:users!stock_requisitions_requested_by_fkey(id, email, first_name, last_name),
        items:stock_requisition_items(
          id,
          sr_id,
          item_id,
          requested_qty,
          unit_price,
          total_price,
          fulfilled_qty,
          outstanding_qty,
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
      console.error("Error fetching stock requisition:", error);
      return NextResponse.json({ error: "Stock requisition not found" }, { status: 404 });
    }

    // Format response
    type StockRequisitionItemRow = {
      id: string;
      sr_id: string;
      item_id: string;
      item?: {
        id: string;
        item_code: string;
        item_name: string;
      } | null;
      requested_qty: number | string;
      unit_price: number | string;
      total_price: number | string;
      fulfilled_qty: number | string;
      outstanding_qty: number | string;
      notes: string | null;
    };

    const formattedSR = {
      id: sr.id,
      srNumber: sr.sr_number,
      companyId: sr.company_id,
      businessUnitId: sr.business_unit_id,
      businessUnit: sr.business_unit
        ? {
            id: sr.business_unit.id,
            name: sr.business_unit.name,
            code: sr.business_unit.code,
          }
        : null,
      supplierId: sr.supplier_id,
      supplier: sr.supplier
        ? {
            id: sr.supplier.id,
            name: sr.supplier.supplier_name,
            code: sr.supplier.supplier_code,
            contactPerson: sr.supplier.contact_person,
            email: sr.supplier.email,
            phone: sr.supplier.phone,
          }
        : null,
      requisitionDate: sr.requisition_date,
      requiredByDate: sr.required_by_date,
      requestedBy: sr.requested_by,
      requestedByUser: sr.requested_by_user
        ? {
            id: sr.requested_by_user.id,
            email: sr.requested_by_user.email,
            firstName: sr.requested_by_user.first_name,
            lastName: sr.requested_by_user.last_name,
          }
        : null,
      status: sr.status,
      notes: sr.notes,
      totalAmount: sr.total_amount ? parseFloat(sr.total_amount) : 0,
      items: (sr.items as StockRequisitionItemRow[] | null)?.map((item) => ({
        id: item.id,
        srId: item.sr_id,
        itemId: item.item_id,
        item: item.item
          ? {
              id: item.item.id,
              code: item.item.item_code,
              name: item.item.item_name,
            }
          : null,
        requestedQty: Number(item.requested_qty ?? 0),
        unitPrice: Number(item.unit_price ?? 0),
        totalPrice: Number(item.total_price ?? 0),
        fulfilledQty: Number(item.fulfilled_qty ?? 0),
        outstandingQty: Number(item.outstanding_qty ?? 0),
        notes: item.notes,
      })),
      createdAt: sr.created_at,
      createdBy: sr.created_by,
      updatedAt: sr.updated_at,
      updatedBy: sr.updated_by,
    };

    return NextResponse.json(formattedSR);
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/stock-requisitions/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.STOCK_REQUISITIONS, "edit");
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

    // Check if stock requisition exists and is in draft status
    const { data: existingSR, error: fetchError } = await supabase
      .from("stock_requisitions")
      .select("id, status")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingSR) {
      return NextResponse.json({ error: "Stock requisition not found" }, { status: 404 });
    }

    // Only allow editing draft requisitions
    if (existingSR.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft requisitions can be edited" },
        { status: 400 }
      );
    }

    // Calculate total amount
    const totalAmount = body.items?.reduce(
      (sum: number, item: { requestedQty: number; unitPrice: number }) =>
        sum + item.requestedQty * item.unitPrice,
      0
    ) || 0;

    // Update stock requisition
    const { data: sr, error: updateError } = await supabase
      .from("stock_requisitions")
      .update({
        supplier_id: body.supplierId,
        requisition_date: body.requisitionDate,
        required_by_date: body.requiredByDate || null,
        notes: body.notes,
        total_amount: totalAmount,
        updated_by: user.id,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating stock requisition:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update stock requisition" },
        { status: 500 }
      );
    }

    // Update line items if provided
    if (body.items && body.items.length > 0) {
      // Delete existing items
      await supabase.from("stock_requisition_items").delete().eq("sr_id", id);

      // Insert new items
      const itemsToInsert = body.items.map(
        (item: { itemId: string; requestedQty: number; unitPrice: number; notes?: string }) => ({
          sr_id: id,
          item_id: item.itemId,
          requested_qty: item.requestedQty,
          unit_price: item.unitPrice,
          fulfilled_qty: 0,
          notes: item.notes,
        })
      );

      const { error: itemsError } = await supabase
        .from("stock_requisition_items")
        .insert(itemsToInsert);

      if (itemsError) {
        console.error("Error updating stock requisition items:", itemsError);
        return NextResponse.json(
          { error: "Failed to update stock requisition items" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      id: sr.id,
      srNumber: sr.sr_number,
      status: sr.status,
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/stock-requisitions/[id] (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.STOCK_REQUISITIONS, "delete");
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

    // Check if stock requisition exists
    const { data: existingSR, error: fetchError } = await supabase
      .from("stock_requisitions")
      .select("id, status")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingSR) {
      return NextResponse.json({ error: "Stock requisition not found" }, { status: 404 });
    }

    // Only allow deleting draft requisitions
    if (existingSR.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft requisitions can be deleted" },
        { status: 400 }
      );
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from("stock_requisitions")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting stock requisition:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete stock requisition" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Stock requisition deleted successfully" });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
