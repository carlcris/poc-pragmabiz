/**
 * Single Item Variant API
 * Phase 3: UI/UX Integration
 *
 * Endpoints:
 * - PUT /api/items/[id]/variants/[variantId] - Update a variant
 * - DELETE /api/items/[id]/variants/[variantId] - Delete a variant
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { ItemVariant, UpdateItemVariantInput } from "@/types/item-variant";

type RouteContext = {
  params: Promise<{ id: string; variantId: string }>;
};

/**
 * PUT /api/items/[id]/variants/[variantId]
 * Update an existing variant
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Check permission first
    const unauthorized = await requirePermission(RESOURCES.ITEMS, 'edit');
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id: itemId, variantId } = await context.params;
    const body: UpdateItemVariantInput = await request.json();

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
    const { data: existingVariant, error: variantError } = await supabase
      .from("item_variants")
      .select("*")
      .eq("id", variantId)
      .eq("item_id", itemId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (variantError || !existingVariant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }

    // Prevent updating default variant code
    if (existingVariant.is_default && body.variantCode && body.variantCode !== existingVariant.variant_code) {
      return NextResponse.json(
        { error: "Cannot change code of default variant" },
        { status: 400 }
      );
    }

    // Check for duplicate variant code if changing
    if (body.variantCode && body.variantCode !== existingVariant.variant_code) {
      const { data: duplicate } = await supabase
        .from("item_variants")
        .select("id")
        .eq("company_id", companyId)
        .eq("item_id", itemId)
        .eq("variant_code", body.variantCode)
        .neq("id", variantId)
        .is("deleted_at", null)
        .single();

      if (duplicate) {
        return NextResponse.json(
          { error: "Variant code already exists for this item" },
          { status: 409 }
        );
      }
    }

    // Build update object (only include fields that are provided)
    const updateData: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (body.variantCode !== undefined) updateData.variant_code = body.variantCode;
    if (body.variantName !== undefined) updateData.variant_name = body.variantName;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.attributes !== undefined) updateData.attributes = body.attributes;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;

    // Update variant
    const { data: updatedVariant, error: updateError } = await supabase
      .from("item_variants")
      .update(updateData)
      .eq("id", variantId)
      .select()
      .single();

    if (updateError) {

      return NextResponse.json(
        { error: "Failed to update variant" },
        { status: 500 }
      );
    }

    // Transform to camelCase
    const transformedVariant: ItemVariant = {
      id: updatedVariant.id,
      companyId: updatedVariant.company_id,
      itemId: updatedVariant.item_id,
      variantCode: updatedVariant.variant_code,
      variantName: updatedVariant.variant_name,
      description: updatedVariant.description,
      attributes: updatedVariant.attributes || {},
      isActive: updatedVariant.is_active,
      isDefault: updatedVariant.is_default,
      createdAt: updatedVariant.created_at,
      createdBy: updatedVariant.created_by,
      updatedAt: updatedVariant.updated_at,
      updatedBy: updatedVariant.updated_by,
      deletedAt: updatedVariant.deleted_at,
      version: updatedVariant.version,
    };

    return NextResponse.json({ data: transformedVariant });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/items/[id]/variants/[variantId]
 * Soft delete a variant (sets deleted_at)
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Check permission first
    const unauthorized = await requirePermission(RESOURCES.ITEMS, 'delete');
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id: itemId, variantId } = await context.params;

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
    const { data: existingVariant, error: variantError } = await supabase
      .from("item_variants")
      .select("is_default")
      .eq("id", variantId)
      .eq("item_id", itemId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (variantError || !existingVariant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }

    // Prevent deleting default variant
    if (existingVariant.is_default) {
      return NextResponse.json(
        { error: "Cannot delete default variant" },
        { status: 400 }
      );
    }

    // Check if variant has active transactions
    // TODO: Add check for stock_transaction_items, purchase_order_items, etc.
    // For now, we'll allow deletion

    // Soft delete the variant
    const { error: deleteError } = await supabase
      .from("item_variants")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", variantId);

    if (deleteError) {

      return NextResponse.json(
        { error: "Failed to delete variant" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Variant deleted successfully" });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
