/**
 * Lookup/Reference Data Permission Pattern Configuration
 *
 * This file defines which resources are "lookup/reference data" and which
 * transactional features can access them implicitly.
 *
 * PATTERN:
 * If a user has permission for a transactional feature (e.g., 'pos'),
 * they automatically get READ-ONLY access to the lookup data it depends on (e.g., 'items').
 *
 * SECURITY:
 * - Only grants VIEW permission, never CREATE/EDIT/DELETE
 * - User still needs direct permission for CRUD operations
 * - User still needs direct permission to access admin pages
 *
 * @see /docs/plans/lookup-data-permission-pattern.md
 */

import { RESOURCES } from "@/constants/resources";

/**
 * Resources that are primarily used as lookup/reference data
 * in transactional features
 */
export type LookupResource =
  | typeof RESOURCES.ITEMS
  | typeof RESOURCES.CUSTOMERS
  | typeof RESOURCES.SUPPLIERS
  | typeof RESOURCES.WAREHOUSES
  | typeof RESOURCES.ITEM_CATEGORIES
  | typeof RESOURCES.EMPLOYEES;

/**
 * Resources that represent transactional features
 * which depend on lookup data
 */
export type TransactionalResource =
  | typeof RESOURCES.POS
  | typeof RESOURCES.VAN_SALES
  | typeof RESOURCES.SALES_ORDERS
  | typeof RESOURCES.SALES_QUOTATIONS
  | typeof RESOURCES.SALES_INVOICES
  | typeof RESOURCES.PURCHASE_ORDERS
  | typeof RESOURCES.PURCHASE_RECEIPTS
  | typeof RESOURCES.LOAD_LISTS
  | typeof RESOURCES.STOCK_TRANSFERS
  | typeof RESOURCES.STOCK_ADJUSTMENTS
  | typeof RESOURCES.STOCK_TRANSFORMATIONS;

/**
 * Maps transactional features to their required lookup data
 *
 * Logic: If user has permission for the transactional feature,
 * they automatically get READ-ONLY access to the lookup data listed.
 *
 * Example:
 * - User has 'pos' view permission (no 'items' permission)
 * - User tries to GET /api/items
 * - System checks: User has 'pos' permission → POS depends on 'items' → Allow access
 *
 * IMPORTANT: Only add lookup data that is ESSENTIAL for the feature to function.
 * Don't add "nice to have" dependencies.
 */
export const LOOKUP_DATA_ACCESS_MAP: Record<TransactionalResource, LookupResource[]> = {
  // ============================================================================
  // SALES FEATURES
  // ============================================================================

  /**
   * Point of Sale (POS)
   * Cashiers need to view items and customers to complete sales
   */
  [RESOURCES.POS]: [
    RESOURCES.ITEMS, // Need to see items for sale
    RESOURCES.CUSTOMERS, // Need to select/create customers
    RESOURCES.ITEM_CATEGORIES, // Need for item filtering/browsing
  ],

  /**
   * Van Sales
   * Mobile sales reps need items, customers, and warehouse info
   */
  [RESOURCES.VAN_SALES]: [
    RESOURCES.ITEMS,
    RESOURCES.CUSTOMERS,
    RESOURCES.WAREHOUSES, // Need to know van warehouse inventory
    RESOURCES.ITEM_CATEGORIES,
  ],

  /**
   * Sales Orders
   * Sales team needs items, customers, and employee info
   */
  [RESOURCES.SALES_ORDERS]: [
    RESOURCES.ITEMS,
    RESOURCES.CUSTOMERS,
    RESOURCES.EMPLOYEES, // Need for sales rep assignment
    RESOURCES.ITEM_CATEGORIES,
  ],

  /**
   * Sales Quotations
   * Pre-sales needs items and customers
   */
  [RESOURCES.SALES_QUOTATIONS]: [
    RESOURCES.ITEMS,
    RESOURCES.CUSTOMERS,
    RESOURCES.EMPLOYEES,
    RESOURCES.ITEM_CATEGORIES,
  ],

  /**
   * Sales Invoices
   * Invoicing needs items and customers
   */
  [RESOURCES.SALES_INVOICES]: [
    RESOURCES.ITEMS,
    RESOURCES.CUSTOMERS,
    RESOURCES.EMPLOYEES,
    RESOURCES.ITEM_CATEGORIES,
  ],

  // ============================================================================
  // PURCHASING FEATURES
  // ============================================================================

  /**
   * Purchase Orders
   * Purchasing team needs items, suppliers, and warehouses
   */
  [RESOURCES.PURCHASE_ORDERS]: [
    RESOURCES.ITEMS,
    RESOURCES.SUPPLIERS, // Need to select suppliers
    RESOURCES.WAREHOUSES, // Need to specify delivery warehouse
    RESOURCES.ITEM_CATEGORIES,
  ],

  /**
   * Purchase Receipts
   * Receiving team needs items, suppliers, and warehouses
   */
  [RESOURCES.PURCHASE_RECEIPTS]: [
    RESOURCES.ITEMS,
    RESOURCES.SUPPLIERS,
    RESOURCES.WAREHOUSES,
    RESOURCES.ITEM_CATEGORIES,
  ],
  /**
   * Load Lists
   * Purchasing team needs items, suppliers, and warehouses
   */
  [RESOURCES.LOAD_LISTS]: [
    RESOURCES.ITEMS,
    RESOURCES.SUPPLIERS,
    RESOURCES.WAREHOUSES,
    RESOURCES.ITEM_CATEGORIES,
  ],

  // ============================================================================
  // INVENTORY FEATURES
  // ============================================================================

  /**
   * Stock Transfers
   * Warehouse staff need items and warehouse info
   */
  [RESOURCES.STOCK_TRANSFERS]: [
    RESOURCES.ITEMS,
    RESOURCES.WAREHOUSES, // Need source and destination warehouses
    RESOURCES.ITEM_CATEGORIES,
  ],

  /**
   * Stock Adjustments
   * Inventory team needs items and warehouse info
   */
  [RESOURCES.STOCK_ADJUSTMENTS]: [RESOURCES.ITEMS, RESOURCES.WAREHOUSES, RESOURCES.ITEM_CATEGORIES],

  /**
   * Stock Transformations
   * Production team needs items and warehouse info
   */
  [RESOURCES.STOCK_TRANSFORMATIONS]: [
    RESOURCES.ITEMS,
    RESOURCES.WAREHOUSES,
    RESOURCES.ITEM_CATEGORIES,
  ],
};

