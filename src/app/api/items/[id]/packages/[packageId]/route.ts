import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type PackageItemRef = {
  package_id: string | null;
};

type PackageRow = {
  id: string;
  item_id: string;
  pack_type: string;
  pack_name: string;
  qty_per_pack: number | string;
  uom_id: string | null;
  barcode: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  units_of_measure?:
    | { id: string; code: string; name: string; symbol: string | null }
    | { id: string; code: string; name: string; symbol: string | null }[]
    | null;
  items?: PackageItemRef | PackageItemRef[] | null;
};

type UpdatePackageBody = {
  packType?: string;
  packName?: string;
  qtyPerPack?: number | string;
  uomId?: string | null;
  barcode?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
};

type UpdatePackageRow = {
  updated_by: string;
  updated_at: string;
  pack_type?: string;
  pack_name?: string;
  qty_per_pack?: number;
  uom_id?: string | null;
  barcode?: string | null;
  is_default?: boolean;
  is_active?: boolean;
};

// GET /api/items/[id]/packages/[packageId] - Get specific package details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; packageId: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "view");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id: itemId, packageId } = await params;

    // Check authentication
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

    // Get package details
    const { data: pkg, error: pkgError } = await supabase
      .from("item_packaging")
      .select(
        `
        id,
        item_id,
        pack_type,
        pack_name,
        qty_per_pack,
        uom_id,
        barcode,
        is_default,
        is_active,
        created_at,
        updated_at,
        units_of_measure(id, code, name, symbol),
        items!item_packaging_item_id_fkey(id, item_code, item_name, package_id)
      `
      )
      .eq("id", packageId)
      .eq("item_id", itemId)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (pkgError || !pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    const itemRefRaw = (pkg as PackageRow).items;
    const item = Array.isArray(itemRefRaw) ? itemRefRaw[0] : itemRefRaw;
    const uomRaw = (pkg as PackageRow).units_of_measure;
    const uom = Array.isArray(uomRaw) ? uomRaw[0] : uomRaw;

    return NextResponse.json({
      data: {
        id: pkg.id,
        itemId: pkg.item_id,
        packType: pkg.pack_type,
        packName: pkg.pack_name,
        qtyPerPack: parseFloat(pkg.qty_per_pack),
        uomId: pkg.uom_id,
        uom,
        barcode: pkg.barcode,
        isDefault: pkg.is_default,
        isBasePackage: pkg.id === item?.package_id,
        isActive: pkg.is_active,
        createdAt: pkg.created_at,
        updatedAt: pkg.updated_at,
      },
    });
  } catch (error) {
    console.error("Error fetching package:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/items/[id]/packages/[packageId] - Update a package
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; packageId: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "edit");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id: itemId, packageId } = await params;
    const body = (await request.json()) as UpdatePackageBody;

    // Check authentication
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

    // Verify package exists and belongs to the item
    const { data: existingPkg, error: pkgError } = await supabase
      .from("item_packaging")
      .select("id, item_id, pack_type, items!item_packaging_item_id_fkey(package_id)")
      .eq("id", packageId)
      .eq("item_id", itemId)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (pkgError || !existingPkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    const itemRefRaw = (existingPkg as PackageRow).items;
    const item = Array.isArray(itemRefRaw) ? itemRefRaw[0] : itemRefRaw;
    const isBasePackage = packageId === item?.package_id;

    // Validate: Cannot change qty_per_pack of base package (must be 1.0)
    if (isBasePackage && body.qtyPerPack && Number(body.qtyPerPack) !== 1.0) {
      return NextResponse.json(
        {
          error:
            "Cannot change qtyPerPack of base package. Base package must have qtyPerPack = 1.0",
        },
        { status: 400 }
      );
    }

    // Validate qty_per_pack if provided
    if (body.qtyPerPack && Number(body.qtyPerPack) <= 0) {
      return NextResponse.json({ error: "qtyPerPack must be greater than 0" }, { status: 400 });
    }

    // Check if changing pack_type would conflict
    if (body.packType && body.packType !== existingPkg.pack_type) {
      const { data: conflictPkg } = await supabase
        .from("item_packaging")
        .select("id")
        .eq("item_id", itemId)
        .eq("pack_type", body.packType)
        .eq("company_id", userData.company_id)
        .is("deleted_at", null)
        .single();

      if (conflictPkg) {
        return NextResponse.json(
          { error: "A package with this pack_type already exists for this item" },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: UpdatePackageRow = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (body.packType !== undefined) updateData.pack_type = body.packType;
    if (body.packName !== undefined) updateData.pack_name = body.packName;
    if (body.qtyPerPack !== undefined) updateData.qty_per_pack = Number(body.qtyPerPack);
    if (body.uomId !== undefined) updateData.uom_id = body.uomId;
    if (body.barcode !== undefined) updateData.barcode = body.barcode;
    if (body.isDefault !== undefined) updateData.is_default = body.isDefault;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;

    // Update the package
    const { data: updatedPackage, error: updateError } = await supabase
      .from("item_packaging")
      .update(updateData)
      .eq("id", packageId)
      .select(
        `
        id,
        pack_type,
        pack_name,
        qty_per_pack,
        uom_id,
        barcode,
        is_default,
        is_active,
        created_at,
        updated_at
      `
      )
      .single();

    if (updateError || !updatedPackage) {
      return NextResponse.json({ error: "Failed to update package" }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        id: updatedPackage.id,
        packType: updatedPackage.pack_type,
        packName: updatedPackage.pack_name,
        qtyPerPack: parseFloat(updatedPackage.qty_per_pack),
        uomId: updatedPackage.uom_id,
        barcode: updatedPackage.barcode,
        isDefault: updatedPackage.is_default,
        isBasePackage,
        isActive: updatedPackage.is_active,
        createdAt: updatedPackage.created_at,
        updatedAt: updatedPackage.updated_at,
      },
      message: "Package updated successfully",
    });
  } catch (error) {
    console.error("Error updating package:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/items/[id]/packages/[packageId] - Delete a package (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; packageId: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "delete");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id: itemId, packageId } = await params;

    // Check authentication
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

    // Verify package exists
    const { data: pkg, error: pkgError } = await supabase
      .from("item_packaging")
      .select("id, items!item_packaging_item_id_fkey(package_id)")
      .eq("id", packageId)
      .eq("item_id", itemId)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (pkgError || !pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    const itemRefRaw = (pkg as PackageRow).items;
    const item = Array.isArray(itemRefRaw) ? itemRefRaw[0] : itemRefRaw;

    // Prevent deletion of base package
    if (packageId === item?.package_id) {
      return NextResponse.json(
        {
          error:
            "Cannot delete the base package. This package is set as the item's base storage unit.",
        },
        { status: 400 }
      );
    }

    // Check if package is used in any transactions
    const { count: txCount } = await supabase
      .from("stock_transaction_items")
      .select("id", { count: "exact", head: true })
      .eq("input_packaging_id", packageId);

    if (txCount && txCount > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete package that has been used in transactions",
          details: `This package is referenced in ${txCount} transaction(s)`,
        },
        { status: 400 }
      );
    }

    // Soft delete the package
    const { error: deleteError } = await supabase
      .from("item_packaging")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", packageId);

    if (deleteError) {
      return NextResponse.json({ error: "Failed to delete package" }, { status: 500 });
    }

    return NextResponse.json({
      message: "Package deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting package:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
