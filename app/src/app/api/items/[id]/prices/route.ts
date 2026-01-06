import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";

type ItemPrice = {
  id: string;
  company_id: string;
  item_id: string;
  price_tier: string;
  price_tier_name: string;
  price: number;
  currency_code: string;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// GET /api/items/[id]/prices - List all prices for an item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;
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

    const { data: prices, error } = await supabase
      .from("item_prices")
      .select("*")
      .eq("item_id", itemId)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .order("price_tier", { ascending: true })
      .order("effective_from", { ascending: false });

    if (error) throw error;

    // Transform snake_case to camelCase
    const transformedPrices = (prices || []).map((price: any) => ({
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
    }));

    return NextResponse.json({
      data: transformedPrices,
      total: transformedPrices.length,
    });
  } catch (error) {
    console.error("Error fetching item prices:", error);
    return NextResponse.json(
      { error: "Failed to fetch item prices" },
      { status: 500 }
    );
  }
}

// POST /api/items/[id]/prices - Create a new price for an item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;
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

    const companyId = userData.company_id;

    // Verify item exists and belongs to company
    const { data: item, error: itemError } = await supabase
      .from("items")
      .select("id")
      .eq("id", itemId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const { data: price, error } = await supabase
      .from("item_prices")
      .insert({
        company_id: companyId,
        item_id: itemId,
        price_tier: body.priceTier,
        price_tier_name: body.priceTierName,
        price: body.price,
        currency_code: body.currencyCode || "PHP",
        effective_from: body.effectiveFrom,
        effective_to: body.effectiveTo || null,
        is_active: body.isActive ?? true,
        created_by: user.id,
        updated_by: user.id,
      })
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

    return NextResponse.json({ data: transformedPrice }, { status: 201 });
  } catch (error) {
    console.error("Error creating item price:", error);
    return NextResponse.json(
      { error: "Failed to create item price" },
      { status: 500 }
    );
  }
}
