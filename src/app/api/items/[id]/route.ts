import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import type { Item, UpdateItemRequest } from "@/types/item";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import QRCode from "qrcode";

type DbItem = {
  id: string;
  company_id: string;
  item_code: string;
  sku: string | null;
  sku_qr_image: string | null;
  item_name: string;
  item_name_cn: string | null;
  description: string | null;
  category_id: string | null;
  item_type: string;
  uom_id: string;
  cost_price: number | string | null;
  sales_price: number | string | null;
  image_url: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};
type ItemWarehouseRow = {
  current_stock: number | string | null;
  reserved_stock: number | string | null;
  available_stock: number | string | null;
  in_transit: number | string | null;
  estimated_arrival_date: string | null;
  reorder_level: number | string | null;
  reorder_quantity: number | string | null;
};
type DbItemCategory = {
  id: string;
  name: string;
  code: string;
};
type DbUoM = {
  id: string;
  code: string;
  name: string;
};
type ItemRow = DbItem & {
  item_category: DbItemCategory | null;
  unit_of_measure: DbUoM | null;
};

const ITEM_DETAIL_SELECT = `
  *,
  item_category:item_categories!items_category_id_fkey (
    id,
    name,
    code
  ),
  unit_of_measure:units_of_measure!items_uom_id_fkey (
    id,
    code,
    name
  )
`;

const generateSkuQrDataUrl = async (sku: string) =>
  QRCode.toDataURL(sku, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
    color: {
      dark: "#111111",
      light: "#FFFFFF",
    },
  });

// Transform database item to frontend Item type
function transformDbItem(dbItem: ItemRow): Item {
  return {
    id: dbItem.id,
    companyId: dbItem.company_id,
    code: dbItem.item_code,
    sku: dbItem.sku || undefined,
    skuQrImage: dbItem.sku_qr_image || undefined,
    name: dbItem.item_name,
    chineseName: dbItem.item_name_cn || undefined,
    description: dbItem.description || "",
    itemType: dbItem.item_type as Item["itemType"],
    uom: dbItem.unit_of_measure?.code || "",
    uomId: dbItem.uom_id,
    category: dbItem.item_category?.name || "",
    standardCost: Number(dbItem.cost_price) || 0,
    listPrice: Number(dbItem.sales_price) || 0,
    reorderLevel: 0,
    reorderQty: 0,
    imageUrl: dbItem.image_url || undefined,
    isActive: dbItem.is_active ?? true,
    createdAt: dbItem.created_at,
    updatedAt: dbItem.updated_at,
  };
}

