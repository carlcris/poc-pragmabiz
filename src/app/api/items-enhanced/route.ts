import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requireLookupDataAccess } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

export interface ItemWithStock {
  id: string;
  code: string;
  sku?: string;
  name: string;
  chineseName?: string;
  category: string;
  categoryId: string;
  supplier: string;
  supplierId: string | null;
  onHand: number;
  allocated: number;
  available: number;
  reorderPoint: number;
  onPO: number;
  onSO: number;
  inTransit: number;
  estimatedArrivalDate?: string | null;
  status: "normal" | "low_stock" | "out_of_stock" | "overstock" | "discontinued";
  uom: string;
  uomId: string;
  standardCost: number;
  purchasePrice?: number;
  listPrice: number;
  itemType: string;
  isActive: boolean;
  imageUrl?: string;
}

type ItemStatus = ItemWithStock["status"];

type ItemsEnhancedRpcRow = {
  id: string;
  item_code: string;
  sku: string | null;
  item_name: string;
  item_name_cn: string | null;
  category_id: string | null;
  category_name: string | null;
  uom_id: string | null;
  uom_code: string | null;
  cost_price: number | string | null;
  purchase_price: number | string | null;
  sales_price: number | string | null;
  item_type: string;
  is_active: boolean | null;
  image_url: string | null;
  on_hand: number | string | null;
  allocated: number | string | null;
  available: number | string | null;
  reorder_point: number | string | null;
  on_po: number | string | null;
  on_so: number | string | null;
  in_transit: number | string | null;
  estimated_arrival_date: string | null;
  status: ItemStatus;
  total_count: number | string;
};

type ItemsEnhancedStatsRow = {
  total_available_value: number | string | null;
  low_stock_count: number | string | null;
  out_of_stock_count: number | string | null;
  total_count: number | string | null;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parsePositiveInt = (raw: string | null, fallback: number) => {
  const parsed = Number.parseInt(raw || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toNumber = (value: number | string | null | undefined): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isUuid = (value: string | null): value is string => !!value && UUID_REGEX.test(value);

const asStatus = (value: string | null): ItemStatus | null => {
  if (!value || value === "all") return null;
  if (
    value === "normal" ||
    value === "low_stock" ||
    value === "out_of_stock" ||
    value === "overstock" ||
    value === "discontinued"
  ) {
    return value;
  }
  return null;
};

export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requireLookupDataAccess(RESOURCES.ITEMS);
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() || null;
    const rawCategory = searchParams.get("category");
    const rawWarehouseId = searchParams.get("warehouseId");
    const stockStatus = asStatus(searchParams.get("status"));
    const itemType = searchParams.get("itemType")?.trim() || null;
    const includeStats = searchParams.get("includeStats") === "true";
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = parsePositiveInt(searchParams.get("limit"), 10);

    if (rawCategory && !isUuid(rawCategory)) {
      return NextResponse.json({ error: "Invalid category filter" }, { status: 400 });
    }

    if (rawWarehouseId && !isUuid(rawWarehouseId)) {
      return NextResponse.json({ error: "Invalid warehouse filter" }, { status: 400 });
    }

    // "All Warehouses" should aggregate company-wide inventory.
    // Only scope by BU when a specific warehouse is selected.
    let effectiveBusinessUnitId: string | null = null;

    if (rawWarehouseId) {
      const { data: warehouseRow, error: warehouseError } = await supabase
        .from("warehouses")
        .select("id, business_unit_id")
        .eq("id", rawWarehouseId)
        .eq("company_id", userData.company_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (warehouseError) {
        return NextResponse.json({ error: "Failed to resolve warehouse" }, { status: 500 });
      }

      if (!warehouseRow) {
        return NextResponse.json({ error: "Invalid warehouse filter" }, { status: 400 });
      }

      effectiveBusinessUnitId = warehouseRow.business_unit_id ?? currentBusinessUnitId ?? null;
    }

    const rpcPayload = {
      p_company_id: userData.company_id,
      p_search: search,
      p_category_id: rawCategory,
      p_warehouse_id: rawWarehouseId,
      p_item_type: itemType,
      p_status: stockStatus,
      p_business_unit_id: effectiveBusinessUnitId,
      p_page: page,
      p_limit: limit,
    };

    const { data: rpcRows, error: rpcError } = await supabase.rpc("get_items_enhanced_page", rpcPayload);

    if (rpcError) {
      return NextResponse.json(
        { error: "Failed to fetch items", details: rpcError.message },
        { status: 500 }
      );
    }

    const rows = (rpcRows || []) as ItemsEnhancedRpcRow[];
    const itemsWithStock: ItemWithStock[] = rows.map((row) => ({
      id: row.id,
      code: row.item_code,
      sku: row.sku || undefined,
      name: row.item_name,
      chineseName: row.item_name_cn || undefined,
      category: row.category_name || "",
      categoryId: row.category_id || "",
      supplier: "",
      supplierId: null,
      onHand: toNumber(row.on_hand),
      allocated: toNumber(row.allocated),
      available: toNumber(row.available),
      reorderPoint: toNumber(row.reorder_point),
      onPO: toNumber(row.on_po),
      onSO: toNumber(row.on_so),
      inTransit: toNumber(row.in_transit),
      estimatedArrivalDate: row.estimated_arrival_date,
      status: row.status,
      uom: row.uom_code || "",
      uomId: row.uom_id || "",
      standardCost: toNumber(row.cost_price),
      purchasePrice: toNumber(row.purchase_price),
      listPrice: toNumber(row.sales_price),
      itemType: row.item_type,
      isActive: row.is_active ?? true,
      imageUrl: row.image_url || undefined,
    }));

    const total = rows.length > 0 ? toNumber(rows[0].total_count) : 0;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    if (!includeStats) {
      return NextResponse.json({
        data: itemsWithStock,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    }

    const { data: statsRows, error: statsError } = await supabase.rpc("get_items_enhanced_stats", {
      p_company_id: userData.company_id,
      p_search: search,
      p_category_id: rawCategory,
      p_warehouse_id: rawWarehouseId,
      p_item_type: itemType,
      p_status: stockStatus,
      p_business_unit_id: effectiveBusinessUnitId,
    });

    if (statsError) {
      return NextResponse.json(
        { error: "Failed to fetch item statistics", details: statsError.message },
        { status: 500 }
      );
    }

    const statsRow = ((statsRows || [])[0] || null) as ItemsEnhancedStatsRow | null;

    return NextResponse.json({
      data: itemsWithStock,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      statistics: {
        totalAvailableValue: toNumber(statsRow?.total_available_value),
        lowStockCount: toNumber(statsRow?.low_stock_count),
        outOfStockCount: toNumber(statsRow?.out_of_stock_count),
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
