import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";

// PUT /api/items/[id]/prices/[priceId] - Update a price
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; priceId: string }> }
) {
  try {
    const { id: itemId, priceId } = await params;
    const body = await request.json();
    const { supabase } = await createServerClientWithBU();

    // Get user info
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

    // Verify item exists and belongs to company
    const { data: item, error: itemError } = await supabase
      .from("items")
      .select("id")
      .eq("id", itemId)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const { data: price, error } = await supabase
      .from("item_prices")
      .update({
        price_tier: body.priceTier,
        price_tier_name: body.priceTierName,
        price: body.price,
        currency_code: body.currencyCode || "PHP",
        effective_from: body.effectiveFrom,
        effective_to: body.effectiveTo || null,
        is_active: body.isActive ?? true,
        updated_by: user.id,
      })
      .eq("id", priceId)
      .eq("item_id", itemId)
      .eq("company_id", userData.company_id)
      .select()
      .single();

    if (error) throw error;

    // Transform snake_case to camelCase
    const transformedPrice = {
      id: price.id,
      itemId: price.item_id,
      priceTier: price.price_tier,
      priceTierName: price.price_tier_name,
      price: parseFloat(price.price),
      currencyCode: price.currency_code,
      effectiveFrom: price.effective_from,
      effectiveTo: price.effective_to,
      isActive: price.is_active,
      createdAt: price.created_at,
      updatedAt: price.updated_at,
    };

    return NextResponse.json({ data: transformedPrice });
  } catch (error) {
    console.error("Error updating item price:", error);
    return NextResponse.json({ error: "Failed to update item price" }, { status: 500 });
  }
}

// DELETE /api/items/[id]/prices/[priceId] - Delete a price
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; priceId: string }> }
) {
  try {
    const { id: itemId, priceId } = await params;
    const { supabase } = await createServerClientWithBU();

    // Get user info
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

    // Verify item exists and belongs to company
    const { data: item, error: itemError } = await supabase
      .from("items")
      .select("id")
      .eq("id", itemId)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("item_prices")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", priceId)
      .eq("item_id", itemId)
      .eq("company_id", userData.company_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting item price:", error);
    return NextResponse.json({ error: "Failed to delete item price" }, { status: 500 });
  }
}
