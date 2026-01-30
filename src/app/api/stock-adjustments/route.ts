import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { normalizeTransactionItems } from "@/services/inventory/normalizationService";
import type { StockTransactionItemInput } from "@/types/inventory-normalization";
type DbStockAdjustmentRow = {
  id: string;
  company_id: string;
  adjustment_code: string;
  adjustment_type: string;
  adjustment_date: string;
  warehouse_id: string | null;
  status: string;
  reason: string | null;
  notes: string | null;
  total_value: number | string | null;
  stock_transaction_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  posted_by: string | null;
  posted_at: string | null;
  custom_fields: { locationId?: string | null } | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};
type DbStockAdjustmentItem = {
  id: string;
  adjustment_id: string;
  item_id: string;
  item_code: string | null;
  item_name: string | null;
  current_qty: number | string | null;
  adjusted_qty: number | string | null;
  difference: number | string | null;
  unit_cost: number | string | null;
  total_cost: number | string | null;
  uom_id: string | null;
  uom_name: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string | null;
  input_qty?: number | string | null;
  input_packaging_id?: string | null;
  conversion_factor?: number | string | null;
  normalized_qty?: number | string | null;
  base_package_id?: string | null;
};

type StockAdjustmentItemInput = {
  itemId: string;
  packagingId?: string | null;
  currentQty: number;
  adjustedQty: number;
  unitCost: number;
  uomId: string;
  reason?: string | null;
};

type StockAdjustmentBody = {
  warehouseId: string;
  adjustmentType: string;
  adjustmentDate: string;
  reason: string;
  notes?: string | null;
  locationId?: string | null;
  items: StockAdjustmentItemInput[];
};

type WarehouseRow = {
  id: string;
  warehouse_code: string | null;
  warehouse_name: string | null;
};

type LocationRow = {
  id: string;
  code: string | null;
  name: string | null;
};

type UserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type StockTransactionRow = {
  id: string;
  transaction_code: string | null;
};

type ItemRow = {
  id: string;
  item_code: string | null;
  item_name: string | null;
};

type UomRow = {
  id: string;
  code: string | null;
};

