import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import type { Item, CreateItemRequest } from "@/types/item";
import { requirePermission, requireLookupDataAccess } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import QRCode from "qrcode";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const SKU_REGEX = /^[0-9]{8}$/;
const MAX_SKU_GENERATION_ATTEMPTS = 25;

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
    sku: dbItem.sku || undefined,
    skuQrImage: dbItem.sku_qr_image || undefined,
    name: dbItem.item_name,
    chineseName: dbItem.item_name_cn || undefined,
    description: dbItem.description || "",
    itemType: dbItem.item_type as Item["itemType"],
    uom: uom?.code || "",
    uomId: dbItem.uom_id, // Added uomId field
    category: category?.name || "",
    standardCost: Number(dbItem.cost_price) || 0,
    purchasePrice: Number(dbItem.purchase_price) || 0,
    listPrice: Number(dbItem.sales_price) || 0,
    reorderLevel: 0, // Will come from item_warehouse table
    reorderQty: 0, // Will come from item_warehouse table
    imageUrl: dbItem.image_url || undefined,
    isActive: dbItem.is_active ?? true,
    createdAt: dbItem.created_at,
    updatedAt: dbItem.updated_at,
  };
}

// GET /api/items - List items with filters
export async function GET(request: NextRequest) {
  try {
    // Check permission using Lookup Data Access Pattern
    // User can access if they have EITHER:
    // 1. Direct 'items' view permission, OR
    // 2. Permission to a feature that depends on items (pos, sales_orders, etc.)
    const unauthorized = await requireLookupDataAccess(RESOURCES.ITEMS);
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

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const itemType = searchParams.get("itemType");
    const isActive = searchParams.get("isActive");
    const parsedPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const parsedLimit = Number.parseInt(searchParams.get("limit") || `${DEFAULT_PAGE_SIZE}`, 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE;

    // Build query
    let query = supabase
      .from("items")
      .select(
        `
        id,
        company_id,
        item_code,
        sku,
        sku_qr_image,
        item_name,
        item_name_cn,
        description,
        item_type,
        uom_id,
        cost_price,
        purchase_price,
        sales_price,
        image_url,
        is_active,
        created_at,
        updated_at,
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

    // Apply filters
    if (search) {
      query = query.or(
        `item_code.ilike.%${search}%,sku.ilike.%${search}%,item_name.ilike.%${search}%,item_name_cn.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    if (category) {
      query = query.eq("item_categories.name", category);
    }

    if (itemType) {
      query = query.eq("item_type", itemType);
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq("is_active", isActive === "true");
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    // Order by item_name ascending
    query = query.order("item_name", { ascending: true });

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch items", details: error.message },
        { status: 500 }
      );
    }

    // Transform data
    const items = (data || []).map((item) => transformDbItem(item as ItemRow));

    // Calculate pagination
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
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/items - Create new item
export async function POST(request: NextRequest) {
  try {
    // Check permission
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "create");
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

    // Parse request body
    const body: CreateItemRequest = await request.json();

    // Validate required fields
    if (!body.code || !body.name || !body.itemType || !body.uom) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          details: "code, name, itemType, and uom are required",
        },
        { status: 400 }
      );
    }

    // Check for duplicate item code
    const { data: existing } = await supabase
      .from("items")
      .select("id")
      .eq("company_id", body.companyId)
      .eq("item_code", body.code)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error: "Item code already exists",
          details: `Item code "${body.code}" is already in use`,
        },
        { status: 409 }
      );
    }

    // Validate provided SKU format (if user supplied it)
    if (body.sku && !SKU_REGEX.test(body.sku)) {
      return NextResponse.json(
        {
          error: "Invalid SKU format",
          details: "SKU must be an 8-digit numeric value",
        },
        { status: 400 }
      );
    }

    const generateSkuCandidate = () => Math.floor(Math.random() * 100000000).toString().padStart(8, "0");

    const resolveUniqueSku = async (): Promise<string | null> => {
      if (body.sku) {
        const { data: existingSku } = await supabase
          .from("items")
          .select("id")
          .eq("company_id", body.companyId)
          .eq("sku", body.sku)
          .is("deleted_at", null)
          .maybeSingle();

        if (existingSku) {
          throw new Error(`duplicate:${body.sku}`);
        }
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

        if (!existingSku) {
          return candidate;
        }
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

    // Get UoM ID by code
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

    // Get Category ID by name (if provided)
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

    // Insert item; retry only if generated SKU collides during concurrent writes.
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
      if (!isSkuConflict || body.sku) {
        break;
      }

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

    // Transform and return
    const item = transformDbItem(newItem as ItemRow);

    return NextResponse.json({ data: item }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
