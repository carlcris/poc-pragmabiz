import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import type { CreateItemRequest, Item } from "@/types/item";
import type { Database } from "@/types/database.types";
import { insertItemUnitOptionWithRetry } from "@/lib/items/insertItemUnitOption";
import { getUserCapabilities, hasCapability } from "@/services/permissions/permissionResolver";
import {
  getPrimaryItemUnitOption,
  sortItemUnitOptions,
  transformItemUnitOptionRow,
  type DbItemUnitOptionRow,
} from "@/lib/items/itemUnitOptions";

export interface ItemWithStock {
  id: string;
  code: string;
  primaryBarcode?: string;
  name: string;
  chineseName?: string;
  category: string;
  categoryId: string;
  supplier: string;
  supplierId: string | null;
  onHand: number;
  // Aggregated from item_warehouse.reserved_stock across the scoped warehouse set.
  allocated: number;
  // Aggregated from item_warehouse.available_stock across the scoped warehouse set.
  available: number;
  reorderPoint: number;
  maxStockLevel: number;
  inTransit: number;
  estimatedArrivalDate?: string | null;
  status: "normal" | "low_stock" | "out_of_stock" | "overstock" | "discontinued";
  uom: string;
  uomId: string;
  standardCost: number;
  purchasePrice?: number;
  importCost?: number | null;
  importCurrency?: string | null;
  listPrice: number;
  itemType: string;
  customFields?: Record<string, unknown> | null;
  isActive: boolean;
  imageUrl?: string;
}

type ItemStatus = ItemWithStock["status"];

type ItemsRpcRow = {
  id: string;
  item_code: string;
  item_name: string;
  item_name_cn: string | null;
  category_id: string | null;
  category_name: string | null;
  uom_id: string | null;
  uom_code: string | null;
  cost_price: number;
  purchase_price: number;
  import_cost: number | null;
  import_currency: string | null;
  sales_price: number;
  item_type: string;
  custom_fields: Record<string, unknown> | null;
  is_active: boolean | null;
  image_url: string | null;
  on_hand: number;
  allocated: number;
  available: number;
  reorder_point: number;
  max_stock_level: number;
  in_transit: number;
  estimated_arrival_date: string | null;
  status: ItemStatus;
  total_count: number;
};

type ItemsStatsRow = {
  total_available_value: number | string | null;
  low_stock_count: number | string | null;
  out_of_stock_count: number | string | null;
  total_count: number | string | null;
};

type ItemMasterCapabilities = {
  canViewTotalAvailableValue: boolean;
};

