import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requireLookupDataAccess, requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { CreateItemRequest, Item } from "@/types/item";
import QRCode from "qrcode";

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

type ItemsRpcRow = {
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

type ItemsStatsRow = {
  total_available_value: number | string | null;
  low_stock_count: number | string | null;
  out_of_stock_count: number | string | null;
  total_count: number | string | null;
};

type DbItem = {
  id: string;
  company_id: string;
  item_code: string;
  sku: string | null;
  sku_qr_image: string | null;
  item_name: string;
  item_name_cn: string | null;
  description: string | null;
  item_type: string;
  uom_id: string;
  cost_price: number | string | null;
  purchase_price: number | string | null;
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SKU_REGEX = /^[0-9]{8}$/;
const MAX_SKU_GENERATION_ATTEMPTS = 25;
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

const generateSkuCandidate = () => Math.floor(Math.random() * 100000000).toString().padStart(8, "0");

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

const transformDbItem = (dbItem: ItemRow): Item => {
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
    sku: dbItem.sku || undefined,
    skuQrImage: dbItem.sku_qr_image || undefined,
    name: dbItem.item_name,
    chineseName: dbItem.item_name_cn || undefined,
    description: dbItem.description || "",
    itemType: dbItem.item_type as Item["itemType"],
    uom: uom?.code || "",
    uomId: dbItem.uom_id,
    category: category?.name || "",
    standardCost: Number(dbItem.cost_price) || 0,
    purchasePrice: Number(dbItem.purchase_price) || 0,
    listPrice: Number(dbItem.sales_price) || 0,
    reorderLevel: 0,
    reorderQty: 0,
    imageUrl: dbItem.image_url || undefined,
    isActive: dbItem.is_active ?? true,
    createdAt: dbItem.created_at,
    updatedAt: dbItem.updated_at,
  };
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
    const isActive = parseOptionalBoolean(searchParams.get("isActive"));
    const includeStock = searchParams.get("includeStock") !== "false";
    const includeStats = searchParams.get("includeStats") === "true";
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

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
        .eq("company_id", userData.company_id)
        .is("deleted_at", null);

      if (search) {
        query = query.or(
          `item_code.ilike.%${search}%,sku.ilike.%${search}%,item_name.ilike.%${search}%,item_name_cn.ilike.%${search}%,description.ilike.%${search}%`
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

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to).order("item_name", { ascending: true });

      const { data, error, count } = await query;

      if (error) {
        return NextResponse.json(
          { error: "Failed to fetch items", details: error.message },
          { status: 500 }
        );
      }

      const items = (data || []).map((item) => transformDbItem(item as ItemRow));
      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return NextResponse.json({
        data: items,
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

    const rows = (rpcRows || []) as ItemsRpcRow[];
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

    const statsRow = ((statsRows || [])[0] || null) as ItemsStatsRow | null;

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

export async function POST(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "create");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CreateItemRequest = await request.json();

    if (!body.code || !body.name || !body.itemType || !body.uom) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          details: "code, name, itemType, and uom are required",
        },
        { status: 400 }
      );
    }

    if (!body.companyId) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          details: "companyId is required",
        },
        { status: 400 }
      );
    }

    const { data: existingCode } = await supabase
      .from("items")
      .select("id")
      .eq("company_id", body.companyId)
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

    if (body.sku && !SKU_REGEX.test(body.sku)) {
      return NextResponse.json(
        {
          error: "Invalid SKU format",
          details: "SKU must be an 8-digit numeric value",
        },
        { status: 400 }
      );
    }

    const resolveUniqueSku = async (): Promise<string | null> => {
      if (body.sku) {
        const { data: existingSku } = await supabase
          .from("items")
          .select("id")
          .eq("company_id", body.companyId)
          .eq("sku", body.sku)
          .is("deleted_at", null)
          .maybeSingle();

        if (existingSku) throw new Error(`duplicate:${body.sku}`);
        return body.sku;
      }

      for (let attempt = 0; attempt < MAX_SKU_GENERATION_ATTEMPTS; attempt++) {
        const candidate = generateSkuCandidate();
        const { data: existingSku } = await supabase
          .from("items")
          .select("id")
          .eq("company_id", body.companyId)
          .eq("sku", candidate)
          .is("deleted_at", null)
          .maybeSingle();

        if (!existingSku) return candidate;
      }

      return null;
    };

    let resolvedSku: string | null;
    try {
      resolvedSku = await resolveUniqueSku();
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("duplicate:")) {
        const duplicateValue = error.message.replace("duplicate:", "");
        return NextResponse.json(
          {
            error: "SKU already exists",
            details: `SKU "${duplicateValue}" is already in use`,
          },
          { status: 409 }
        );
      }
      throw error;
    }

    if (!resolvedSku) {
      return NextResponse.json(
        {
          error: "Failed to generate SKU",
          details: "Unable to generate a unique SKU. Please try again.",
        },
        { status: 500 }
      );
    }

    const resolvedSkuQrImage = await generateSkuQrDataUrl(resolvedSku);

    const { data: uomData } = await supabase
      .from("units_of_measure")
      .select("id")
      .eq("company_id", body.companyId)
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
        .eq("company_id", body.companyId)
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
      company_id: body.companyId,
      item_code: body.code,
      item_name: body.name,
      item_name_cn: body.chineseName || null,
      description: body.description || null,
      item_type: body.itemType,
      uom_id: uomData.id,
      category_id: categoryId,
      cost_price: body.standardCost?.toString(),
      sales_price: body.listPrice?.toString(),
      purchase_price: body.standardCost?.toString(),
      image_url: body.imageUrl || null,
      is_stock_item: body.itemType !== "service",
      is_active: body.isActive ?? true,
      created_by: user.id,
      updated_by: user.id,
    };

    let newItem: ItemRow | null = null;
    let insertError: { message: string; code?: string } | null = null;
    let skuForInsert = resolvedSku;
    let skuQrImageForInsert = resolvedSkuQrImage;
    const maxInsertAttempts = body.sku ? 1 : MAX_SKU_GENERATION_ATTEMPTS;

    for (let attempt = 0; attempt < maxInsertAttempts; attempt++) {
      const { data, error } = await supabase
        .from("items")
        .insert({
          ...insertPayloadBase,
          sku: skuForInsert,
          sku_qr_image: skuQrImageForInsert,
        })
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

      if (!error) {
        newItem = data as ItemRow;
        insertError = null;
        break;
      }

      insertError = error;
      const isSkuConflict =
        error.code === "23505" && error.message.includes("idx_items_company_sku_unique");
      if (!isSkuConflict || body.sku) break;

      skuForInsert = generateSkuCandidate();
      skuQrImageForInsert = await generateSkuQrDataUrl(skuForInsert);
    }

    if (insertError) {
      const isSkuConflict =
        insertError.code === "23505" &&
        insertError.message.includes("idx_items_company_sku_unique");
      if (isSkuConflict) {
        return NextResponse.json(
          {
            error: "SKU already exists",
            details: "Generated SKU collided. Please retry.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create item", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: transformDbItem(newItem as ItemRow) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
