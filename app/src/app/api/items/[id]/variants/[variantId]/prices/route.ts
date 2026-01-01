/**
 * Item Prices API
 * Phase 3: UI/UX Integration
 *
 * Endpoints:
 * - GET /api/items/[id]/variants/[variantId]/prices - Get all prices for a variant
 * - POST /api/items/[id]/variants/[variantId]/prices - Create new price
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { ItemPrice, CreateItemPriceInput } from "@/types/item-variant";

type RouteContext = {
  params: Promise<{ id: string; variantId: string }>;
};

/**
 * GET /api/items/[id]/variants/[variantId]/prices
 * Get all prices for a specific variant
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Check permission first
    const unauthorized = await requirePermission(RESOURCES.ITEMS, 'view');
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { variantId } = await context.params;

    // Get current user and company
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData, error: companyError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (companyError || !userData?.company_id) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const companyId = userData.company_id;

    // Verify variant exists and belongs to company
    const { data: variant, error: variantError } = await supabase
      .from("item_variants")
      .select("id, company_id")
      .eq("id", variantId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (variantError || !variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }

    // Get all prices for the variant
    const { data: prices, error: pricesError } = await supabase
      .from("item_prices")
      .select("*")
      .eq("variant_id", variantId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("price_tier", { ascending: true })
      .order("effective_from", { ascending: false });

    if (pricesError) {

      return NextResponse.json(
        { error: "Failed to fetch prices" },
        { status: 500 }
      );
    }

    // Transform to camelCase
    const transformedPrices: ItemPrice[] = (prices || []).map((p) => ({
      id: p.id,
      companyId: p.company_id,
      variantId: p.variant_id,
      priceTier: p.price_tier,
      priceTierName: p.price_tier_name,
      price: p.price,
      currencyCode: p.currency_code,
      effectiveFrom: p.effective_from,
      effectiveTo: p.effective_to,
      isActive: p.is_active,
      createdAt: p.created_at,
      createdBy: p.created_by,
      updatedAt: p.updated_at,
      updatedBy: p.updated_by,
      deletedAt: p.deleted_at,
      version: p.version,
    }));

    return NextResponse.json({
      data: transformedPrices,
      total: transformedPrices.length,
    });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/items/[id]/variants/[variantId]/prices
 * Create new price for a variant
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Check permission first
    const unauthorized = await requirePermission(RESOURCES.ITEMS, 'create');
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { variantId } = await context.params;
    const body: CreateItemPriceInput = await request.json();

    // Get current user and company
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData, error: companyError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (companyError || !userData?.company_id) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const companyId = userData.company_id;

    // Verify variant exists and belongs to company
    const { data: variant, error: variantError } = await supabase
      .from("item_variants")
      .select("id")
      .eq("id", variantId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (variantError || !variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }

    // Validate required fields
    if (!body.priceTier || !body.priceTierName || body.price === undefined) {
      return NextResponse.json(
        { error: "priceTier, priceTierName, and price are required" },
        { status: 400 }
      );
    }

    if (body.price < 0) {
      return NextResponse.json(
        { error: "Price cannot be negative" },
        { status: 400 }
      );
    }

    // Validate date range if both dates are provided
    if (body.effectiveTo && body.effectiveFrom) {
      const from = new Date(body.effectiveFrom);
      const to = new Date(body.effectiveTo);
      if (to < from) {
        return NextResponse.json(
          { error: "effective_to must be greater than or equal to effective_from" },
          { status: 400 }
        );
      }
    }

    // Check for duplicate (same tier and effective_from)
    const effectiveFrom = body.effectiveFrom || new Date().toISOString().split('T')[0];
    const { data: existingPrice } = await supabase
      .from("item_prices")
      .select("id")
      .eq("company_id", companyId)
      .eq("variant_id", variantId)
      .eq("price_tier", body.priceTier)
      .eq("effective_from", effectiveFrom)
      .is("deleted_at", null)
      .single();

    if (existingPrice) {
      return NextResponse.json(
        { error: "Price tier already exists for this variant and effective date" },
        { status: 409 }
      );
    }

    // Create new price
    const { data: newPrice, error: createError } = await supabase
      .from("item_prices")
      .insert({
        company_id: companyId,
        variant_id: variantId,
        price_tier: body.priceTier,
        price_tier_name: body.priceTierName,
        price: body.price,
        currency_code: body.currencyCode || 'PHP',
        effective_from: effectiveFrom,
        effective_to: body.effectiveTo || null,
        is_active: body.isActive !== undefined ? body.isActive : true,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (createError) {

      return NextResponse.json(
        { error: "Failed to create price" },
        { status: 500 }
      );
    }

    // Transform to camelCase
    const transformedPrice: ItemPrice = {
      id: newPrice.id,
      companyId: newPrice.company_id,
      variantId: newPrice.variant_id,
      priceTier: newPrice.price_tier,
      priceTierName: newPrice.price_tier_name,
      price: newPrice.price,
      currencyCode: newPrice.currency_code,
      effectiveFrom: newPrice.effective_from,
      effectiveTo: newPrice.effective_to,
      isActive: newPrice.is_active,
      createdAt: newPrice.created_at,
      createdBy: newPrice.created_by,
      updatedAt: newPrice.updated_at,
      updatedBy: newPrice.updated_by,
      deletedAt: newPrice.deleted_at,
      version: newPrice.version,
    };

    return NextResponse.json({ data: transformedPrice }, { status: 201 });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
