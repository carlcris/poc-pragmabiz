import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item, ItemDetail, UpdateItemRequest, ItemPriceTier } from "@/types/item";
import type { Database } from "@/types/database.types";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { insertItemUnitOptionWithRetry } from "@/lib/items/insertItemUnitOption";
import { getUserCapabilities, hasCapability } from "@/services/permissions/permissionResolver";
import {
  getPrimaryItemUnitOption,
  sortItemUnitOptions,
  transformItemUnitOptionRow,
  type DbItemUnitOptionRow,
} from "@/lib/items/itemUnitOptions";
import { DEFAULT_PRICE_TIER_CODE } from "@/lib/pricing/itemPriceTiers";

type DbItem = {
  id: string;
  company_id: string;
  item_code: string;
  supplier_code: string | null;
  sop: number | string | null;
  reorder_level: number | string | null;
  reorder_quantity: number | string | null;
  item_name: string;
  item_name_cn: string | null;
  description: string | null;
  dimensions: Item["dimensions"] | null;
  category_id: string | null;
  item_type: string;
  uom_id: string;
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
type DbItemPriceRow = {
  id: string;
  item_id: string;
  price_tier: string;
  price_tier_name: string;
  price: number | string;
  currency_code: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean | null;
};
type ItemWarehouseRow = {
  current_stock: number | string | null;
  reserved_stock: number | string | null;
  available_stock: number | string | null;
  in_transit: number | string | null;
  estimated_arrival_date: string | null;
  max_quantity: number | string | null;
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

const normalizeDimensions = (value: unknown): Item["dimensions"] | null => {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  const toNumber = (input: unknown) => {
    const parsed = typeof input === "number" ? input : Number(input);
    return Number.isFinite(parsed) ? parsed : 0;
  };

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
type ItemRow = DbItem & {
  item_category: DbItemCategory | null;
  unit_of_measure: DbUoM | null;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: string): boolean => UUID_REGEX.test(value);

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

const normalizeSop = (value: unknown): number | null | undefined => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeSettingString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim().toLowerCase() : null;

const getDefaultPricingTier = async (
  supabase: SupabaseClient<Database>,
  companyId: string
): Promise<string> => {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("company_id", companyId)
    .is("business_unit_id", null)
    .eq("group_key", "inventory")
    .eq("setting_key", "default_pricing_tier")
    .maybeSingle();

  if (error) {
    console.error("Error loading default pricing tier:", error);
    return DEFAULT_PRICE_TIER_CODE;
  }

  return normalizeSettingString(data?.value) || DEFAULT_PRICE_TIER_CODE;
};

const transformItemPriceRow = (row: DbItemPriceRow): ItemPriceTier => ({
  id: row.id,
  priceTier: row.price_tier,
  priceTierName: row.price_tier_name,
  price: toNumber(row.price),
  currencyCode: row.currency_code || "PHP",
  effectiveFrom: row.effective_from,
  effectiveTo: row.effective_to,
  isActive: row.is_active ?? true,
});

const fetchCurrentPriceTiers = async (
  supabase: SupabaseClient<Database>,
  companyId: string,
  itemId: string
): Promise<ItemPriceTier[]> => {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("item_prices")
    .select(
      "id, item_id, price_tier, price_tier_name, price, currency_code, effective_from, effective_to, is_active"
    )
    .eq("company_id", companyId)
    .eq("item_id", itemId)
    .eq("is_active", true)
    .lte("effective_from", today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .is("deleted_at", null)
    .order("price_tier", { ascending: true })
    .order("effective_from", { ascending: false });

  if (error) {
    console.error("Error loading item price tiers:", error);
    return [];
  }

  const priceTiers: ItemPriceTier[] = [];
  for (const row of ((data || []) as DbItemPriceRow[])) {
    if (!priceTiers.some((priceTier) => priceTier.priceTier === row.price_tier)) {
      priceTiers.push(transformItemPriceRow(row));
    }
  }

  return priceTiers;
};

const resolveDefaultListPrice = (
  fallbackListPrice: number,
  priceTiers: ItemPriceTier[],
  defaultPricingTier: string
) => {
  const matchingTier = priceTiers.find((priceTier) => priceTier.priceTier === defaultPricingTier);
  return matchingTier?.price ?? fallbackListPrice;
};

const normalizeOptionalText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
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

const fetchItemUnitOptions = async (
  supabase: SupabaseClient<Database>,
  companyId: string,
  itemId: string
) => {
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
    .eq("item_id", itemId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as DbItemUnitOptionRow[];
};

// Transform database item to frontend Item type
function transformDbItem(
  dbItem: ItemRow,
  unitOptionRows: DbItemUnitOptionRow[] = [],
  priceTiers: ItemPriceTier[] = [],
  defaultPricingTier: string = DEFAULT_PRICE_TIER_CODE,
  canViewSop = false
): Item {
  const unitOptions = sortItemUnitOptions(
    unitOptionRows.map((row) => transformItemUnitOptionRow(row, dbItem.unit_of_measure?.code || ""))
  );
  const primaryUnitOption = getPrimaryItemUnitOption(unitOptions);

  return {
    id: dbItem.id,
    companyId: dbItem.company_id,
    code: dbItem.item_code,
    supplierCode: dbItem.supplier_code,
    sop: canViewSop && dbItem.sop != null ? Number(dbItem.sop) : null,
    primaryBarcode: primaryUnitOption?.barcode,
    primaryBarcodeUnitOptionId: primaryUnitOption?.id,
    unitOptions,
    name: dbItem.item_name,
    chineseName: dbItem.item_name_cn || undefined,
    description: dbItem.description || "",
    dimensions: dbItem.dimensions || null,
    itemType: dbItem.item_type as Item["itemType"],
    customFields: dbItem.custom_fields || null,
    uom: dbItem.unit_of_measure?.code || "",
    uomId: dbItem.uom_id,
    category: dbItem.item_category?.name || "",
    purchasePrice: Number(dbItem.purchase_price) || 0,
    importCost: dbItem.import_cost == null ? null : Number(dbItem.import_cost),
    importCurrency: dbItem.import_currency,
    listPrice: resolveDefaultListPrice(Number(dbItem.sales_price) || 0, priceTiers, defaultPricingTier),
    defaultPriceTier: defaultPricingTier,
    priceTiers,
    reorderLevel: Number(dbItem.reorder_level) || 0,
    reorderQty: Number(dbItem.reorder_quantity) || 0,
    maxStockLevel: 0,
    imageUrl: dbItem.image_url || undefined,
    isActive: dbItem.is_active ?? true,
    createdAt: dbItem.created_at,
    updatedAt: dbItem.updated_at,
  };
}

const maskItemPricingDetails = (item: Item, canViewPricingDetails: boolean): ItemDetail => {
  if (canViewPricingDetails) {
    return {
      ...item,
      importCost: item.importCost ?? null,
      importCurrency: item.importCurrency ?? null,
    };
  }

  return {
    ...item,
    purchasePrice: null,
    importCost: null,
    importCurrency: null,
    listPrice: null,
  };
};

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
    const capabilities = await getUserCapabilities(user.id, currentBusinessUnitId);
    const canViewPricingDetails = hasCapability(
      capabilities,
      GRANULAR_CAPABILITIES.ITEM_DETAILS_PRICING_DETAILS
    );
    const canViewSop = hasCapability(capabilities, GRANULAR_CAPABILITIES.ITEM_SOP_VIEW);
    const canEditSop = hasCapability(capabilities, GRANULAR_CAPABILITIES.ITEM_SOP_EDIT, "edit");

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    }

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
    const data = fetchedItem;
    const unitOptionRows = await fetchItemUnitOptions(supabase, data.company_id, id);
    const defaultPricingTier = await getDefaultPricingTier(supabase, data.company_id);
    const priceTiers = await fetchCurrentPriceTiers(supabase, data.company_id, id);

    let onHand = 0;
    let allocated = 0;
    let available = 0;
    const reorderLevel = Number(data.reorder_level) || 0;
    const reorderQty = Number(data.reorder_quantity) || 0;
    let maxStockLevel = 0;
    let inTransit = 0;
    let estimatedArrivalDate: string | null = null;

    let inventoryQuery = supabase
      .from("item_warehouse")
      .select(
        "current_stock, reserved_stock, available_stock, in_transit, estimated_arrival_date, max_quantity, warehouses!inner(business_unit_id)"
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
        maxStockLevel += Number(row.max_quantity || 0);
        if (row.estimated_arrival_date) {
          if (!estimatedArrivalDate || row.estimated_arrival_date < estimatedArrivalDate) {
            estimatedArrivalDate = row.estimated_arrival_date;
          }
        }
      }
    }

    // Transform and return
    const item = maskItemPricingDetails(
      {
        ...transformDbItem(
          data as ItemRow,
          unitOptionRows,
          priceTiers,
          defaultPricingTier,
          canViewSop
        ),
        onHand,
        allocated,
        available,
        inTransit,
        estimatedArrivalDate,
        reorderLevel,
        reorderQty,
        maxStockLevel,
      },
      canViewPricingDetails
    );
    return NextResponse.json({
      data: item,
      capabilities: {
        canViewPricingDetails,
        canViewSop,
        canEditSop,
      },
    });
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
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    }

    const body: UpdateItemRequest = await request.json();
    const hasSopSubmission = Object.prototype.hasOwnProperty.call(body, "sop");
    const nextSop = normalizeSop(body.sop);
    if (hasSopSubmission && (nextSop === undefined || (nextSop !== null && nextSop < 0))) {
      return NextResponse.json({ error: "SOP must be 0 or greater" }, { status: 400 });
    }
    if (
      (body.reorderLevel !== undefined && body.reorderLevel < 0) ||
      (body.reorderQty !== undefined && body.reorderQty < 0)
    ) {
      return NextResponse.json(
        { error: "Reorder level and reorder quantity must be 0 or greater" },
        { status: 400 }
      );
    }
    if (hasSopSubmission) {
      const capabilities = await getUserCapabilities(user.id, currentBusinessUnitId);
      const canEditSop = hasCapability(capabilities, GRANULAR_CAPABILITIES.ITEM_SOP_EDIT, "edit");
      if (!canEditSop) {
        return NextResponse.json(
          { error: "You do not have permission to edit SOP" },
          { status: 403 }
        );
      }
    }
    const nextImportCost =
      body.importCost !== undefined ? normalizeImportCost(body.importCost) : undefined;
    const nextImportCurrency =
      body.importCurrency !== undefined ? normalizeImportCurrency(body.importCurrency) : undefined;

    if (nextImportCost !== undefined || nextImportCurrency !== undefined) {
      const { data: currentImportFields, error: importFieldsError } = await supabase
        .from("items")
        .select("import_cost, import_currency")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();

      if (importFieldsError) {
        return NextResponse.json(
          { error: "Failed to check item import cost", details: importFieldsError.message },
          { status: 500 }
        );
      }

      const effectiveImportCost =
        nextImportCost !== undefined
          ? nextImportCost
          : normalizeImportCost(currentImportFields?.import_cost);
      const effectiveImportCurrency =
        nextImportCurrency !== undefined
          ? nextImportCurrency
          : normalizeImportCurrency(currentImportFields?.import_currency);
      const importValidationError = validateImportCostFields(
        effectiveImportCost,
        effectiveImportCurrency
      );

      if (importValidationError) {
        return NextResponse.json({ error: importValidationError }, { status: 400 });
      }
    }

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
    if (body.supplierCode !== undefined) {
      updateData.supplier_code = normalizeOptionalText(body.supplierCode);
    }
    if (hasSopSubmission) {
      updateData.sop = nextSop ?? null;
    }
    if (body.chineseName !== undefined) updateData.item_name_cn = body.chineseName;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.itemType !== undefined) updateData.item_type = body.itemType;
    if (body.purchasePrice !== undefined) {
      updateData.purchase_price = body.purchasePrice.toString();
    }
    if (body.listPrice !== undefined) updateData.sales_price = body.listPrice.toString();
    if (nextImportCost !== undefined) {
      updateData.import_cost = nextImportCost;
      if (nextImportCost === null) {
        updateData.import_currency = null;
      }
    }
    if (nextImportCurrency !== undefined) {
      updateData.import_currency = nextImportCost === null ? null : nextImportCurrency;
    }
    if (body.dimensions !== undefined) updateData.dimensions = normalizeDimensions(body.dimensions);
    if (body.imageUrl !== undefined) updateData.image_url = body.imageUrl;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;
    if (body.reorderLevel !== undefined) updateData.reorder_level = body.reorderLevel;
    if (body.reorderQty !== undefined) updateData.reorder_quantity = body.reorderQty;

    // Get UoM ID if provided
    let resolvedUomId: string | null = null;
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
      resolvedUomId = uomData.id;
      updateData.uom_id = resolvedUomId;
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
      .select(ITEM_DETAIL_SELECT)
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update item", details: updateError.message },
        { status: 500 }
      );
    }

    if (resolvedUomId) {
      const { data: existingBaseUnitOption, error: baseUnitOptionError } = await supabase
        .from("item_unit_options")
        .select("id")
        .eq("company_id", existing.company_id)
        .eq("item_id", id)
        .eq("is_base", true)
        .is("deleted_at", null)
        .maybeSingle();

      if (baseUnitOptionError) {
        return NextResponse.json(
          { error: "Failed to load item base barcode", details: baseUnitOptionError.message },
          { status: 500 }
        );
      }

      if (existingBaseUnitOption) {
        const { error: baseUpdateError } = await supabase
          .from("item_unit_options")
          .update({
            uom_id: resolvedUomId,
            updated_by: user.id,
          })
          .eq("id", existingBaseUnitOption.id)
          .eq("company_id", existing.company_id);

        if (baseUpdateError) {
          return NextResponse.json(
            { error: "Failed to update item base barcode", details: baseUpdateError.message },
            { status: 500 }
          );
        }
      } else {
        const { error: baseInsertError } = await insertItemUnitOptionWithRetry({
          supabase,
          payload: {
            company_id: existing.company_id,
            item_id: id,
            uom_id: resolvedUomId,
            qty_per_unit: 1,
            is_base: true,
            is_default: true,
            is_active: true,
            sort_order: 0,
            created_by: user.id,
            updated_by: user.id,
          },
        });

        if (baseInsertError) {
          return NextResponse.json(
            { error: "Failed to create item base barcode", details: baseInsertError.message },
            { status: 500 }
          );
        }
      }
    }

    // Transform and return
    const unitOptionRows = await fetchItemUnitOptions(supabase, existing.company_id, id);
    const defaultPricingTier = await getDefaultPricingTier(supabase, existing.company_id);
    const priceTiers = await fetchCurrentPriceTiers(supabase, existing.company_id, id);
    const capabilities = await getUserCapabilities(user.id, currentBusinessUnitId);
    const canViewPricingDetails = hasCapability(
      capabilities,
      GRANULAR_CAPABILITIES.ITEM_DETAILS_PRICING_DETAILS
    );
    const canViewSop = hasCapability(capabilities, GRANULAR_CAPABILITIES.ITEM_SOP_VIEW);
    const canEditSop = hasCapability(capabilities, GRANULAR_CAPABILITIES.ITEM_SOP_EDIT, "edit");
    const item = maskItemPricingDetails(
      transformDbItem(
        updatedItem as ItemRow,
        unitOptionRows,
        priceTiers,
        defaultPricingTier,
        canViewSop
      ),
      canViewPricingDetails
    );
    return NextResponse.json({
      data: item,
      capabilities: {
        canViewPricingDetails,
        canViewSop,
        canEditSop,
      },
    });
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
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    }

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