type DbItem = {
  id: string;
  company_id: string;
  item_code: string;
  item_name: string;
  item_name_cn: string | null;
  description: string | null;
  dimensions: Item["dimensions"] | null;
  item_type: string;
  uom_id: string;
  cost_price: number | string | null;
  purchase_price: number | string | null;
  import_cost: number | string | null;
  import_currency: string | null;
  sales_price: number | string | null;
  image_url: string | null;
  custom_fields: Record<string, unknown> | null;
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const parsePositiveInt = (raw: string | null, fallback: number) => {
  const parsed = Number.parseInt(raw || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseOptionalBoolean = (raw: string | null): boolean | null => {
  if (raw === null) return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
};

const normalizeDimensions = (value: unknown): Item["dimensions"] | null => {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  const length = toNumber(candidate.length);
  const width = toNumber(candidate.width);
  const height = toNumber(candidate.height);
  const unit =
    typeof candidate.unit === "string" && candidate.unit.trim().length > 0
      ? candidate.unit.trim()
      : undefined;

  if (!length && !width && !height && !unit) {
    return null;
  }

  return {
    ...(length ? { length } : {}),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(unit ? { unit } : {}),
  };
};

const toNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeImportCurrency = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
};

const normalizeImportCost = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const validateImportCostFields = (importCost: number | null, importCurrency: string | null) => {
  if (importCost !== null && importCost < 0) {
    return "Import cost must be 0 or greater";
  }

  if (importCost !== null && !importCurrency) {
    return "Import currency is required when import cost is provided";
  }

  if (importCurrency && !/^[A-Z]{3}$/.test(importCurrency)) {
    return "Import currency must be a 3-letter currency code";
  }

  return null;
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

const normalizeSearchTerm = (value: string | null) => value?.trim().toLowerCase() || "";

const scoreSearchField = (
  fieldValue: string | null | undefined,
  search: string,
  baseScore: number
) => {
  const normalizedField = fieldValue?.trim().toLowerCase() || "";
  if (!normalizedField || !search) return 0;
  if (normalizedField === search) return baseScore + 300;
  if (normalizedField.startsWith(search)) return baseScore + 200;
  if (normalizedField.split(/\s+/).some((part) => part.startsWith(search))) return baseScore + 120;
  if (normalizedField.includes(search)) return baseScore;
  return 0;
};

const scoreItemSearchMatch = (
  search: string,
  item: {
    code: string;
    name: string;
    chineseName?: string;
    description?: string;
  }
) =>
  Math.max(
    scoreSearchField(item.code, search, 500),
    scoreSearchField(item.name, search, 450),
    scoreSearchField(item.chineseName, search, 400),
    scoreSearchField(item.description, search, 300)
  );

const rankItemsBySearch = <
  T extends {
    code: string;
    name: string;
    chineseName?: string;
    description?: string;
  },
>(
  items: T[],
  rawSearch: string | null
) => {
  const normalizedSearch = normalizeSearchTerm(rawSearch);
  if (!normalizedSearch) return items;

  return [...items].sort((left, right) => {
    const scoreDifference =
      scoreItemSearchMatch(normalizedSearch, right) - scoreItemSearchMatch(normalizedSearch, left);
    if (scoreDifference !== 0) return scoreDifference;

    const nameOrder = left.name.localeCompare(right.name);
    if (nameOrder !== 0) return nameOrder;

    return left.code.localeCompare(right.code);
  });
};

const fetchItemUnitOptionsByItemId = async (
  supabase: SupabaseClient<Database>,
  companyId: string,
  itemIds: string[]
) => {
  const emptyMap = new Map<string, DbItemUnitOptionRow[]>();
  if (itemIds.length === 0) return emptyMap;

  const { data, error } = await supabase
    .from("item_unit_options")
    .select(
      `
      id,
      item_id,
      uom_id,
      option_label,
      qty_per_unit,
      barcode,
      is_base,
      is_default,
      is_active,
      sort_order,
      units_of_measure (
        id,
        code,
        name,
        symbol
      )
    `
    )
    .eq("company_id", companyId)
    .in("item_id", itemIds)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data || []) as DbItemUnitOptionRow[];
  const rowsByItemId = new Map<string, DbItemUnitOptionRow[]>();
  for (const row of rows) {
    const existingRows = rowsByItemId.get(row.item_id) || [];
    existingRows.push(row);
    rowsByItemId.set(row.item_id, existingRows);
  }

  return rowsByItemId;
};

const transformDbItem = (dbItem: ItemRow, unitOptionRows: DbItemUnitOptionRow[] = []): Item => {
  const category = Array.isArray(dbItem.item_categories)
    ? dbItem.item_categories[0]
    : dbItem.item_categories;
  const uom = Array.isArray(dbItem.units_of_measure)
    ? dbItem.units_of_measure[0]
    : dbItem.units_of_measure;
  const unitOptions = sortItemUnitOptions(
    unitOptionRows.map((row) => transformItemUnitOptionRow(row, uom?.code || ""))
  );
  const primaryUnitOption = getPrimaryItemUnitOption(unitOptions);

  return {
    id: dbItem.id,
    companyId: dbItem.company_id,
    code: dbItem.item_code,
    primaryBarcode: primaryUnitOption?.barcode,
    primaryBarcodeUnitOptionId: primaryUnitOption?.id,
    unitOptions,
    name: dbItem.item_name,
    chineseName: dbItem.item_name_cn || undefined,
    description: dbItem.description || "",
    dimensions: dbItem.dimensions || null,
    itemType: dbItem.item_type as Item["itemType"],
    customFields: dbItem.custom_fields || null,
    uom: uom?.code || "",
    uomId: dbItem.uom_id,
    category: category?.name || "",
    standardCost: Number(dbItem.cost_price) || 0,
    purchasePrice: Number(dbItem.purchase_price) || 0,
    importCost: dbItem.import_cost == null ? null : Number(dbItem.import_cost),
    importCurrency: dbItem.import_currency,
    listPrice: Number(dbItem.sales_price) || 0,
    reorderLevel: 0,
    reorderQty: 0,
    maxStockLevel: 0,
    imageUrl: dbItem.image_url || undefined,
    isActive: dbItem.is_active ?? true,
    createdAt: dbItem.created_at,
    updatedAt: dbItem.updated_at,
  };
};

export async function GET(request: NextRequest) {
  try {
    // const unauthorized = await requireLookupDataAccess(RESOURCES.ITEMS);
    // if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId, userId } = context;

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() || null;
    const rawCategory = searchParams.get("category");
    const rawWarehouseId = searchParams.get("warehouseId");
    const stockStatus = asStatus(searchParams.get("status"));
    const itemType = searchParams.get("itemType")?.trim() || null;
    const isActive = parseOptionalBoolean(searchParams.get("isActive"));
    const includeStock = searchParams.get("includeStock") !== "false";
    const includeStats = searchParams.get("includeStats") === "true";
    const statsOnly = searchParams.get("statsOnly") === "true";
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(
      parsePositiveInt(searchParams.get("limit"), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const capabilities = await getUserCapabilities(userId, currentBusinessUnitId);
    const itemMasterCapabilities: ItemMasterCapabilities = {
      canViewTotalAvailableValue: hasCapability(
        capabilities,
        GRANULAR_CAPABILITIES.ITEM_MASTER_TOTAL_AVAILABLE_VALUE
      ),
    };

    if (!includeStock) {
      let query = supabase
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
        `,
          { count: "exact" }
        )
        .eq("company_id", companyId)
        .is("deleted_at", null);

      if (search) {
        query = query.or(
          `item_code.ilike.%${search}%,item_name.ilike.%${search}%,item_name_cn.ilike.%${search}%,description.ilike.%${search}%`
        );
      }

      if (rawCategory) {
        if (isUuid(rawCategory)) {
          query = query.eq("category_id", rawCategory);
        } else {
          query = query.eq("item_categories.name", rawCategory);
        }
      }

      if (itemType) {
        query = query.eq("item_type", itemType);
      }

      if (isActive !== null) {
        query = query.eq("is_active", isActive);
      }

      const candidateLimit = search && page === 1 ? Math.max(limit, 100) : limit;
      const from = (page - 1) * candidateLimit;
      const to = from + candidateLimit - 1;
      query = query.range(from, to).order("item_name", { ascending: true });

      const { data, error, count } = await query;

      if (error) {
        return NextResponse.json(
          { error: "Failed to fetch items", details: error.message },
          { status: 500 }
        );
      }

      const fetchedItems = (data || []) as ItemRow[];
      const unitOptionRowsByItemId = await fetchItemUnitOptionsByItemId(
        supabase,
        companyId,
        fetchedItems.map((item) => item.id)
      );
      const items = fetchedItems.map((item) =>
        transformDbItem(item, unitOptionRowsByItemId.get(item.id) || [])
      );
      const rankedItems = search && page === 1 ? rankItemsBySearch(items, search) : items;
      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return NextResponse.json({
        data: search && page === 1 ? rankedItems.slice(0, limit) : rankedItems,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    }

    if (rawCategory && !isUuid(rawCategory)) {
      return NextResponse.json({ error: "Invalid category filter" }, { status: 400 });
    }

    if (rawWarehouseId && !isUuid(rawWarehouseId)) {
      return NextResponse.json({ error: "Invalid warehouse filter" }, { status: 400 });
    }

    // "All Warehouses" aggregates across the current business unit. A specific
    // warehouse still remains scoped by the same business unit context.
    const effectiveBusinessUnitId: string | null = currentBusinessUnitId;

    const statsRpcPayload = {
      p_company_id: companyId,
      p_search: search,
      p_category_id: rawCategory,
      p_warehouse_id: rawWarehouseId,
      p_item_type: itemType,
      p_status: stockStatus,
      p_business_unit_id: effectiveBusinessUnitId,
    };

    if (statsOnly) {
      const { data: statsRows, error: statsError } = await supabase.rpc(
        "get_items_enhanced_stats",
        statsRpcPayload
      );

      if (statsError) {
        return NextResponse.json(
          { error: "Failed to fetch item statistics", details: statsError.message },
          { status: 500 }
        );
      }

      const statsRow = ((statsRows || [])[0] || null) as ItemsStatsRow | null;

      return NextResponse.json({
        statistics: {
          totalAvailableValue: itemMasterCapabilities.canViewTotalAvailableValue
            ? toNumber(statsRow?.total_available_value)
            : null,
          lowStockCount: toNumber(statsRow?.low_stock_count),
          outOfStockCount: toNumber(statsRow?.out_of_stock_count),
          totalCount: toNumber(statsRow?.total_count),
        },
        capabilities: itemMasterCapabilities,
      });
    }

    const candidateLimit = search && page === 1 ? Math.max(limit, 100) : limit;

    const rpcPayload = {
      ...statsRpcPayload,
      p_page: page,
      p_limit: candidateLimit,
    };

    const statsRpcPromise = includeStats
      ? supabase.rpc("get_items_enhanced_stats", statsRpcPayload)
      : null;

    const { data: rpcRows, error: rpcError } = await supabase.rpc(
      "get_items_enhanced_page",
      rpcPayload
    );

    if (rpcError) {
      return NextResponse.json(
        { error: "Failed to fetch items", details: rpcError.message },
        { status: 500 }
      );
    }

    const rows = (rpcRows || []) as ItemsRpcRow[];
    const unitOptionRowsByItemId = await fetchItemUnitOptionsByItemId(
      supabase,
      companyId,
      rows.map((row) => row.id)
    );
    const itemsWithStock: ItemWithStock[] = rows.map((row) => ({
      id: row.id,
      code: row.item_code,
      primaryBarcode: getPrimaryItemUnitOption(
        sortItemUnitOptions(
          (unitOptionRowsByItemId.get(row.id) || []).map((unitOptionRow) =>
            transformItemUnitOptionRow(unitOptionRow, row.uom_code || "")
          )
        )
      )?.barcode,
      name: row.item_name,
      chineseName: row.item_name_cn || undefined,
      category: row.category_name || "",
      categoryId: row.category_id || "",
      supplier: "",
      supplierId: null,
      onHand: row.on_hand,
      allocated: row.allocated,
      available: row.available,
      reorderPoint: row.reorder_point,
      maxStockLevel: row.max_stock_level,
      inTransit: row.in_transit,
      estimatedArrivalDate: row.estimated_arrival_date,
      status: row.status,
      uom: row.uom_code || "",
      uomId: row.uom_id || "",
      standardCost: row.cost_price,
      purchasePrice: row.purchase_price,
      importCost: row.import_cost == null ? null : Number(row.import_cost),
      importCurrency: row.import_currency,
      listPrice: row.sales_price,
      itemType: row.item_type,
      customFields: row.custom_fields || null,
      isActive: row.is_active ?? true,
      imageUrl: row.image_url || undefined,
    }));
    const rankedItemsWithStock =
      search && page === 1 ? rankItemsBySearch(itemsWithStock, search) : itemsWithStock;

    const total = rows.length > 0 ? toNumber(rows[0].total_count) : 0;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    if (!includeStats) {
      return NextResponse.json({
        data: search && page === 1 ? rankedItemsWithStock.slice(0, limit) : rankedItemsWithStock,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    }

    const { data: statsRows, error: statsError } = await statsRpcPromise!;

    if (statsError) {
      return NextResponse.json(
        { error: "Failed to fetch item statistics", details: statsError.message },
        { status: 500 }
      );
    }

    const statsRow = ((statsRows || [])[0] || null) as ItemsStatsRow | null;

    return NextResponse.json({
      data: search && page === 1 ? rankedItemsWithStock.slice(0, limit) : rankedItemsWithStock,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      statistics: {
        totalAvailableValue: itemMasterCapabilities.canViewTotalAvailableValue
          ? toNumber(statsRow?.total_available_value)
          : null,
        lowStockCount: toNumber(statsRow?.low_stock_count),
        outOfStockCount: toNumber(statsRow?.out_of_stock_count),
        totalCount: toNumber(statsRow?.total_count),
      },
      capabilities: itemMasterCapabilities,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "create");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, userId } = context;

    const body: CreateItemRequest = await request.json();
    const importCost = normalizeImportCost(body.importCost);
    const importCurrency = normalizeImportCurrency(body.importCurrency);
    const importValidationError = validateImportCostFields(importCost, importCurrency);

    if (importValidationError) {
      return NextResponse.json({ error: importValidationError }, { status: 400 });
    }

    if (!body.code || !body.name || !body.itemType || !body.uom) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          details: "code, name, itemType, and uom are required",
        },
        { status: 400 }
      );
    }

    const { data: existingCode } = await supabase
      .from("items")
      .select("id")
      .eq("company_id", companyId)
      .eq("item_code", body.code)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingCode) {
      return NextResponse.json(
        {
          error: "Item code already exists",
          details: `Item code "${body.code}" is already in use`,
        },
        { status: 409 }
      );
    }

    const { data: uomData } = await supabase
      .from("units_of_measure")
      .select("id")
      .eq("company_id", companyId)
      .eq("code", body.uom)
      .is("deleted_at", null)
      .maybeSingle();

    if (!uomData) {
      return NextResponse.json(
        { error: "Invalid unit of measure", details: `UoM "${body.uom}" not found` },
        { status: 400 }
      );
    }

    let categoryId: string | null = null;
    if (body.category) {
      const { data: categoryData } = await supabase
        .from("item_categories")
        .select("id")
        .eq("company_id", companyId)
        .eq("name", body.category)
        .is("deleted_at", null)
        .maybeSingle();

      if (!categoryData) {
        return NextResponse.json(
          { error: "Invalid category", details: `Category "${body.category}" not found` },
          { status: 400 }
        );
      }
      categoryId = categoryData.id;
    }

    const insertPayloadBase = {
      company_id: companyId,
      item_code: body.code,
      item_name: body.name,
      item_name_cn: body.chineseName || null,
      description: body.description || null,
      dimensions: normalizeDimensions(body.dimensions),
      item_type: body.itemType,
      uom_id: uomData.id,
      category_id: categoryId,
      cost_price: body.standardCost?.toString(),
      sales_price: body.listPrice?.toString(),
      purchase_price: body.standardCost?.toString(),
      import_cost: importCost,
      import_currency: importCost === null ? null : importCurrency,
      image_url: body.imageUrl || null,
      is_stock_item: body.itemType !== "service",
      is_active: body.isActive ?? true,
      created_by: userId,
      updated_by: userId,
    };

    let newItem: ItemRow | null = null;
    let insertError: { message: string; code?: string } | null = null;
    const { data, error } = await supabase
      .from("items")
      .insert(insertPayloadBase)
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

    newItem = data as ItemRow | null;
    insertError = error;

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create item", details: insertError.message },
        { status: 500 }
      );
    }

    const { error: unitOptionInsertError } = await insertItemUnitOptionWithRetry({
      supabase,
      payload: {
        company_id: companyId,
        item_id: (newItem as ItemRow).id,
        uom_id: uomData.id,
        qty_per_unit: 1,
        is_base: true,
        is_default: true,
        is_active: true,
        sort_order: 0,
        created_by: userId,
        updated_by: userId,
      },
    });

    if (unitOptionInsertError) {
      await supabase
        .from("items")
        .delete()
        .eq("id", (newItem as ItemRow).id)
        .eq("company_id", companyId);
      return NextResponse.json(
        { error: "Failed to create item base barcode", details: unitOptionInsertError.message },
        { status: 500 }
      );
    }

    const unitOptionRowsByItemId = await fetchItemUnitOptionsByItemId(supabase, companyId, [
      (newItem as ItemRow).id,
    ]);

    return NextResponse.json(
      {
        data: transformDbItem(
          newItem as ItemRow,
          unitOptionRowsByItemId.get((newItem as ItemRow).id) || []
        ),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
