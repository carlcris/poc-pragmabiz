/**
 * Inventory Normalization Service
 *
 * Core service for normalizing inventory quantities from user-selected packages
 * to base storage units. Ensures all inventory is stored consistently in base units
 * while allowing users to transact in any defined package.
 *
 * @see /docs/inv-normalization-implementation-plan.md
 */

import { createClient } from "@/lib/supabase/server";
import type {
  PackageConversionInput,
  PackageConversionResult,
  StockTransactionItemInput,
  NormalizedStockTransactionItem,
  PackageConversionError,
  ItemBasePackageInfo,
} from "@/types/inventory-normalization";

// ============================================================================
// Core Normalization Function
// ============================================================================

/**
 * Normalize quantity from user-selected package to base package units
 *
 * Algorithm:
 * 1. Get item's base package (items.package_id)
 * 2. Determine which package to use (specified or default to base)
 * 3. Get conversion factor (qty_per_pack)
 * 4. Calculate: normalized_qty = input_qty × conversion_factor
 * 5. Return full conversion metadata for audit trail
 *
 * @param companyId - Company context
 * @param input - Conversion input (item, package, quantity)
 * @returns Conversion result with normalized quantity and metadata
 * @throws Error if item not found, package invalid, or item not ready
 */
export async function normalizeQuantity(
  companyId: string,
  input: PackageConversionInput
): Promise<PackageConversionResult> {
  const supabase = await createClient();

  // STEP 1: Get item's base package
  const { data: item, error: itemError } = await supabase
    .from("items")
    .select(
      `
      package_id,
      base_package:item_packaging!package_id(
        id,
        pack_name,
        pack_type,
        qty_per_pack,
        uom_id,
        units_of_measure(name)
      )
    `
    )
    .eq("id", input.itemId)
    .eq("company_id", companyId)
    .eq("setup_complete", true)
    .is("deleted_at", null)
    .single();

  if (itemError || !item) {
    const error: PackageConversionError = {
      code: "ITEM_NOT_FOUND",
      message: `Item not found or not ready for transactions: ${input.itemId}`,
      itemId: input.itemId,
    };
    throw new Error(error.message);
  }

  const basePackage = item.base_package as unknown as {
    id: string;
    pack_name: string;
    pack_type: string;
    qty_per_pack: number;
    uom_id: string;
    units_of_measure: { name: string } | null;
  };

  if (!basePackage) {
    throw new Error("Item base package not found");
  }

  // STEP 2: Determine input package
  let inputPackageId = input.packagingId;

  if (!inputPackageId) {
    // Use base package as default
    inputPackageId = item.package_id as string;
  }

  // STEP 3: Get input package details (if different from base)
  let inputPackage: {
    id: string;
    pack_name: string;
    pack_type: string;
    qty_per_pack: number;
  };

  if (inputPackageId === item.package_id) {
    // Using base package
    inputPackage = basePackage;
  } else {
    // Using different package - fetch it
    const { data: pkg, error: pkgError } = await supabase
      .from("item_packaging")
      .select("id, pack_name, pack_type, qty_per_pack")
      .eq("id", inputPackageId)
      .eq("company_id", companyId)
      .eq("item_id", input.itemId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    if (pkgError || !pkg) {
      const error: PackageConversionError = {
        code: "INVALID_PACKAGE",
        message: "Input package not found or does not belong to item",
        itemId: input.itemId,
        packagingId: inputPackageId,
      };
      throw new Error(error.message);
    }

    inputPackage = pkg;
  }

  // STEP 4: Validate conversion factor
  const conversionFactor = parseFloat(String(inputPackage.qty_per_pack));

  if (conversionFactor <= 0 || !isFinite(conversionFactor)) {
    const error: PackageConversionError = {
      code: "INVALID_CONVERSION_FACTOR",
      message: `Invalid conversion factor: ${conversionFactor}. Must be a positive number.`,
      packagingId: inputPackageId,
    };
    throw new Error(error.message);
  }

  // STEP 5: Validate input quantity
  if (input.inputQty < 0 || !isFinite(input.inputQty)) {
    const error: PackageConversionError = {
      code: "INVALID_QUANTITY",
      message: `Invalid input quantity: ${input.inputQty}. Must be a non-negative number.`,
    };
    throw new Error(error.message);
  }

  // STEP 6: Calculate normalized quantity
  const normalizedQty = input.inputQty * conversionFactor;

  // STEP 7: Return conversion result
  return {
    normalizedQty,
    conversionFactor,
    inputPackagingId: inputPackage.id,
    basePackageId: item.package_id as string,
    inputQty: input.inputQty,
    metadata: {
      inputPackageName: inputPackage.pack_name,
      inputPackageType: inputPackage.pack_type,
      basePackageName: basePackage.pack_name,
      baseUomId: basePackage.uom_id,
      baseUomName: basePackage.units_of_measure?.name || "unit",
    },
  };
}

// ============================================================================
// Batch Normalization Function
// ============================================================================

/**
 * Normalize multiple transaction items in a single batch
 *
 * More efficient than calling normalizeQuantity multiple times
 * as it can optimize database queries.
 *
 * @param companyId - Company context
 * @param items - Array of transaction items to normalize
 * @returns Array of normalized items ready for database insert
 */
export async function normalizeTransactionItems(
  companyId: string,
  items: StockTransactionItemInput[]
): Promise<NormalizedStockTransactionItem[]> {
  const normalizedItems: NormalizedStockTransactionItem[] = [];

  // Process each item sequentially
  // TODO: Optimize with parallel processing if needed
  for (const item of items) {
    const conversion = await normalizeQuantity(companyId, {
      itemId: item.itemId,
      packagingId: item.packagingId,
      inputQty: item.inputQty,
    });

    normalizedItems.push({
      itemId: item.itemId,
      inputQty: item.inputQty,
      inputPackagingId: conversion.inputPackagingId,
      conversionFactor: conversion.conversionFactor,
      normalizedQty: conversion.normalizedQty,
      basePackageId: conversion.basePackageId,
      uomId: conversion.metadata.baseUomId,
      unitCost: item.unitCost,
      totalCost: conversion.normalizedQty * item.unitCost,
      notes: item.notes,
      batchNo: item.batchNo,
      serialNo: item.serialNo,
      expiryDate: item.expiryDate,
    });
  }

  return normalizedItems;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get item's base package information
 * Wrapper around database function for convenience
 *
 * @param itemId - Item UUID
 * @returns Base package information
 */
export async function getItemBasePackage(itemId: string): Promise<ItemBasePackageInfo | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_item_base_package", {
    p_item_id: itemId,
  });

  if (error) {
    console.error("Error fetching base package:", error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0] as ItemBasePackageInfo;
}