/**
 * Get all transactional features that can access a specific lookup resource
 *
 * @param lookupResource - The lookup resource to check
 * @returns Array of transactional features that depend on this lookup resource
 *
 * @example
 * getAccessorsForLookupData('items')
 * // Returns: ['pos', 'van_sales', 'sales_orders', 'purchase_orders', ...]
 */
export function getAccessorsForLookupData(lookupResource: LookupResource): TransactionalResource[] {
  return Object.entries(LOOKUP_DATA_ACCESS_MAP)
    .filter(([, lookups]) => lookups.includes(lookupResource))
    .map(([feature]) => feature as TransactionalResource);
}

/**
 * Check if a transactional feature depends on a lookup resource
 *
 * @param transactionalFeature - The transactional feature
 * @param lookupResource - The lookup resource
 * @returns True if the feature depends on the lookup resource
 *
 * @example
 * featureDependsOnLookup('pos', 'items') // Returns: true
 * featureDependsOnLookup('pos', 'suppliers') // Returns: false
 */
export function featureDependsOnLookup(
  transactionalFeature: TransactionalResource,
  lookupResource: LookupResource
): boolean {
  const dependencies = LOOKUP_DATA_ACCESS_MAP[transactionalFeature];
  return dependencies.includes(lookupResource);
}

/**
 * Get all lookup resources that a transactional feature depends on
 *
 * @param transactionalFeature - The transactional feature
 * @returns Array of lookup resources the feature depends on
 *
 * @example
 * getLookupDependencies('pos')
 * // Returns: ['items', 'customers', 'item_categories']
 */
export function getLookupDependencies(
  transactionalFeature: TransactionalResource
): LookupResource[] {
  return LOOKUP_DATA_ACCESS_MAP[transactionalFeature] || [];
}

/**
 * Validate that all lookup resources in the map are valid
 * This helps catch typos or invalid resource references
 *
 * @returns Array of validation errors, empty if valid
 */
export function validateLookupDataConfiguration(): string[] {
  const errors: string[] = [];

  const validLookupResources: LookupResource[] = [
    RESOURCES.ITEMS,
    RESOURCES.CUSTOMERS,
    RESOURCES.SUPPLIERS,
    RESOURCES.WAREHOUSES,
    RESOURCES.ITEM_CATEGORIES,
    RESOURCES.EMPLOYEES,
  ];

  Object.entries(LOOKUP_DATA_ACCESS_MAP).forEach(([feature, lookups]) => {
    lookups.forEach((lookup) => {
      if (!validLookupResources.includes(lookup)) {
        errors.push(`Invalid lookup resource '${lookup}' in feature '${feature}'`);
      }
    });
  });

  return errors;
}
