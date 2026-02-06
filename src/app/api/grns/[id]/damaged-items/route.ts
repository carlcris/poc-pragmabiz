import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// GET /api/grns/[id]/damaged-items - List damaged items for a GRN
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

    // Fetch damaged items for this GRN
    const { data: damagedItems, error } = await supabase
      .from("damaged_items")
      .select(
        `
        *,
        item:items(id, item_code, item_name),
        reported_by_user:users!damaged_items_reported_by_fkey(id, email, first_name, last_name),
        grn:grns!inner(id, company_id)
      `
      )
      .eq("grn_id", id)
      .eq("grn.company_id", userData.company_id);

    if (error) {
      console.error("Error fetching damaged items:", error);
      return NextResponse.json({ error: "Failed to fetch damaged items" }, { status: 500 });
    }

    // Format response
    const formattedItems = damagedItems?.map((item: any) => ({
      id: item.id,
      grnId: item.grn_id,
      itemId: item.item_id,
      item: item.item
        ? {
            id: item.item.id,
            code: item.item.item_code,
            name: item.item.item_name,
          }
        : null,
      qty: parseFloat(item.qty),
      damageType: item.damage_type,
      description: item.description,
      reportedBy: item.reported_by,
      reportedByUser: item.reported_by_user
        ? {
            id: item.reported_by_user.id,
            email: item.reported_by_user.email,
            firstName: item.reported_by_user.first_name,
            lastName: item.reported_by_user.last_name,
          }
        : null,
      reportedDate: item.reported_date,
      actionTaken: item.action_taken,
      status: item.status,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));

    return NextResponse.json({ data: formattedItems });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/grns/[id]/damaged-items - Create damaged item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.GOODS_RECEIPT_NOTES, "create");
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

    // Validate GRN exists and belongs to company
    const { data: grn, error: grnError } = await supabase
      .from("grns")
      .select("id, company_id")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (grnError || !grn) {
      return NextResponse.json({ error: "GRN not found" }, { status: 404 });
    }

    // Validate required fields
    if (!body.itemId || !body.qty || !body.damageType) {
      return NextResponse.json(
        { error: "Item ID, quantity, and damage type are required" },
        { status: 400 }
      );
    }

    // Create damaged item
    const { data: damagedItem, error: createError } = await supabase
      .from("damaged_items")
      .insert({
        grn_id: id,
        item_id: body.itemId,
        qty: body.qty,
        damage_type: body.damageType,
        description: body.description,
        reported_by: user.id,
        reported_date: new Date().toISOString().split("T")[0],
        status: "reported",
      })
      .select(
        `
        *,
        item:items(id, item_code, item_name),
        reported_by_user:users!damaged_items_reported_by_fkey(id, email, first_name, last_name)
      `
      )
      .single();

    if (createError) {
      console.error("Error creating damaged item:", createError);
      return NextResponse.json(
        { error: "Failed to create damaged item" },
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
