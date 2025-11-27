/**
 * Item Price Detail API
 * Phase 3: UI/UX Integration
 *
 * Endpoints:
 * - PUT /api/items/[id]/variants/[variantId]/prices/[priceId] - Update price
 * - DELETE /api/items/[id]/variants/[variantId]/prices/[priceId] - Delete price
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ItemPrice, UpdateItemPriceInput } from "@/types/item-variant";

type RouteContext = {
  params: Promise<{ id: string; variantId: string; priceId: string }>;
};

/**
 * PUT /api/items/[id]/variants/[variantId]/prices/[priceId]
 * Update price
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient();
    const { variantId, priceId } = await context.params;
    const body: UpdateItemPriceInput = await request.json();

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

    // Verify price exists and belongs to company
    const { data: existingPrice, error: priceError } = await supabase
      .from("item_prices")
      .select("*")
      .eq("id", priceId)
      .eq("variant_id", variantId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (priceError || !existingPrice) {
      return NextResponse.json({ error: "Price not found" }, { status: 404 });
    }

    // Validate price if provided
    if (body.price !== undefined && body.price < 0) {
      return NextResponse.json(
        { error: "Price cannot be negative" },
        { status: 400 }
      );
    }

    // Validate date range if both dates are provided
    const effectiveFrom = body.effectiveFrom || existingPrice.effective_from;
    const effectiveTo = body.effectiveTo !== undefined ? body.effectiveTo : existingPrice.effective_to;

    if (effectiveTo && effectiveFrom) {
      const from = new Date(effectiveFrom);
      const to = new Date(effectiveTo);
      if (to < from) {
        return NextResponse.json(
          { error: "effective_to must be greater than or equal to effective_from" },
          { status: 400 }
        );
      }
    }

    // Check for duplicate if changing tier or effective_from
    const newPriceTier = body.priceTier || existingPrice.price_tier;
    const newEffectiveFrom = body.effectiveFrom || existingPrice.effective_from;

    if (newPriceTier !== existingPrice.price_tier || newEffectiveFrom !== existingPrice.effective_from) {
      const { data: duplicate } = await supabase
        .from("item_prices")
        .select("id")
        .eq("company_id", companyId)
        .eq("variant_id", variantId)
        .eq("price_tier", newPriceTier)
        .eq("effective_from", newEffectiveFrom)
        .neq("id", priceId)
        .is("deleted_at", null)
        .single();

      if (duplicate) {
        return NextResponse.json(
          { error: "Price tier already exists for this variant and effective date" },
          { status: 409 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (body.priceTier !== undefined) updateData.price_tier = body.priceTier;
    if (body.priceTierName !== undefined) updateData.price_tier_name = body.priceTierName;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.currencyCode !== undefined) updateData.currency_code = body.currencyCode;
    if (body.effectiveFrom !== undefined) updateData.effective_from = body.effectiveFrom;
    if (body.effectiveTo !== undefined) updateData.effective_to = body.effectiveTo || null;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;

    // Update price
    const { data: updatedPrice, error: updateError } = await supabase
      .from("item_prices")
      .update(updateData)
      .eq("id", priceId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating price:", updateError);
      return NextResponse.json(
        { error: "Failed to update price" },
        { status: 500 }
      );
    }

    // Transform to camelCase
    const transformedPrice: ItemPrice = {
      id: updatedPrice.id,
      companyId: updatedPrice.company_id,
      variantId: updatedPrice.variant_id,
      priceTier: updatedPrice.price_tier,
      priceTierName: updatedPrice.price_tier_name,
      price: updatedPrice.price,
      currencyCode: updatedPrice.currency_code,
      effectiveFrom: updatedPrice.effective_from,
      effectiveTo: updatedPrice.effective_to,
      isActive: updatedPrice.is_active,
      createdAt: updatedPrice.created_at,
      createdBy: updatedPrice.created_by,
      updatedAt: updatedPrice.updated_at,
      updatedBy: updatedPrice.updated_by,
      deletedAt: updatedPrice.deleted_at,
      version: updatedPrice.version,
    };

    return NextResponse.json({ data: transformedPrice });
  } catch (error) {
    console.error("Unexpected error in PUT /api/items/[id]/variants/[variantId]/prices/[priceId]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/items/[id]/variants/[variantId]/prices/[priceId]
 * Delete price (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient();
    const { variantId, priceId } = await context.params;

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

    // Verify price exists and belongs to company
    const { data: existingPrice, error: priceError } = await supabase
      .from("item_prices")
      .select("id")
      .eq("id", priceId)
      .eq("variant_id", variantId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (priceError || !existingPrice) {
      return NextResponse.json({ error: "Price not found" }, { status: 404 });
    }

    // Soft delete price
    const { error: deleteError } = await supabase
      .from("item_prices")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", priceId);

    if (deleteError) {
      console.error("Error deleting price:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete price" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Price deleted successfully" });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/items/[id]/variants/[variantId]/prices/[priceId]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
