/**
 * Item Variants API
 * Phase 3: UI/UX Integration
 *
 * Endpoints:
 * - GET /api/items/[id]/variants - Get all variants for an item
 * - POST /api/items/[id]/variants - Create a new variant
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import type { ItemVariant, CreateItemVariantInput } from "@/types/item-variant";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/items/[id]/variants
 * Get all variants for a specific item
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { supabase } = await createServerClientWithBU();
    const { id: itemId } = await context.params;

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

    // Get all variants for the item
    const { data: variants, error: variantsError } = await supabase
      .from("item_variants")
      .select("*")
      .eq("item_id", itemId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("is_default", { ascending: false })
      .order("variant_code", { ascending: true });

    if (variantsError) {
      console.error("Error fetching variants:", variantsError);
      return NextResponse.json(
        { error: "Failed to fetch variants" },
        { status: 500 }
      );
    }

    // Transform to camelCase
    const transformedVariants: ItemVariant[] = (variants || []).map((v) => ({
      id: v.id,
      companyId: v.company_id,
      itemId: v.item_id,
      variantCode: v.variant_code,
      variantName: v.variant_name,
      description: v.description,
      attributes: v.attributes || {},
      isActive: v.is_active,
      isDefault: v.is_default,
      createdAt: v.created_at,
      createdBy: v.created_by,
      updatedAt: v.updated_at,
      updatedBy: v.updated_by,
      deletedAt: v.deleted_at,
      version: v.version,
    }));

    return NextResponse.json({
      data: transformedVariants,
      total: transformedVariants.length,
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/items/[id]/variants:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/items/[id]/variants
 * Create a new variant for an item
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { supabase } = await createServerClientWithBU();
    const { id: itemId } = await context.params;
    const body: CreateItemVariantInput = await request.json();

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

    // Validate required fields
    if (!body.variantCode || !body.variantName) {
      return NextResponse.json(
        { error: "variantCode and variantName are required" },
        { status: 400 }
      );
    }

    // Check for duplicate variant code
    const { data: existingVariant } = await supabase
      .from("item_variants")
      .select("id")
      .eq("company_id", companyId)
      .eq("item_id", itemId)
      .eq("variant_code", body.variantCode)
      .is("deleted_at", null)
      .single();

    if (existingVariant) {
      return NextResponse.json(
        { error: "Variant code already exists for this item" },
        { status: 409 }
      );
    }

    // Create new variant
    const { data: newVariant, error: createError } = await supabase
      .from("item_variants")
      .insert({
        company_id: companyId,
        item_id: itemId,
        variant_code: body.variantCode,
        variant_name: body.variantName,
        description: body.description || null,
        attributes: body.attributes || {},
        is_active: body.isActive !== undefined ? body.isActive : true,
        is_default: false, // Only migration creates default variants
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating variant:", createError);
      return NextResponse.json(
        { error: "Failed to create variant" },
        { status: 500 }
      );
    }

    // Transform to camelCase
    const transformedVariant: ItemVariant = {
      id: newVariant.id,
      companyId: newVariant.company_id,
      itemId: newVariant.item_id,
      variantCode: newVariant.variant_code,
      variantName: newVariant.variant_name,
      description: newVariant.description,
      attributes: newVariant.attributes || {},
      isActive: newVariant.is_active,
      isDefault: newVariant.is_default,
      createdAt: newVariant.created_at,
      createdBy: newVariant.created_by,
      updatedAt: newVariant.updated_at,
      updatedBy: newVariant.updated_by,
      deletedAt: newVariant.deleted_at,
      version: newVariant.version,
    };

    return NextResponse.json({ data: transformedVariant }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/items/[id]/variants:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
