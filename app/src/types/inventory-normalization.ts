/**
 * Type Definitions for Inventory Normalization
 *
 * These types support the package-based inventory normalization system.
 * All inventory quantities are stored in base package units, with full
 * conversion tracking for audit purposes.
 *
 * @see /docs/inv-normalization-implementation-plan.md
 */

// ============================================================================
// Item Packaging Types
// ============================================================================

/**
 * Item Package Definition
 * Defines how items can be packaged/sold (e.g., Each, Box, Carton)
 */
export type ItemPackaging = {
  id: string;
  companyId: string;
  itemId: string; // Direct link to item (no variants)
  packType: string; // e.g., "base", "box", "carton", "bag"
  packName: string; // Display name, e.g., "Carton (25kg)"
  qtyPerPack: number; // Conversion factor to base unit
  uomId?: string; // Optional UOM reference
  barcode?: string;
  isDefault: boolean; // Base package is default
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Item with base package reference
 * Extended item type that includes package_id
 */
export type ItemWithPackage = {
  id: string;
  companyId: string;
  itemCode: string;
  itemName: string;
  description?: string;
  itemType: 'raw_material' | 'finished_good' | 'asset' | 'service';
  packageId: string; // Base storage package
  setupComplete: boolean; // Ready for transactions
  standardCost: number;
  listPrice: number;
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// Package Conversion Types
// ============================================================================

/**
 * Input for package conversion
 * What the user provides when creating a transaction
 */
export type PackageConversionInput = {
  itemId: string;
  packagingId: string | null; // null = use base package (items.package_id)
  inputQty: number; // Quantity in selected package units
};

/**
 * Result of package conversion
 * Contains normalized quantity and full audit metadata
 */
export type PackageConversionResult = {
  normalizedQty: number; // Quantity in base package units
  conversionFactor: number; // qty_per_pack from package
  inputPackagingId: string; // Package that was used
  basePackageId: string; // Base package from items.package_id
  inputQty: number; // Original user input
  metadata: {
    inputPackageName: string; // e.g., "Carton (25kg)"
    inputPackageType: string; // e.g., "carton"
    basePackageName: string; // e.g., "Kilogram"
    baseUomId?: string;
    baseUomName?: string;
  };
};

// ============================================================================
// Stock Transaction Types
// ============================================================================

/**
 * Input for creating a stock transaction item
 * Used when user creates any inventory-affecting transaction
 */
export type StockTransactionItemInput = {
  itemId: string;
  packagingId: string | null; // null = use base package
  inputQty: number; // Quantity in selected package
  unitCost: number;
  notes?: string;
  batchNo?: string;
  serialNo?: string;
  expiryDate?: string;
};

/**
 * Normalized stock transaction item
 * Ready to be stored in database with full conversion metadata
 */
export type NormalizedStockTransactionItem = {
  itemId: string;
  inputQty: number; // User-entered quantity
  inputPackagingId: string; // Package user selected
  conversionFactor: number; // qty_per_pack
  normalizedQty: number; // Calculated: inputQty × conversionFactor
  basePackageId: string; // Base package from item
  uomId?: string; // Base UOM
  unitCost: number;
  totalCost: number; // normalizedQty × unitCost
  notes?: string;
  batchNo?: string;
  serialNo?: string;
  expiryDate?: string;
};

// ============================================================================
// Database Function Types
// ============================================================================

/**
 * Parameters for create_item_with_packages database function
 */
export type CreateItemWithPackagesParams = {
  p_company_id: string;
  p_user_id: string;
  p_item_code: string;
  p_item_name: string;
  p_item_name_cn?: string;
  p_item_description?: string;
  p_item_type?: 'raw_material' | 'finished_good' | 'asset' | 'service';
  p_base_package_name?: string;
  p_base_package_type?: string;
  p_base_uom_id?: string;
  p_standard_cost?: number;
  p_list_price?: number;
  p_additional_packages?: AdditionalPackage[];
};

/**
 * Additional package definition for item creation
 */
export type AdditionalPackage = {
  pack_type: string;
  pack_name: string;
  qty_per_pack: number;
  uom_id?: string;
  barcode?: string;
  is_active?: boolean;
};

/**
 * Result from create_item_with_packages database function
 */
export type CreateItemWithPackagesResult = {
  item_id: string;
  base_package_id: string;
  message: string;
};

/**
 * Result from get_item_base_package database function
 */
export type ItemBasePackageInfo = {
  package_id: string;
  pack_name: string;
  pack_type: string;
  qty_per_pack: number;
  uom_id?: string;
  uom_name?: string;
  uom_symbol?: string;
};

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation error for package conversion
 */
export type PackageConversionError = {
  code: 'ITEM_NOT_FOUND' | 'PACKAGE_NOT_FOUND' | 'INVALID_PACKAGE' | 'INVALID_QUANTITY' | 'INVALID_CONVERSION_FACTOR' | 'ITEM_NOT_READY';
  message: string;
  itemId?: string;
  packagingId?: string;
};

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Stock availability check result
 */
export type StockAvailability = {
  itemId: string;
  warehouseId: string;
  currentStock: number; // In base units
  requiredStock: number; // In base units
  isAvailable: boolean;
  shortfall?: number; // If not available
};

/**
 * Package display info for UI
 */
export type PackageDisplayInfo = {
  id: string;
  label: string; // e.g., "Carton (25kg) - 1 carton = 25 kg"
  packName: string;
  qtyPerPack: number;
  isDefault: boolean;
};
