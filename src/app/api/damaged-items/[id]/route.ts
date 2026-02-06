import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// PUT /api/damaged-items/[id] - Update damaged item
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

    // Verify damaged item exists and belongs to company
    const { data: existingItem, error: fetchError } = await supabase
      .from("damaged_items")
      .select("id, grn:grns!inner(id, company_id)")
      .eq("id", id)
      .eq("grn.company_id", userData.company_id)
      .single();

    if (fetchError || !existingItem) {
      return NextResponse.json({ error: "Damaged item not found" }, { status: 404 });
    }

    // Update damaged item
    const updateData: any = {};
    if (body.actionTaken !== undefined) updateData.action_taken = body.actionTaken;
    if (body.status !== undefined) updateData.status = body.status;

    const { data: damagedItem, error: updateError } = await supabase
      .from("damaged_items")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        *,
        item:items(id, item_code, item_name),
        reported_by_user:users!damaged_items_reported_by_fkey(id, email, first_name, last_name)
      `
      )
      .single();

    if (updateError) {
      console.error("Error updating damaged item:", updateError);
      return NextResponse.json(
        { error: "Failed to update damaged item" },
        { status: 500 }
      );
    }

    // Format response
    const formatted = {
      id: damagedItem.id,
      grnId: damagedItem.grn_id,
      itemId: damagedItem.item_id,
      item: damagedItem.item
        ? {
            id: damagedItem.item.id,
            code: damagedItem.item.item_code,
            name: damagedItem.item.item_name,
          }
        : null,
      qty: parseFloat(damagedItem.qty),
      damageType: damagedItem.damage_type,
      description: damagedItem.description,
      reportedBy: damagedItem.reported_by,
      reportedByUser: damagedItem.reported_by_user
        ? {
            id: damagedItem.reported_by_user.id,
            email: damagedItem.reported_by_user.email,
            firstName: damagedItem.reported_by_user.first_name,
            lastName: damagedItem.reported_by_user.last_name,
          }
        : null,
      reportedDate: damagedItem.reported_date,
      actionTaken: damagedItem.action_taken,
      status: damagedItem.status,
      createdAt: damagedItem.created_at,
      updatedAt: damagedItem.updated_at,
    };

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/damaged-items/[id] - Delete damaged item
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

    // Verify damaged item exists and belongs to company
    const { data: existingItem, error: fetchError } = await supabase
      .from("damaged_items")
      .select("id, grn:grns!inner(id, company_id)")
      .eq("id", id)
      .eq("grn.company_id", userData.company_id)
      .single();

    if (fetchError || !existingItem) {
      return NextResponse.json({ error: "Damaged item not found" }, { status: 404 });
    }

    // Delete damaged item
    const { error: deleteError } = await supabase.from("damaged_items").delete().eq("id", id);

    if (deleteError) {
      console.error("Error deleting damaged item:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete damaged item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ id, message: "Damaged item deleted successfully" });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
