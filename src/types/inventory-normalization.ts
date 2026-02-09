/**
 * Type Definitions for Inventory Normalization
 *
 * These types now model UOM-based normalization (no packaging).
 * All inventory quantities are stored in the item's base UOM.
 */

// ============================================================================
// UOM Conversion Types
// ============================================================================

/**
 * Input for conversion
 * What the user provides when creating a transaction
 */
export type PackageConversionInput = {
  itemId: string;
  inputQty: number; // Quantity in item UOM
};

/**
 * Result of conversion
 * Contains normalized quantity and metadata
 */
export type PackageConversionResult = {
  normalizedQty: number; // Quantity in base UOM
  conversionFactor: number; // Always 1 for UOM-based flow
  inputQty: number; // Original user input
  uomId?: string;
  metadata: {
    uomName?: string;
    uomSymbol?: string;
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
  inputQty: number; // Quantity in item UOM
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
  conversionFactor: number; // Always 1 for UOM-based flow
  normalizedQty: number; // Calculated: inputQty × conversionFactor
  uomId?: string; // Item UOM
  unitCost: number;
  totalCost: number; // normalizedQty × unitCost
  notes?: string;
  batchNo?: string;
  serialNo?: string;
  expiryDate?: string;
};

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation error for package conversion
 */
export type PackageConversionError = {
  code: "ITEM_NOT_FOUND" | "INVALID_QUANTITY" | "INVALID_CONVERSION_FACTOR";
  message: string;
  itemId?: string;
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