/**
 * Reverse conversion: Convert base units to package units
 * Useful for displaying stock levels in user-friendly units
 *
 * @param baseQty - Quantity in base units
 * @param conversionFactor - qty_per_pack from package
 * @returns Quantity in package units
 */
export function denormalizeQuantity(
  baseQty: number,
  conversionFactor: number
): {
  packageQty: number;
  wholePackages: number;
  remainder: number;
} {
  const packageQty = baseQty / conversionFactor;
  const wholePackages = Math.floor(packageQty);
  const remainder = baseQty - wholePackages * conversionFactor;

  return {
    packageQty,
    wholePackages,
    remainder,
  };
}

/**
 * Validate stock availability in base units
 *
 * @param itemId - Item UUID
 * @param warehouseId - Warehouse UUID
 * @param requiredQty - Required quantity in base units
 * @returns Stock availability info
 */
export async function checkStockAvailability(
  itemId: string,
  warehouseId: string,
  requiredQty: number
): Promise<{
  isAvailable: boolean;
  currentStock: number;
  shortfall: number;
}> {
  const supabase = await createClient();

  const { data: warehouseStock } = await supabase
    .from("item_warehouse")
    .select("current_stock")
    .eq("item_id", itemId)
    .eq("warehouse_id", warehouseId)
    .is("deleted_at", null)
    .single();

  const currentStock = warehouseStock?.current_stock
    ? parseFloat(String(warehouseStock.current_stock))
    : 0;

  const isAvailable = currentStock >= requiredQty;
  const shortfall = isAvailable ? 0 : requiredQty - currentStock;

  return {
    isAvailable,
    currentStock,
    shortfall,
  };
}

/**
 * Get all packages for an item
 * Useful for displaying package selector in UI
 *
 * @param companyId - Company context
 * @param itemId - Item UUID
 * @returns Array of packages with display info
 */
export async function getItemPackages(
  companyId: string,
  itemId: string
): Promise<
  Array<{
    id: string;
    packName: string;
    packType: string;
    qtyPerPack: number;
    isDefault: boolean;
    barcode?: string;
  }>
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("item_packaging")
    .select("id, pack_name, pack_type, qty_per_pack, is_default, barcode")
    .eq("company_id", companyId)
    .eq("item_id", itemId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("is_default", { ascending: false })
    .order("qty_per_pack", { ascending: true });

  if (error) {
    console.error("Error fetching item packages:", error);
    return [];
  }

  return (
    data?.map((pkg) => ({
      id: pkg.id,
      packName: pkg.pack_name,
      packType: pkg.pack_type,
      qtyPerPack: parseFloat(String(pkg.qty_per_pack)),
      isDefault: pkg.is_default,
      barcode: pkg.barcode || undefined,
    })) || []
  );
}
