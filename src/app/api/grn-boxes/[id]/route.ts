import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// PUT /api/grn-boxes/[id] - Update box (mainly for location assignment)
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

    // Verify box exists and belongs to company
    const { data: existingBox, error: fetchError } = await supabase
      .from("grn_boxes")
      .select(
        `
        id,
        grn_item:grn_items!inner(
          id,
          grn:grns!inner(id, company_id)
        )
      `
      )
      .eq("id", id)
      .eq("grn_item.grn.company_id", userData.company_id)
      .single();

    if (fetchError || !existingBox) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    // Update box
    const updateData: Record<string, unknown> = {};
    if (body.warehouseLocationId !== undefined)
      updateData.warehouse_location_id = body.warehouseLocationId;

    const { error: updateError } = await supabase
      .from("grn_boxes")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error("Error updating box:", updateError);
      return NextResponse.json({ error: "Failed to update box" }, { status: 500 });
    }

    return NextResponse.json({ id, message: "Box updated successfully" });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/grn-boxes/[id] - Delete box
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

    // Verify box exists and belongs to company
    const { data: existingBox, error: fetchError } = await supabase
      .from("grn_boxes")
      .select(
        `
        id,
        grn_item:grn_items!inner(
          id,
          grn:grns!inner(id, company_id)
        )
      `
      )
      .eq("id", id)
      .eq("grn_item.grn.company_id", userData.company_id)
      .single();

    if (fetchError || !existingBox) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    // Delete box
    const { error: deleteError } = await supabase.from("grn_boxes").delete().eq("id", id);

    if (deleteError) {
      console.error("Error deleting box:", deleteError);
      return NextResponse.json({ error: "Failed to delete box" }, { status: 500 });
    }

    return NextResponse.json({ id, message: "Box deleted successfully" });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
