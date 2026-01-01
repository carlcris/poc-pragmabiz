/**
 * Item Packaging Detail API
 * Phase 3: UI/UX Integration
 *
 * Endpoints:
 * - PUT /api/items/[id]/variants/[variantId]/packaging/[packagingId] - Update packaging
 * - DELETE /api/items/[id]/variants/[variantId]/packaging/[packagingId] - Delete packaging
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { ItemPackaging, UpdateItemPackagingInput } from "@/types/item-variant";

type RouteContext = {
  params: Promise<{ id: string; variantId: string; packagingId: string }>;
};

/**
 * PUT /api/items/[id]/variants/[variantId]/packaging/[packagingId]
 * Update packaging
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
    const { variantId, packagingId } = await context.params;
    const body: UpdateItemPackagingInput = await request.json();

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

    // Verify packaging exists and belongs to company
    const { data: existingPackaging, error: packagingError } = await supabase
      .from("item_packaging")
      .select("*")
      .eq("id", packagingId)
      .eq("variant_id", variantId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (packagingError || !existingPackaging) {
      return NextResponse.json({ error: "Packaging not found" }, { status: 404 });
    }

    // Prevent editing default packaging type
    if (existingPackaging.is_default && body.packType && body.packType !== existingPackaging.pack_type) {
      return NextResponse.json(
        { error: "Cannot change pack type of default packaging" },
        { status: 400 }
      );
    }

    // Validate qtyPerPack if provided
    if (body.qtyPerPack !== undefined && body.qtyPerPack <= 0) {
      return NextResponse.json(
        { error: "qtyPerPack must be greater than 0" },
        { status: 400 }
      );
    }

    // Check for duplicate pack type if changing
    if (body.packType && body.packType !== existingPackaging.pack_type) {
      const { data: duplicate } = await supabase
        .from("item_packaging")
        .select("id")
        .eq("company_id", companyId)
        .eq("variant_id", variantId)
        .eq("pack_type", body.packType)
        .neq("id", packagingId)
        .is("deleted_at", null)
        .single();

      if (duplicate) {
        return NextResponse.json(
          { error: "Packaging type already exists for this variant" },
          { status: 409 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (body.packType !== undefined) updateData.pack_type = body.packType;
    if (body.packName !== undefined) updateData.pack_name = body.packName;
    if (body.qtyPerPack !== undefined) updateData.qty_per_pack = body.qtyPerPack;
    if (body.barcode !== undefined) updateData.barcode = body.barcode || null;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;

    // Update packaging
    const { data: updatedPackaging, error: updateError } = await supabase
      .from("item_packaging")
      .update(updateData)
      .eq("id", packagingId)
      .select()
      .single();

    if (updateError) {

      return NextResponse.json(
        { error: "Failed to update packaging" },
        { status: 500 }
      );
    }

    // Transform to camelCase
    const transformedPackaging: ItemPackaging = {
      id: updatedPackaging.id,
      companyId: updatedPackaging.company_id,
      variantId: updatedPackaging.variant_id,
      packType: updatedPackaging.pack_type,
      packName: updatedPackaging.pack_name,
      qtyPerPack: updatedPackaging.qty_per_pack,
      barcode: updatedPackaging.barcode,
      isDefault: updatedPackaging.is_default,
      isActive: updatedPackaging.is_active,
      createdAt: updatedPackaging.created_at,
      createdBy: updatedPackaging.created_by,
      updatedAt: updatedPackaging.updated_at,
      updatedBy: updatedPackaging.updated_by,
      deletedAt: updatedPackaging.deleted_at,
      version: updatedPackaging.version,
    };

    return NextResponse.json({ data: transformedPackaging });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/items/[id]/variants/[variantId]/packaging/[packagingId]
 * Delete packaging (soft delete)
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
    const { variantId, packagingId } = await context.params;

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

    // Verify packaging exists and belongs to company
    const { data: existingPackaging, error: packagingError } = await supabase
      .from("item_packaging")
      .select("is_default")
      .eq("id", packagingId)
      .eq("variant_id", variantId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (packagingError || !existingPackaging) {
      return NextResponse.json({ error: "Packaging not found" }, { status: 404 });
    }

    // Prevent deleting default packaging
    if (existingPackaging.is_default) {
      return NextResponse.json(
        { error: "Cannot delete default packaging" },
        { status: 400 }
      );
    }

    // Soft delete packaging
    const { error: deleteError } = await supabase
      .from("item_packaging")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", packagingId);

    if (deleteError) {

      return NextResponse.json(
        { error: "Failed to delete packaging" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Packaging deleted successfully" });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
