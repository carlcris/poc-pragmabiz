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
} from "@/types/inventory-normalization";

// ============================================================================
// Core Normalization Function
// ============================================================================

/**
 * Normalize quantity from user input to base UOM units
 *
 * Algorithm:
 * 1. Fetch item UOM
 * 2. Validate input quantity
 * 3. Calculate: normalized_qty = input_qty × 1
 * 4. Return conversion metadata for audit trail
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
      uom_id,
      units_of_measure(name, symbol)
    `
    )
    .eq("id", input.itemId)
    .eq("company_id", companyId)
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

  const uom = Array.isArray(item.units_of_measure)
    ? item.units_of_measure[0]
    : item.units_of_measure ?? null;

  // STEP 2: Validate conversion factor (fixed to 1 for UOM-based flow)
  const conversionFactor = 1;

  if (conversionFactor <= 0 || !isFinite(conversionFactor)) {
    const error: PackageConversionError = {
      code: "INVALID_CONVERSION_FACTOR",
      message: `Invalid conversion factor: ${conversionFactor}. Must be a positive number.`,
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
    inputQty: input.inputQty,
    uomId: item.uom_id,
    metadata: {
      uomName: uom?.name || "unit",
      uomSymbol: uom?.symbol || undefined,
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
      inputQty: item.inputQty,
    });

    normalizedItems.push({
      itemId: item.itemId,
      inputQty: item.inputQty,
      conversionFactor: conversion.conversionFactor,
      normalizedQty: conversion.normalizedQty,
      uomId: conversion.uomId,
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
 * Reverse conversion: Convert base units to package units
 * Useful for displaying stock levels in user-friendly units
 *
 * @param baseQty - Quantity in base units
 * @param conversionFactor - conversion factor
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
