/**
 * Item Packaging API
 * Phase 3: UI/UX Integration
 *
 * Endpoints:
 * - GET /api/items/[id]/variants/[variantId]/packaging - Get all packaging for a variant
 * - POST /api/items/[id]/variants/[variantId]/packaging - Create new packaging
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { ItemPackaging, CreateItemPackagingInput } from "@/types/item-variant";

type RouteContext = {
  params: Promise<{ id: string; variantId: string }>;
};

/**
 * GET /api/items/[id]/variants/[variantId]/packaging
 * Get all packaging options for a specific variant
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

    // Get all packaging for the variant
    const { data: packaging, error: packagingError } = await supabase
      .from("item_packaging")
      .select("*")
      .eq("variant_id", variantId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("is_default", { ascending: false })
      .order("pack_type", { ascending: true });

    if (packagingError) {

      return NextResponse.json(
        { error: "Failed to fetch packaging" },
        { status: 500 }
      );
    }

    // Transform to camelCase
    const transformedPackaging: ItemPackaging[] = (packaging || []).map((p) => ({
      id: p.id,
      companyId: p.company_id,
      variantId: p.variant_id,
      packType: p.pack_type,
      packName: p.pack_name,
      qtyPerPack: p.qty_per_pack,
      barcode: p.barcode,
      isDefault: p.is_default,
      isActive: p.is_active,
      createdAt: p.created_at,
      createdBy: p.created_by,
      updatedAt: p.updated_at,
      updatedBy: p.updated_by,
      deletedAt: p.deleted_at,
      version: p.version,
    }));

    return NextResponse.json({
      data: transformedPackaging,
      total: transformedPackaging.length,
    });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/items/[id]/variants/[variantId]/packaging
 * Create new packaging for a variant
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
    const body: CreateItemPackagingInput = await request.json();

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
    if (!body.packType || !body.packName || !body.qtyPerPack) {
      return NextResponse.json(
        { error: "packType, packName, and qtyPerPack are required" },
        { status: 400 }
      );
    }

    if (body.qtyPerPack <= 0) {
      return NextResponse.json(
        { error: "qtyPerPack must be greater than 0" },
        { status: 400 }
      );
    }

    // Check for duplicate pack type
    const { data: existingPackaging } = await supabase
      .from("item_packaging")
      .select("id")
      .eq("company_id", companyId)
      .eq("variant_id", variantId)
      .eq("pack_type", body.packType)
      .is("deleted_at", null)
      .single();

    if (existingPackaging) {
      return NextResponse.json(
        { error: "Packaging type already exists for this variant" },
        { status: 409 }
      );
    }

    // Create new packaging
    const { data: newPackaging, error: createError } = await supabase
      .from("item_packaging")
      .insert({
        company_id: companyId,
        variant_id: variantId,
        pack_type: body.packType,
        pack_name: body.packName,
        qty_per_pack: body.qtyPerPack,
        barcode: body.barcode || null,
        is_active: body.isActive !== undefined ? body.isActive : true,
        is_default: false,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (createError) {

      return NextResponse.json(
        { error: "Failed to create packaging" },
        { status: 500 }
      );
    }

    // Transform to camelCase
    const transformedPackaging: ItemPackaging = {
      id: newPackaging.id,
      companyId: newPackaging.company_id,
      variantId: newPackaging.variant_id,
      packType: newPackaging.pack_type,
      packName: newPackaging.pack_name,
      qtyPerPack: newPackaging.qty_per_pack,
      barcode: newPackaging.barcode,
      isDefault: newPackaging.is_default,
      isActive: newPackaging.is_active,
      createdAt: newPackaging.created_at,
      createdBy: newPackaging.created_by,
      updatedAt: newPackaging.updated_at,
      updatedBy: newPackaging.updated_by,
      deletedAt: newPackaging.deleted_at,
      version: newPackaging.version,
    };

    return NextResponse.json({ data: transformedPackaging }, { status: 201 });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