// GET /api/stock-adjustments - List stock adjustments
export async function GET(request: NextRequest) {
  try {
    // Require 'stock_adjustments' view permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_ADJUSTMENTS, "view");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const searchParams = request.nextUrl.searchParams;

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

    // Parse query parameters
    const search = searchParams.get("search") || "";
    const warehouseId = searchParams.get("warehouseId") || "";
    const adjustmentType = searchParams.get("adjustmentType") || "";
    const status = searchParams.get("status") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    // Build query - simplified without nested relationships
    let query = supabase
      .from("stock_adjustments")
      .select(
        `
        id,
        company_id,
        adjustment_code,
        adjustment_type,
        adjustment_date,
        warehouse_id,
        status,
        reason,
        notes,
        total_value,
        stock_transaction_id,
        approved_by,
        approved_at,
        posted_by,
        posted_at,
        custom_fields,
        created_by,
        updated_by,
        created_at,
        updated_at,
        deleted_at
      `,
        { count: "exact" }
      )
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .order("adjustment_date", { ascending: false })
      .order("created_at", { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(`adjustment_code.ilike.%${search}%,reason.ilike.%${search}%`);
    }
    if (warehouseId) {
      query = query.eq("warehouse_id", warehouseId);
    }
    if (adjustmentType) {
      query = query.eq("adjustment_type", adjustmentType);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (startDate) {
      query = query.gte("adjustment_date", startDate);
    }
    if (endDate) {
      query = query.lte("adjustment_date", endDate);
    }

    // Execute query
    const { data: adjustments, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Collect unique IDs for related data
    const warehouseIds = new Set<string>();
    const locationIds = new Set<string>();
    const userIds = new Set<string>();
    const stockTransactionIds = new Set<string>();

    const typedAdjustments = (adjustments || []) as DbStockAdjustmentRow[];
    typedAdjustments.forEach((adj) => {
      if (adj.warehouse_id) warehouseIds.add(adj.warehouse_id);
      if (adj.custom_fields?.locationId) locationIds.add(adj.custom_fields.locationId);
      if (adj.created_by) userIds.add(adj.created_by);
      if (adj.updated_by) userIds.add(adj.updated_by);
      if (adj.approved_by) userIds.add(adj.approved_by);
      if (adj.posted_by) userIds.add(adj.posted_by);
      if (adj.stock_transaction_id) stockTransactionIds.add(adj.stock_transaction_id);
    });

    // Fetch related data in parallel
    const [warehousesData, locationsData, usersData, stockTransactionsData] = await Promise.all([
      warehouseIds.size > 0
        ? supabase
            .from("warehouses")
            .select("id, warehouse_code, warehouse_name")
            .in("id", Array.from(warehouseIds))
        : Promise.resolve({ data: [] }),
      locationIds.size > 0
        ? supabase
            .from("warehouse_locations")
            .select("id, code, name")
            .in("id", Array.from(locationIds))
        : Promise.resolve({ data: [] }),
      userIds.size > 0
        ? supabase.from("users").select("id, first_name, last_name").in("id", Array.from(userIds))
        : Promise.resolve({ data: [] }),
      stockTransactionIds.size > 0
        ? supabase
            .from("stock_transactions")
            .select("id, transaction_code")
            .in("id", Array.from(stockTransactionIds))
        : Promise.resolve({ data: [] }),
    ]);

    // Create lookup maps
    const warehousesMap = new Map(
      (warehousesData.data as WarehouseRow[] | null)?.map((w) => [w.id, w]) || []
    );
    const locationsMap = new Map(
      (locationsData.data as LocationRow[] | null)?.map((l) => [l.id, l]) || []
    );
    const usersMap = new Map((usersData.data as UserRow[] | null)?.map((u) => [u.id, u]) || []);
    const stockTransactionsMap = new Map(
      (stockTransactionsData.data as StockTransactionRow[] | null)?.map((st) => [st.id, st]) || []
    );

    // Fetch items for each adjustment
    const adjustmentIds = typedAdjustments.map((adj) => adj.id);
    const { data: itemsData } =
      adjustmentIds.length > 0
        ? await supabase
            .from("stock_adjustment_items")
            .select("*")
            .in("adjustment_id", adjustmentIds)
        : { data: [] };

    // Group items by adjustment
    const itemsByAdjustment = new Map<string, DbStockAdjustmentItem[]>();
    (itemsData as DbStockAdjustmentItem[] | null)?.forEach((item) => {
      const adjustmentId = item.adjustment_id;
      if (!itemsByAdjustment.has(adjustmentId)) {
        itemsByAdjustment.set(adjustmentId, []);
      }
      itemsByAdjustment.get(adjustmentId)!.push(item);
    });

    // Format response
    const formattedData = typedAdjustments.map((adj) => {
      const warehouse = adj.warehouse_id ? warehousesMap.get(adj.warehouse_id) : undefined;
      const createdBy = adj.created_by ? usersMap.get(adj.created_by) : undefined;
      const updatedBy = adj.updated_by ? usersMap.get(adj.updated_by) : undefined;
      const approvedBy = adj.approved_by ? usersMap.get(adj.approved_by) : undefined;
      const postedBy = adj.posted_by ? usersMap.get(adj.posted_by) : undefined;
      const stockTransaction = adj.stock_transaction_id
        ? stockTransactionsMap.get(adj.stock_transaction_id)
        : undefined;
      const items = itemsByAdjustment.get(adj.id) || [];
      const locationId = adj.custom_fields?.locationId || null;
      const location = locationId ? locationsMap.get(locationId) : null;

      return {
        id: adj.id,
        companyId: adj.company_id,
        adjustmentCode: adj.adjustment_code,
        adjustmentType: adj.adjustment_type,
        adjustmentDate: adj.adjustment_date,
        warehouseId: adj.warehouse_id,
        locationId,
        locationCode: location?.code || null,
        locationName: location?.name || null,
        warehouseName: warehouse?.warehouse_name || null,
        status: adj.status,
        reason: adj.reason,
        notes: adj.notes,
        totalValue: parseFloat(String(adj.total_value ?? 0)),
        stockTransactionId: adj.stock_transaction_id,
        stockTransactionCode: stockTransaction?.transaction_code || null,
        approvedBy: adj.approved_by,
        approvedByName: approvedBy
          ? `${approvedBy.first_name || ""} ${approvedBy.last_name || ""}`.trim()
          : null,
        approvedAt: adj.approved_at,
        postedBy: adj.posted_by,
        postedByName: postedBy
          ? `${postedBy.first_name || ""} ${postedBy.last_name || ""}`.trim()
          : null,
        postedAt: adj.posted_at,
        createdBy: adj.created_by,
        createdByName: createdBy
          ? `${createdBy.first_name || ""} ${createdBy.last_name || ""}`.trim()
          : null,
        updatedBy: adj.updated_by,
        updatedByName: updatedBy
          ? `${updatedBy.first_name || ""} ${updatedBy.last_name || ""}`.trim()
          : null,
        createdAt: adj.created_at,
        updatedAt: adj.updated_at,
        items: items.map((item) => ({
          id: item.id,
          adjustmentId: item.adjustment_id,
          itemId: item.item_id,
          itemCode: item.item_code,
          itemName: item.item_name,
          currentQty: parseFloat(String(item.current_qty ?? 0)),
          adjustedQty: parseFloat(String(item.adjusted_qty ?? 0)),
          difference: parseFloat(String(item.difference ?? 0)),
          unitCost: parseFloat(String(item.unit_cost ?? 0)),
          totalCost: parseFloat(String(item.total_cost ?? 0)),
          uomId: item.uom_id,
          uomName: item.uom_name,
          reason: item.reason,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })),
      };
    });

    return NextResponse.json({
      data: formattedData,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/stock-adjustments - Create new stock adjustment
export async function POST(request: NextRequest) {
  try {
    // Require 'stock_adjustments' create permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_ADJUSTMENTS, "create");
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
    const body = (await request.json()) as StockAdjustmentBody;

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
    if (!body.warehouseId || !body.adjustmentType || !body.adjustmentDate || !body.reason) {
      return NextResponse.json(
        { error: "Missing required fields: warehouseId, adjustmentType, adjustmentDate, reason" },
        { status: 400 }
      );
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    // Generate adjustment code with timestamp to avoid duplicates
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");
    const milliseconds = now.getTime().toString().slice(-4);
    const adjustmentCode = `ADJ-${dateStr}${milliseconds}`;

    // Normalize item quantities from packages to base units
    const itemInputs: StockTransactionItemInput[] = body.items.map((item) => ({
      itemId: item.itemId,
      packagingId: item.packagingId || null,
      inputQty: item.adjustedQty,
      unitCost: item.unitCost || 0,
    }));

    let normalizedItems;
    try {
      normalizedItems = await normalizeTransactionItems(userData.company_id, itemInputs);
    } catch (normError) {
      return NextResponse.json(
        {
          error:
            normError instanceof Error ? normError.message : "Failed to normalize item quantities",
        },
        { status: 400 }
      );
    }

    // Calculate total value using normalized quantities
    const totalValue = body.items.reduce((sum, item, index) => {
      const normalizedItem = normalizedItems[index];
      const normalizedAdjusted = normalizedItem.normalizedQty;
      const difference = normalizedAdjusted - item.currentQty;
      return sum + difference * item.unitCost;
    }, 0);

    // Create adjustment header
    const { data: adjustment, error: adjustmentError } = await supabase
      .from("stock_adjustments")
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        adjustment_code: adjustmentCode,
        adjustment_type: body.adjustmentType,
        adjustment_date: body.adjustmentDate,
        warehouse_id: body.warehouseId,
        status: "draft",
        reason: body.reason,
        notes: body.notes || null,
        total_value: totalValue,
        custom_fields: body.locationId ? { locationId: body.locationId } : null,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (adjustmentError) {
      return NextResponse.json({ error: adjustmentError.message }, { status: 500 });
    }

    // Get item details for items
    const itemIds = body.items.map((item) => item.itemId);
    const { data: itemsData } = await supabase
      .from("items")
      .select("id, item_code, item_name")
      .in("id", itemIds);

    const itemsMap = new Map((itemsData as ItemRow[] | null)?.map((item) => [item.id, item]) || []);

    // Get UOM details
    const uomIds = body.items.map((item) => item.uomId);
    const { data: uomsData } = await supabase
      .from("units_of_measure")
      .select("id, code")
      .in("id", uomIds);

    const uomsMap = new Map((uomsData as UomRow[] | null)?.map((uom) => [uom.id, uom]) || []);

    // Create adjustment items with normalization metadata
    const adjustmentItems = body.items.map((item, index) => {
      const itemData = itemsMap.get(item.itemId);
      const uomData = uomsMap.get(item.uomId);
      const normalizedItem = normalizedItems[index];
      const normalizedAdjusted = normalizedItem.normalizedQty;
      const difference = normalizedAdjusted - item.currentQty;
      const totalCost = difference * item.unitCost;

      return {
        company_id: userData.company_id,
        adjustment_id: adjustment.id,
        item_id: item.itemId,
        item_code: itemData?.item_code || "",
        item_name: itemData?.item_name || "",
        current_qty: item.currentQty,
        adjusted_qty: normalizedAdjusted, // Use normalized quantity
        // Normalization fields
        input_qty: normalizedItem.inputQty,
        input_packaging_id: normalizedItem.inputPackagingId,
        conversion_factor: normalizedItem.conversionFactor,
        normalized_qty: normalizedItem.normalizedQty,
        base_package_id: normalizedItem.basePackageId,
        // Other fields
        difference: difference,
        unit_cost: item.unitCost,
        total_cost: totalCost,
        uom_id: normalizedItem.uomId,
        uom_name: uomData?.code || "",
        reason: item.reason || null,
        created_by: user.id,
        updated_by: user.id,
      };
    });

    const { error: itemsError } = await supabase
      .from("stock_adjustment_items")
      .insert(adjustmentItems);

    if (itemsError) {
      // Rollback adjustment
      await supabase.from("stock_adjustments").delete().eq("id", adjustment.id);
      return NextResponse.json({ error: "Failed to create adjustment items" }, { status: 500 });
    }

    // Fetch the complete adjustment with items
    const { data: completeAdjustment } = await supabase
      .from("stock_adjustments")
      .select("*")
      .eq("id", adjustment.id)
      .single();

    const { data: completeItems } = await supabase
      .from("stock_adjustment_items")
      .select("*")
      .eq("adjustment_id", adjustment.id);

    return NextResponse.json({
      id: completeAdjustment.id,
      companyId: completeAdjustment.company_id,
      adjustmentCode: completeAdjustment.adjustment_code,
      adjustmentType: completeAdjustment.adjustment_type,
      adjustmentDate: completeAdjustment.adjustment_date,
      warehouseId: completeAdjustment.warehouse_id,
      status: completeAdjustment.status,
      reason: completeAdjustment.reason,
      notes: completeAdjustment.notes,
      totalValue: parseFloat(String(completeAdjustment.total_value ?? 0)),
      createdBy: completeAdjustment.created_by,
      updatedBy: completeAdjustment.updated_by,
      createdAt: completeAdjustment.created_at,
      updatedAt: completeAdjustment.updated_at,
      items:
        (completeItems as DbStockAdjustmentItem[] | null)?.map((item) => ({
          id: item.id,
          adjustmentId: item.adjustment_id,
          itemId: item.item_id,
          itemCode: item.item_code,
          itemName: item.item_name,
          currentQty: parseFloat(String(item.current_qty ?? 0)),
          adjustedQty: parseFloat(String(item.adjusted_qty ?? 0)),
          difference: parseFloat(String(item.difference ?? 0)),
          unitCost: parseFloat(String(item.unit_cost ?? 0)),
          totalCost: parseFloat(String(item.total_cost ?? 0)),
          uomId: item.uom_id,
          uomName: item.uom_name,
          reason: item.reason,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })) || [],
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
