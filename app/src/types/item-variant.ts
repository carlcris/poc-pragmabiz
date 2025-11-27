/**
 * Type definitions for Item Variants, Packaging, and Pricing
 * Phase 3: UI/UX Integration
 */

// ============================================================================
// Item Variant Types
// ============================================================================

export type ItemVariant = {
  id: string;
  companyId: string;
  itemId: string;
  variantCode: string;
  variantName: string;
  description?: string;
  attributes: Record<string, unknown>; // Flexible JSON attributes (e.g., {size: "8x12", color: "red"})
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
  updatedBy?: string;
  deletedAt?: string;
  version: number;
};

export type CreateItemVariantInput = {
  variantCode: string;
  variantName: string;
  description?: string;
  attributes?: Record<string, unknown>;
  isActive?: boolean;
};

export type UpdateItemVariantInput = Partial<CreateItemVariantInput>;

// ============================================================================
// Item Packaging Types
// ============================================================================

export type ItemPackaging = {
  id: string;
  companyId: string;
  variantId: string;
  packType: string; // e.g., "each", "carton", "box", "dozen"
  packName: string; // e.g., "Each", "Carton of 100", "Box of 12"
  qtyPerPack: number; // Conversion factor to base UOM
  barcode?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
  updatedBy?: string;
  deletedAt?: string;
  version: number;
};

export type CreateItemPackagingInput = {
  packType: string;
  packName: string;
  qtyPerPack: number;
  barcode?: string;
  isActive?: boolean;
};

export type UpdateItemPackagingInput = Partial<CreateItemPackagingInput>;

// ============================================================================
// Item Price Types
// ============================================================================

export type PriceTier = 'fc' | 'ws' | 'srp' | 'government' | 'reseller' | 'vip';

export type ItemPrice = {
  id: string;
  companyId: string;
  variantId: string;
  priceTier: PriceTier;
  priceTierName: string; // e.g., "Factory Cost", "Wholesale", "SRP"
  price: number;
  currencyCode: string;
  effectiveFrom: string; // Date string
  effectiveTo?: string; // Date string or null
  isActive: boolean;
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
  updatedBy?: string;
  deletedAt?: string;
  version: number;
};

export type CreateItemPriceInput = {
  priceTier: PriceTier;
  priceTierName: string;
  price: number;
  currencyCode?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  isActive?: boolean;
};

export type UpdateItemPriceInput = Partial<CreateItemPriceInput>;

// ============================================================================
// Combined/Enhanced Types
// ============================================================================

/**
 * Item Variant with nested packaging and prices
 */
export type ItemVariantWithDetails = ItemVariant & {
  packaging: ItemPackaging[];
  prices: ItemPrice[];
};

/**
 * Complete item information with all variants
 */
export type ItemWithVariants = {
  itemId: string;
  itemCode: string;
  itemName: string;
  variants: ItemVariantWithDetails[];
};

/**
 * Price matrix for display (variant × price tier)
 */
export type PriceMatrix = {
  variantId: string;
  variantCode: string;
  variantName: string;
  prices: {
    [key in PriceTier]?: ItemPrice;
  };
};

// ============================================================================
// API Response Types
// ============================================================================

export type VariantsResponse = {
  data: ItemVariant[];
  total: number;
};

export type PackagingResponse = {
  data: ItemPackaging[];
  total: number;
};

export type PricesResponse = {
  data: ItemPrice[];
  total: number;
};

export type VariantDetailsResponse = {
  data: ItemVariantWithDetails;
};

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Packaging conversion helper
 */
export type PackagingConversion = {
  packagingId: string;
  packType: string;
  packName: string;
  inputQty: number;
  baseQty: number; // inputQty × qtyPerPack
  qtyPerPack: number;
};

/**
 * Price tier display information
 */
export type PriceTierInfo = {
  code: PriceTier;
  name: string;
  description: string;
  color: string; // For UI badge colors
};

/**
 * Predefined price tiers
 */
export const PRICE_TIERS: PriceTierInfo[] = [
  { code: 'fc', name: 'Factory Cost', description: 'Purchase/manufacturing cost', color: 'blue' },
  { code: 'ws', name: 'Wholesale', description: 'Wholesale price for bulk buyers', color: 'green' },
  { code: 'srp', name: 'SRP', description: 'Suggested Retail Price', color: 'purple' },
  { code: 'government', name: 'Government', description: 'Special pricing for government', color: 'yellow' },
  { code: 'reseller', name: 'Reseller', description: 'Price for authorized resellers', color: 'orange' },
  { code: 'vip', name: 'VIP', description: 'VIP/Premium customer pricing', color: 'red' },
];
