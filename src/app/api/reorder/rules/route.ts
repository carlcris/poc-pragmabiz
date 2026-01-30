import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
type ReorderRuleRow = {
  id: string;
  item_id: string;
  warehouse_id: string;
  reorder_point: number | string | null;
  min_qty: number | string | null;
  max_qty: number | string | null;
  reorder_qty: number | string | null;
  lead_time_days: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};
type ItemRow = { item_code: string | null; item_name: string | null };
type WarehouseRow = { warehouse_code: string | null; warehouse_name: string | null };
type UomRow = { code: string | null; name: string | null };

type ReorderRuleWithJoins = ReorderRuleRow & {
  item?:
    | (Pick<ItemRow, "item_code" | "item_name"> & {
        uom?: Pick<UomRow, "code" | "name"> | Pick<UomRow, "code" | "name">[] | null;
      })
    | (Pick<ItemRow, "item_code" | "item_name"> & {
        uom?: Pick<UomRow, "code" | "name"> | Pick<UomRow, "code" | "name">[] | null;
      })[]
    | null;
  warehouse?:
    | Pick<WarehouseRow, "warehouse_code" | "warehouse_name">
    | Pick<WarehouseRow, "warehouse_code" | "warehouse_name">[]
    | null;
};

// GET /api/reorder/rules
export async function GET(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.REORDER_MANAGEMENT, "view");
    const { supabase } = await createServerClientWithBU();
    const { searchParams } = new URL(request.url);

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

    // Extract query parameters
    const itemId = searchParams.get("itemId");
    const warehouseId = searchParams.get("warehouseId");
    const isActive = searchParams.get("isActive");

    // Build query
    let query = supabase
      .from("reorder_rules")
      .select(
        `
        id,
        item_id,
        warehouse_id,
        reorder_point,
        min_qty,
        max_qty,
        reorder_qty,
        lead_time_days,
        is_active,
        created_at,
        updated_at,
        item:items!inner(
          id,
          item_code,
          item_name,
          uom:units_of_measure(id, code, name)
        ),
        warehouse:warehouses!inner(
          id,
          warehouse_code,
          warehouse_name
        )
      `
      )
      .eq("company_id", userData.company_id);

    // Apply filters
    if (itemId) {
      query = query.eq("item_id", itemId);
    }

    if (warehouseId) {
      query = query.eq("warehouse_id", warehouseId);
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq("is_active", isActive === "true");
    }

    query = query.order("created_at", { ascending: false });

    const { data: rules, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch reorder rules" }, { status: 500 });
    }

    // Format response
    const formattedRules = ((rules as ReorderRuleWithJoins[] | null) || []).map((rule) => {
      const item = Array.isArray(rule.item) ? rule.item[0] : rule.item;
      const warehouse = Array.isArray(rule.warehouse) ? rule.warehouse[0] : rule.warehouse;
      const uomRaw = item?.uom;
      const uom = Array.isArray(uomRaw) ? uomRaw[0] : uomRaw;
      return {
        id: rule.id,
        itemId: rule.item_id,
        itemCode: item?.item_code,
        itemName: item?.item_name,
        warehouseId: rule.warehouse_id,
        warehouseCode: warehouse?.warehouse_code,
        warehouseName: warehouse?.warehouse_name,
        reorderPoint: Number(rule.reorder_point),
        minQty: Number(rule.min_qty),
        maxQty: Number(rule.max_qty),
        reorderQty: Number(rule.reorder_qty),
        leadTimeDays: rule.lead_time_days,
        isActive: rule.is_active,
        uom: uom?.code || "",
        createdAt: rule.created_at,
        updatedAt: rule.updated_at,
      };
    });

    return NextResponse.json(formattedRules);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/reorder/rules
export async function POST(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.REORDER_MANAGEMENT, "create");
    const { supabase } = await createServerClientWithBU();
    const body = await request.json();

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

    // Validate required fields
    if (!body.itemId || !body.warehouseId) {
      return NextResponse.json({ error: "Item and warehouse are required" }, { status: 400 });
    }

    // Check if rule already exists for this item-warehouse combination
    const { data: existingRule } = await supabase
      .from("reorder_rules")
      .select("id")
      .eq("company_id", userData.company_id)
      .eq("item_id", body.itemId)
      .eq("warehouse_id", body.warehouseId)
      .single();

    if (existingRule) {
      return NextResponse.json(
        { error: "Reorder rule already exists for this item-warehouse combination" },
        { status: 400 }
      );
    }

    // Create reorder rule
    const { data: rule, error: createError } = await supabase
      .from("reorder_rules")
      .insert({
        company_id: userData.company_id,
        item_id: body.itemId,
        warehouse_id: body.warehouseId,
        reorder_point: body.reorderPoint || 0,
        min_qty: body.minQty || 0,
        max_qty: body.maxQty || 0,
        reorder_qty: body.reorderQty || 0,
        lead_time_days: body.leadTimeDays || 0,
        is_active: body.isActive !== undefined ? body.isActive : true,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (createError) {
      return NextResponse.json(
        { error: createError.message || "Failed to create reorder rule" },
        { status: 500 }
      );
    }

    return NextResponse.json(rule, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