// GET /api/items/[id] - Get single item
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check permission
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "view");
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch item
    const { data: fetchedItem, error } = await supabase
      .from("items")
      .select(ITEM_DETAIL_SELECT)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch item", details: error.message },
        { status: 500 }
      );
    }

    if (!fetchedItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    let data = fetchedItem;

    // Backfill QR image for legacy records that have SKU but no stored QR image.
    if (data.sku && !data.sku_qr_image) {
      const qrDataUrl = await generateSkuQrDataUrl(data.sku);
      const { data: patchedItem } = await supabase
        .from("items")
        .update({ sku_qr_image: qrDataUrl })
        .eq("id", id)
        .eq("company_id", data.company_id)
        .select(ITEM_DETAIL_SELECT)
        .maybeSingle();

      if (patchedItem) {
        data = patchedItem;
      }
    }

    let onHand = 0;
    let allocated = 0;
    let available = 0;
    let reorderLevel = 0;
    let reorderQty = 0;
    let inTransit = 0;
    let estimatedArrivalDate: string | null = null;

    let inventoryQuery = supabase
      .from("item_warehouse")
      .select(
        "current_stock, reserved_stock, available_stock, in_transit, estimated_arrival_date, reorder_level, reorder_quantity, warehouses!inner(business_unit_id)"
      )
      .eq("item_id", id)
      .eq("company_id", data.company_id)
      .is("deleted_at", null);

    if (currentBusinessUnitId) {
      inventoryQuery = inventoryQuery.eq("warehouses.business_unit_id", currentBusinessUnitId);
    }

    const { data: inventoryRows } = await inventoryQuery;
    if (inventoryRows && inventoryRows.length > 0) {
      for (const row of inventoryRows as ItemWarehouseRow[]) {
        const rowOnHand = Number(row.current_stock || 0);
        const rowAllocated = Number(row.reserved_stock || 0);
        const rowAvailable =
          row.available_stock == null
            ? Math.max(0, rowOnHand - rowAllocated)
            : Number(row.available_stock || 0);

        onHand += rowOnHand;
        allocated += rowAllocated;
        available += rowAvailable;
        inTransit += Number(row.in_transit || 0);
        reorderLevel = Math.max(reorderLevel, Number(row.reorder_level || 0));
        reorderQty = Math.max(reorderQty, Number(row.reorder_quantity || 0));
        if (row.estimated_arrival_date) {
          if (!estimatedArrivalDate || row.estimated_arrival_date < estimatedArrivalDate) {
            estimatedArrivalDate = row.estimated_arrival_date;
          }
        }
      }
    }

    // Transform and return
    const item = {
      ...transformDbItem(data as ItemRow),
      onHand,
      allocated,
      available,
      inTransit,
      estimatedArrivalDate,
      reorderLevel,
      reorderQty,
    };
    return NextResponse.json({ data: item });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/items/[id] - Update item
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check permission
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "edit");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body: UpdateItemRequest = await request.json();

    // Check if item exists
    const { data: existing, error: existError } = await supabase
      .from("items")
      .select("id, company_id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (existError) {
      return NextResponse.json(
        { error: "Failed to check item", details: existError.message },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Build update object
    const updateData: Record<string, unknown> & { updated_by: string } = {
      updated_by: user.id,
    };

    if (body.name !== undefined) updateData.item_name = body.name;
    if (body.chineseName !== undefined) updateData.item_name_cn = body.chineseName;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.itemType !== undefined) updateData.item_type = body.itemType;
    if (body.standardCost !== undefined) {
      updateData.cost_price = body.standardCost.toString();
      updateData.purchase_price = body.standardCost.toString();
    }
    if (body.listPrice !== undefined) updateData.sales_price = body.listPrice.toString();
    if (body.imageUrl !== undefined) updateData.image_url = body.imageUrl;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;

    // Get UoM ID if provided
    if (body.uom) {
      const { data: uomData } = await supabase
        .from("units_of_measure")
        .select("id")
        .eq("company_id", existing.company_id)
        .eq("code", body.uom)
        .is("deleted_at", null)
        .maybeSingle();

      if (!uomData) {
        return NextResponse.json(
          { error: "Invalid unit of measure", details: `UoM "${body.uom}" not found` },
          { status: 400 }
        );
      }
      updateData.uom_id = uomData.id;
    }

    // Get Category ID if provided
    if (body.category) {
      const { data: categoryData } = await supabase
        .from("item_categories")
        .select("id")
        .eq("company_id", existing.company_id)
        .eq("name", body.category)
        .is("deleted_at", null)
        .maybeSingle();

      if (!categoryData) {
        return NextResponse.json(
          { error: "Invalid category", details: `Category "${body.category}" not found` },
          { status: 400 }
        );
      }

      updateData.category_id = categoryData.id;
    }

    if (body.reorderLevel !== undefined || body.reorderQty !== undefined) {
      const reorderUpdate: Record<string, unknown> = {
        updated_by: user.id,
      };

      if (body.reorderLevel !== undefined) {
        reorderUpdate.reorder_level = body.reorderLevel;
      }

      if (body.reorderQty !== undefined) {
        reorderUpdate.reorder_quantity = body.reorderQty;
      }

      const { error: reorderUpdateError } = await supabase
        .from("item_warehouse")
        .update(reorderUpdate)
        .eq("company_id", existing.company_id)
        .eq("item_id", id)
        .is("deleted_at", null);

      if (reorderUpdateError) {
        return NextResponse.json(
          { error: "Failed to update reorder settings", details: reorderUpdateError.message },
          { status: 500 }
        );
      }
    }

    // Update item
    const { data: updatedItem, error: updateError } = await supabase
      .from("items")
      .update(updateData)
      .eq("id", id)
      .select(ITEM_DETAIL_SELECT)
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update item", details: updateError.message },
        { status: 500 }
      );
    }

    // Transform and return
    const item = transformDbItem(updatedItem as ItemRow);
    return NextResponse.json({ data: item });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/items/[id] - Soft delete item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check permission
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "delete");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if item exists
    const { data: existing } = await supabase
      .from("items")
      .select("id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Soft delete (set deleted_at timestamp)
    const { error: deleteError } = await supabase
      .from("items")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete item", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Item deleted successfully" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
