import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { CreateItemWithPackagesInput } from "@/hooks/useCreateItemWithPackages";

/**
 * POST /api/items/create-with-packages
 *
 * Creates an item with packages atomically using the create_item_with_packages() database function.
 * This solves the chicken-egg problem of items.package_id referencing item_packaging.
 */
export async function POST(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "create");
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
    const body = (await request.json()) as CreateItemWithPackagesInput;

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

    // Validate business unit context
    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    // Validate required fields
    if (!body.itemCode || !body.itemName) {
      return NextResponse.json(
        { error: "Missing required fields: itemCode, itemName" },
        { status: 400 }
      );
    }

    // Validate base package
    if (!body.basePackage?.packName) {
      return NextResponse.json({ error: "Base package is required" }, { status: 400 });
    }

    // Prepare additional packages (if any)
    type AdditionalPackageInput = NonNullable<
      CreateItemWithPackagesInput["additionalPackages"]
    >[number];

    const additionalPackages = (body.additionalPackages || []).map(
      (pkg: AdditionalPackageInput) => ({
        pack_type: pkg.packType,
        pack_name: pkg.packName,
        qty_per_pack: Number(pkg.qtyPerPack),
        uom_id: pkg.uomId || null,
        barcode: pkg.barcode || null,
        is_active: pkg.isActive !== false,
      })
    );

    // Call the database function to create item with packages atomically
    const { data: result, error: dbError } = await supabase.rpc("create_item_with_packages", {
      p_company_id: userData.company_id,
      p_user_id: user.id,
      p_item_code: body.itemCode,
      p_item_name: body.itemName,
      p_item_name_cn: body.itemNameCn || null,
      p_item_description: body.itemDescription || null,
      p_item_type: body.itemType || "finished_good",
      p_base_package_name: body.basePackage.packName,
      p_base_package_type: body.basePackage.packType || "base",
      p_base_uom_id: body.basePackage.uomId || null,
      p_standard_cost: body.standardCost ? Number(body.standardCost) : 0,
      p_list_price: body.listPrice ? Number(body.listPrice) : 0,
      p_additional_packages: additionalPackages,
    });

    if (dbError) {
      console.error("Database function error:", dbError);
      return NextResponse.json(
        { error: dbError.message || "Failed to create item with packages" },
        { status: 500 }
      );
    }

    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: "No result returned from database function" },
        { status: 500 }
      );
    }

    const createdItem = result[0];

    // Fetch the complete item details with packages
    const { data: completeItem, error: fetchError } = await supabase
      .from("items")
      .select(
        `
        id,
        item_code,
        item_name,
        item_name_cn,
        description,
        item_type,
        package_id,
        setup_complete,
        standard_cost,
        list_price,
        created_at,
        updated_at,
        base_package:item_packaging!package_id(
          id,
          pack_name,
          pack_type,
          qty_per_pack,
          uom_id
        )
      `
      )
      .eq("id", createdItem.item_id)
      .single();

    if (fetchError || !completeItem) {
      // Item was created but fetch failed - still return success with basic info
      return NextResponse.json(
        {
          data: {
            id: createdItem.item_id,
            basePackageId: createdItem.base_package_id,
            message: createdItem.message,
          },
          message: "Item created successfully",
        },
        { status: 201 }
      );
    }

    // Fetch all packages for this item
    const { data: packages } = await supabase
      .from("item_packaging")
      .select("*")
      .eq("item_id", createdItem.item_id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .order("is_default", { ascending: false })
      .order("qty_per_pack", { ascending: true });

    return NextResponse.json(
      {
        data: {
          item: {
            id: completeItem.id,
            itemCode: completeItem.item_code,
            itemName: completeItem.item_name,
            itemNameCn: completeItem.item_name_cn || undefined,
            description: completeItem.description,
            itemType: completeItem.item_type,
            packageId: completeItem.package_id,
            setupComplete: completeItem.setup_complete,
            standardCost: parseFloat(completeItem.standard_cost || 0),
            listPrice: parseFloat(completeItem.list_price || 0),
            basePackage: completeItem.base_package,
            createdAt: completeItem.created_at,
            updatedAt: completeItem.updated_at,
          },
          packages:
            packages?.map((pkg) => ({
              id: pkg.id,
              packType: pkg.pack_type,
              packName: pkg.pack_name,
              qtyPerPack: parseFloat(pkg.qty_per_pack),
              uomId: pkg.uom_id,
              barcode: pkg.barcode,
              isDefault: pkg.is_default,
              isActive: pkg.is_active,
            })) || [],
        },
        message: "Item created successfully with packages",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating item with packages:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
