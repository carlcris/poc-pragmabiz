/**
 * Item Variant, Packaging, and Pricing Computation Utilities
 * Phase 3: UI/UX Integration
 *
 * These utilities provide computation functions for:
 * - Converting between base quantities and packaging quantities
 * - Retrieving prices for variants and tiers
 * - Calculating costs and totals
 */

import type { ItemPackaging, ItemPrice } from "@/types/item-variant";

// ============================================================================
// PACKAGING COMPUTATIONS
// ============================================================================

/**
 * Convert packaging quantity to base quantity (UOM)
 * @param qty - Quantity in packaging units
 * @param packaging - Packaging information with conversion factor
 * @returns Quantity in base UOM
 * @example
 * // If 1 carton = 100 pieces
 * calculateBaseQuantity(2, { qtyPerPack: 100 }) // returns 200
 */
export function calculateBaseQuantity(qty: number, packaging: { qtyPerPack: number }): number {
  return qty * packaging.qtyPerPack;
}

/**
 * Convert base quantity (UOM) to packaging quantity
 * @param baseQty - Quantity in base UOM
 * @param packaging - Packaging information with conversion factor
 * @returns Quantity in packaging units
 * @example
 * // If 1 carton = 100 pieces
 * calculatePackageQuantity(250, { qtyPerPack: 100 }) // returns 2.5
 */
export function calculatePackageQuantity(
  baseQty: number,
  packaging: { qtyPerPack: number }
): number {
  if (packaging.qtyPerPack === 0) return 0;
  return baseQty / packaging.qtyPerPack;
}

/**
 * Get the default packaging for a variant
 * @param packagingList - List of packaging options
 * @returns Default packaging or undefined if none exists
 */
export function getDefaultPackaging(packagingList: ItemPackaging[]): ItemPackaging | undefined {
  return packagingList.find((pkg) => pkg.isDefault && pkg.isActive);
}

/**
 * Get active packaging options for a variant
 * @param packagingList - List of packaging options
 * @returns Active packaging options
 */
export function getActivePackaging(packagingList: ItemPackaging[]): ItemPackaging[] {
  return packagingList.filter((pkg) => pkg.isActive);
}

// ============================================================================
// PRICING COMPUTATIONS
// ============================================================================

/**
 * Get the current active price for a specific tier
 * @param prices - List of prices
 * @param tierCode - Price tier code (e.g., 'fc', 'ws', 'srp')
 * @param asOfDate - Optional date to check price validity (defaults to now)
 * @returns Current price or undefined if none exists
 */
export function getCurrentPrice(
  prices: ItemPrice[],
  tierCode: string,
  asOfDate?: Date
): ItemPrice | undefined {
  const checkDate = asOfDate || new Date();

  return prices.find((price) => {
    if (!price.isActive) return false;
    if (price.priceTier !== tierCode) return false;

    const from = new Date(price.effectiveFrom);
    const to = price.effectiveTo ? new Date(price.effectiveTo) : null;

    return from <= checkDate && (!to || to >= checkDate);
  });
}

/**
 * Get all current prices for a variant (one per tier)
 * @param prices - List of prices
 * @param asOfDate - Optional date to check price validity (defaults to now)
 * @returns Map of tier code to current price
 */
export function getCurrentPrices(prices: ItemPrice[], asOfDate?: Date): Map<string, ItemPrice> {
  const checkDate = asOfDate || new Date();
  const priceMap = new Map<string, ItemPrice>();

  // Get unique tier codes
  const tierCodes = [...new Set(prices.map((p) => p.priceTier))];

  // For each tier, find the current price
  tierCodes.forEach((tierCode) => {
    const currentPrice = getCurrentPrice(prices, tierCode, checkDate);
    if (currentPrice) {
      priceMap.set(tierCode, currentPrice);
    }
  });

  return priceMap;
}

/**
 * Get available price tiers for a variant
 * @param prices - List of prices
 * @returns List of unique tier codes that have current prices
 */
export function getAvailableTiers(prices: ItemPrice[]): string[] {
  const currentPrices = getCurrentPrices(prices);
  return Array.from(currentPrices.keys());
}

/**
 * Calculate extended amount (quantity × price)
 * @param qty - Quantity
 * @param price - Unit price
 * @returns Extended amount
 */
export function calculateExtendedAmount(qty: number, price: number): number {
  return qty * price;
}

/**
 * Calculate line total with discount
 * @param qty - Quantity
 * @param price - Unit price
 * @param discountPercent - Discount percentage (0-100)
 * @returns Line total after discount
 */
export function calculateLineTotal(
  qty: number,
  price: number,
  discountPercent: number = 0
): number {
  const extendedAmount = calculateExtendedAmount(qty, price);
  const discountAmount = (extendedAmount * discountPercent) / 100;
  return extendedAmount - discountAmount;
}

/**
 * Calculate profit margin percentage
 * @param cost - Cost price
 * @param sellPrice - Selling price
 * @returns Profit margin as percentage
 */
export function calculateProfitMargin(cost: number, sellPrice: number): number {
  if (cost === 0) return 0;
  return ((sellPrice - cost) / cost) * 100;
}

/**
 * Calculate markup percentage
 * @param cost - Cost price
 * @param sellPrice - Selling price
 * @returns Markup as percentage
 */
export function calculateMarkup(cost: number, sellPrice: number): number {
  if (cost === 0) return 0;
  return ((sellPrice - cost) / cost) * 100;
}

// ============================================================================
// PRICE FORMATTING
// ============================================================================

/**
 * Format price with currency symbol
 * @param price - Price value
 * @param currencyCode - Currency code (default: PHP)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted price string
 */
export function formatPrice(
  price: number,
  currencyCode: string = "PHP",
  decimals: number = 2
): string {
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${price.toFixed(decimals)}`;
}

/**
 * Get currency symbol from currency code
 * @param currencyCode - ISO 4217 currency code
 * @returns Currency symbol
 */
export function getCurrencySymbol(currencyCode: string): string {
  const symbols: Record<string, string> = {
    PHP: "₱",
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CNY: "¥",
    KRW: "₩",
  };
  return symbols[currencyCode] || currencyCode + " ";
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if a price is currently valid
 * @param price - Price to check
 * @param asOfDate - Optional date to check validity (defaults to now)
 * @returns True if price is valid
 */
export function isPriceValid(price: ItemPrice, asOfDate?: Date): boolean {
  if (!price.isActive) return false;

  const checkDate = asOfDate || new Date();
  const from = new Date(price.effectiveFrom);
  const to = price.effectiveTo ? new Date(price.effectiveTo) : null;

  return from <= checkDate && (!to || to >= checkDate);
}

/**
 * Check if a packaging option can be deleted
 * @param packaging - Packaging to check
 * @returns True if packaging can be deleted
 */
export function canDeletePackaging(packaging: ItemPackaging): boolean {
  return !packaging.isDefault;
}

/**
 * Check if a variant can be deleted
 * @param variant - Variant to check with isDefault property
 * @returns True if variant can be deleted
 */
export function canDeleteVariant(variant: { isDefault: boolean }): boolean {
  return !variant.isDefault;
}
