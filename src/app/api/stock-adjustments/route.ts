import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext, type RequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import type { Json } from "@/types/database.types";
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
  item_batch_location_id: string | null;
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
};

type StockAdjustmentItemInput = {
  itemId: string;
  itemBatchLocationId?: string | null;
  batchCode?: string | null;
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

type StockAdjustmentSaveResult = {
  adjustment_id: string;
  adjustment_code: string;
  status: string;
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

type BatchLocationRow = {
  id: string;
  batch_location_sku: string | null;
  location_id: string;
  item_batch:
    | {
        batch_code: string | null;
        received_at: string | null;
      }
    | {
        batch_code: string | null;
        received_at: string | null;
      }[]
    | null;
  warehouse_location:
    | {
        code: string | null;
        name: string | null;
      }
    | {
        code: string | null;
        name: string | null;
      }[]
    | null;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const ADJUSTMENT_TYPES = new Set([
  "physical_count",
  "damage",
  "loss",
  "found",
  "quality_issue",
  "other",
]);
const ADJUSTMENT_STATUSES = new Set(["draft", "pending", "approved", "posted", "rejected"]);

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeSearch = (value: string | null) => {
  if (!value) return null;
  const normalized = value.trim().replace(/[,%]/g, " ");
  return normalized.length > 0 ? normalized : null;
};

const toOne = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const validateStockAdjustmentWarehouseId = async (
  supabase: RequestContext["supabase"],
  companyId: string,
  currentBusinessUnitId: string,
  requestedWarehouseId: string
) => {
  const { data: requestedWarehouse, error } = await supabase
    .from("warehouses")
    .select("id")
    .eq("id", requestedWarehouseId)
    .eq("company_id", companyId)
    .eq("business_unit_id", currentBusinessUnitId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("Error validating stock adjustment warehouse:", error);
    return { valid: false, error: "Failed to validate warehouse" };
  }

  if (!requestedWarehouse) {
    return { valid: false, error: "Selected warehouse is not valid for the current business unit" };
  }

  return { valid: true, error: null };
};

// GET /api/stock-adjustments - List stock adjustments
async function GETHandler(request: NextRequest) {
  try {
    // Require 'stock_adjustments' view permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_ADJUSTMENTS, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId } = context;
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const search = normalizeSearch(searchParams.get("search"));
    const warehouseId = searchParams.get("warehouseId");
    const adjustmentType = searchParams.get("adjustmentType");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
    const offset = (page - 1) * limit;

    if (warehouseId && !UUID_REGEX.test(warehouseId)) {
      return NextResponse.json({ error: "Invalid warehouse filter" }, { status: 400 });
    }
    if (adjustmentType && !ADJUSTMENT_TYPES.has(adjustmentType)) {
      return NextResponse.json({ error: "Invalid adjustment type filter" }, { status: 400 });
    }
    if (status && !ADJUSTMENT_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

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
      .eq("company_id", companyId)
      .is("deleted_at", null);

    if (currentBusinessUnitId) {
      query = query.eq("business_unit_id", currentBusinessUnitId);
    }

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
    const {
      data: adjustments,
      error,
      count,
    } = await query
      .order("adjustment_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error loading stock adjustments:", error);
      return NextResponse.json({ error: "Failed to load stock adjustments" }, { status: 500 });
    }

    // Collect unique IDs for related data
    const warehouseIds = new Set<string>();
    const locationIds = new Set<string>();
    const userIds = new Set<string>();
    const stockTransactionIds = new Set<string>();

    const slicedAdjustments = (adjustments || []) as DbStockAdjustmentRow[];

    slicedAdjustments.forEach((adj) => {
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
    const adjustmentIds = slicedAdjustments.map((adj) => adj.id);
    const { data: itemsData } =
      adjustmentIds.length > 0
        ? await supabase
            .from("stock_adjustment_items")
            .select("*")
            .in("adjustment_id", adjustmentIds)
        : { data: [] };

    const batchLocationIds = Array.from(
      new Set(
        ((itemsData as DbStockAdjustmentItem[] | null) || [])
          .map((item) => item.item_batch_location_id)
          .filter((value): value is string => Boolean(value))
      )
    );
    const { data: batchLocationsData } =
      batchLocationIds.length > 0
        ? await supabase
            .from("item_batch_locations")
            .select(
              `
              id,
              batch_location_sku,
              location_id,
              item_batch:item_batches!item_batch_locations_item_batch_id_fkey(
                batch_code,
                received_at
              ),
              warehouse_location:warehouse_locations!item_batch_locations_location_id_fkey(
                code,
                name
              )
            `
            )
            .in("id", batchLocationIds)
        : { data: [] };
    const batchLocationsMap = new Map(
      (batchLocationsData as BatchLocationRow[] | null)?.map((row) => [row.id, row]) || []
    );

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
    const formattedData = slicedAdjustments.map((adj) => {
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
          ...(() => {
            const batchLocation = item.item_batch_location_id
              ? batchLocationsMap.get(item.item_batch_location_id)
              : null;
            const itemBatch = toOne(batchLocation?.item_batch);
            const batchWarehouseLocation = toOne(batchLocation?.warehouse_location);

            return {
              id: item.id,
              adjustmentId: item.adjustment_id,
              itemId: item.item_id,
              itemBatchLocationId: item.item_batch_location_id,
              batchLocationSku: batchLocation?.batch_location_sku || null,
              batchCode: itemBatch?.batch_code || null,
              batchReceivedAt: itemBatch?.received_at || null,
              batchWarehouseLocationId: batchLocation?.location_id || null,
              batchLocationCode: batchWarehouseLocation?.code || null,
              batchLocationName: batchWarehouseLocation?.name || null,
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
            };
          })(),
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
async function POSTHandler(request: NextRequest) {
  try {
    // Require 'stock_adjustments' create permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_ADJUSTMENTS, "create");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId, userId } = context;
    const body = (await request.json()) as StockAdjustmentBody;

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

    if (body.items.some((item) => !item.itemBatchLocationId && !item.batchCode?.trim())) {
      return NextResponse.json(
        { error: "Batch selection or batch code is required for every adjustment item" },
        { status: 400 }
      );
    }

    const warehouseValidation = await validateStockAdjustmentWarehouseId(
      supabase,
      companyId,
      currentBusinessUnitId,
      body.warehouseId
    );

    if (!warehouseValidation.valid) {
      return NextResponse.json(
        { error: warehouseValidation.error || "Invalid warehouse for current business unit" },
        { status: 400 }
      );
    }

    const { data: savedAdjustments, error: saveError } = await supabase.rpc(
      "create_stock_adjustment",
      {
        p_adjustment_date: body.adjustmentDate,
        p_adjustment_type: body.adjustmentType,
        p_business_unit_id: currentBusinessUnitId,
        p_company_id: companyId,
        p_items: body.items as unknown as Json,
        p_location_id: body.locationId || null,
        p_notes: body.notes || null,
        p_reason: body.reason,
        p_user_id: userId,
        p_warehouse_id: body.warehouseId,
      }
    );
    const savedAdjustment = (savedAdjustments as StockAdjustmentSaveResult[] | null)?.[0];

    if (saveError || !savedAdjustment) {
      console.error("Error creating stock adjustment:", saveError);
      return NextResponse.json({ error: "Failed to create stock adjustment" }, { status: 500 });
    }

    // Fetch the complete adjustment with items
    const { data: completeAdjustment } = await supabase
      .from("stock_adjustments")
      .select("*")
      .eq("id", savedAdjustment.adjustment_id)
      .single();

    const { data: completeItems } = await supabase
      .from("stock_adjustment_items")
      .select("*")
      .eq("adjustment_id", savedAdjustment.adjustment_id);

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
          itemBatchLocationId: item.item_batch_location_id,
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
  } catch (error) {
    console.error("Internal server error creating stock adjustment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "stock_adjustments",
  route: "/api/stock-adjustments",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "stock_adjustments",
  route: "/api/stock-adjustments",
});
