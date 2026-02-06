import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import type { Item, UpdateItemRequest } from "@/types/item";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type DbItem = {
  id: string;
  company_id: string;
  item_code: string;
  item_name: string;
  item_name_cn: string | null;
  description: string | null;
  item_type: string;
  uom_id: string;
  cost_price: number | string | null;
  sales_price: number | string | null;
  image_url: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
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
  item_categories: DbItemCategory | DbItemCategory[] | null;
  units_of_measure: DbUoM | DbUoM[] | null;
};

// Transform database item to frontend Item type
function transformDbItem(dbItem: ItemRow): Item {
  const category = Array.isArray(dbItem.item_categories)
    ? dbItem.item_categories[0]
    : dbItem.item_categories;
  const uom = Array.isArray(dbItem.units_of_measure)
    ? dbItem.units_of_measure[0]
    : dbItem.units_of_measure;
  return {
    id: dbItem.id,
    companyId: dbItem.company_id,
    code: dbItem.item_code,
    name: dbItem.item_name,
    chineseName: dbItem.item_name_cn || undefined,
    description: dbItem.description || "",
    itemType: dbItem.item_type as Item["itemType"],
    uom: uom?.code || "",
    uomId: dbItem.uom_id,
    category: category?.name || "",
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
    const { data, error } = await supabase
      .from("items")
      .select(
        `
        *,
        item_categories (
          id,
          name,
          code
        ),
        units_of_measure (
          id,
          code,
          name
        )
      `
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch item", details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    let inTransit = 0;
    let estimatedArrivalDate: string | null = null;

    let inventoryQuery = supabase
      .from("item_warehouse")
      .select("in_transit, estimated_arrival_date, warehouses!inner(business_unit_id)")
      .eq("item_id", id)
      .eq("company_id", data.company_id)
      .is("deleted_at", null);

    if (currentBusinessUnitId) {
      inventoryQuery = inventoryQuery.eq("warehouses.business_unit_id", currentBusinessUnitId);
    }

    const { data: inventoryRows } = await inventoryQuery;
    if (inventoryRows && inventoryRows.length > 0) {
      for (const row of inventoryRows as { in_transit: number | string | null; estimated_arrival_date: string | null }[]) {
        inTransit += Number(row.in_transit || 0);
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
      inTransit,
      estimatedArrivalDate,
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

    // Update item
    const { data: updatedItem, error: updateError } = await supabase
      .from("items")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        *,
        item_categories (
          id,
          name,
          code
        ),
        units_of_measure (
          id,
          code,
          name
        )
      `
      )
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
