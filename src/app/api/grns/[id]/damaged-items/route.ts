import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { Tables } from "@/types/supabase";

type DamagedItemRow = Tables<"damaged_items">;
type ItemRow = Tables<"items">;
type UserRow = Tables<"users">;

type DamagedItemQueryRow = DamagedItemRow & {
  item?: Pick<ItemRow, "id" | "item_code" | "item_name"> | null;
  reported_by_user?: Pick<UserRow, "id" | "email" | "first_name" | "last_name"> | null;
};

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
        id,
        grn_id,
        item_id,
        qty,
        damage_type,
        description,
        reported_by,
        reported_date,
        action_taken,
        status,
        created_at,
        updated_at,
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
    const formattedItems = damagedItems?.map((item: Record<string, unknown>) => ({
      id: item.id,
      grnId: item.grn_id as string,
      itemId: item.item_id as string,
      item: item.item
        ? {
            id: (item.item as Record<string, unknown>).id as string,
            code: (item.item as Record<string, unknown>).item_code as string,
            name: (item.item as Record<string, unknown>).item_name as string,
          }
        : null,
      qty: parseFloat(String(item.qty)),
      damageType: item.damage_type as string,
      description: item.description as string | null,
      reportedBy: item.reported_by as string | null,
      reportedByUser: item.reported_by_user
        ? {
            id: (item.reported_by_user as Record<string, unknown>).id as string,
            email: (item.reported_by_user as Record<string, unknown>).email as string,
            firstName: (item.reported_by_user as Record<string, unknown>).first_name as string,
            lastName: (item.reported_by_user as Record<string, unknown>).last_name as string,
          }
        : null,
      reportedDate: item.reported_date as string,
      actionTaken: item.action_taken as string | null,
      status: item.status as string,
      createdAt: item.created_at as string,
      updatedAt: item.updated_at as string,
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
        id,
        grn_id,
        item_id,
        qty,
        damage_type,
        description,
        reported_by,
        reported_date,
        action_taken,
        status,
        created_at,
        updated_at,
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

    const createdItem = damagedItem as unknown as DamagedItemQueryRow;
    // Format response
    const item = createdItem.item ?? null;
    const reportedByUser = createdItem.reported_by_user ?? null;
    const formatted = {
      id: createdItem.id,
      grnId: createdItem.grn_id,
      itemId: createdItem.item_id,
      item: item
        ? {
          id: item.id,
          code: item.item_code,
          name: item.item_name,
        }
        : null,
      qty: Number(createdItem.qty),
      damageType: createdItem.damage_type,
      description: createdItem.description,
      reportedBy: createdItem.reported_by,
      reportedByUser: reportedByUser
        ? {
          id: reportedByUser.id,
          email: reportedByUser.email,
          firstName: reportedByUser.first_name,
          lastName: reportedByUser.last_name,
        }
        : null,
      reportedDate: createdItem.reported_date,
      actionTaken: createdItem.action_taken,
      status: createdItem.status,
      createdAt: createdItem.created_at,
      updatedAt: createdItem.updated_at,
    };

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
