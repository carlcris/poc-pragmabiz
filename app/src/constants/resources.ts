/**
 * System Resources for RBAC
 *
 * This file defines all resources in the system that can have permissions.
 * Each resource corresponds to a functional area or module in the application.
 */

export const RESOURCES = {
  // ============================================================================
  // ADMIN & SYSTEM MANAGEMENT
  // ============================================================================
  USERS: 'users',
  ROLES: 'roles',
  PERMISSIONS: 'permissions',
  COMPANY_SETTINGS: 'company_settings',
  BUSINESS_UNITS: 'business_units',

  // ============================================================================
  // INVENTORY MANAGEMENT
  // ============================================================================
  ITEMS: 'items',
  ITEM_CATEGORIES: 'item_categories',
  WAREHOUSES: 'warehouses',
  STOCK_ADJUSTMENTS: 'stock_adjustments',
  STOCK_TRANSFERS: 'stock_transfers',
  STOCK_TRANSACTIONS: 'stock_transactions',
  STOCK_TRANSFORMATIONS: 'stock_transformations',
  REORDER_MANAGEMENT: 'reorder_management',

  // ============================================================================
  // SALES MANAGEMENT
  // ============================================================================
  CUSTOMERS: 'customers',
  SALES_QUOTATIONS: 'sales_quotations',
  SALES_ORDERS: 'sales_orders',
  SALES_INVOICES: 'sales_invoices',
  POS: 'pos',
  VAN_SALES: 'van_sales',

  // ============================================================================
  // PURCHASING MANAGEMENT
  // ============================================================================
  SUPPLIERS: 'suppliers',
  PURCHASE_ORDERS: 'purchase_orders',
  PURCHASE_RECEIPTS: 'purchase_receipts',

  // ============================================================================
  // ACCOUNTING & FINANCE
  // ============================================================================
  CHART_OF_ACCOUNTS: 'chart_of_accounts',
  JOURNAL_ENTRIES: 'journal_entries',
  GENERAL_LEDGER: 'general_ledger',
  INVOICE_PAYMENTS: 'invoice_payments',

  // ============================================================================
  // EMPLOYEE MANAGEMENT
  // ============================================================================
  EMPLOYEES: 'employees',
  COMMISSIONS: 'commissions',

  // ============================================================================
  // REPORTING & ANALYTICS
  // ============================================================================
  REPORTS: 'reports',
  ANALYTICS: 'analytics',
  DASHBOARD: 'dashboard',
} as const;

// Type-safe resource keys
export type Resource = typeof RESOURCES[keyof typeof RESOURCES];

/**
 * Resource metadata for UI display
 */
export interface ResourceMetadata {
  key: Resource;
  name: string;
  description: string;
  category: string;
  icon?: string;
}

export const RESOURCE_METADATA: ResourceMetadata[] = [
  // Admin & System Management
  {
    key: RESOURCES.USERS,
    name: 'Users',
    description: 'Manage user accounts and access',
    category: 'Admin',
  },
  {
    key: RESOURCES.ROLES,
    name: 'Roles',
    description: 'Manage user roles and permissions',
    category: 'Admin',
  },
  {
    key: RESOURCES.PERMISSIONS,
    name: 'Permissions',
    description: 'Manage system permissions',
    category: 'Admin',
  },
  {
    key: RESOURCES.COMPANY_SETTINGS,
    name: 'Company Settings',
    description: 'Manage company configuration',
    category: 'Admin',
  },
  {
    key: RESOURCES.BUSINESS_UNITS,
    name: 'Business Units',
    description: 'Manage business units',
    category: 'Admin',
  },

  // Inventory Management
  {
    key: RESOURCES.ITEMS,
    name: 'Items',
    description: 'Manage inventory items and products',
    category: 'Inventory',
  },
  {
    key: RESOURCES.ITEM_CATEGORIES,
    name: 'Item Categories',
    description: 'Manage item categories and classifications',
    category: 'Inventory',
  },
  {
    key: RESOURCES.WAREHOUSES,
    name: 'Warehouses',
    description: 'Manage warehouse locations',
    category: 'Inventory',
  },
  {
    key: RESOURCES.STOCK_ADJUSTMENTS,
    name: 'Stock Adjustments',
    description: 'Adjust inventory quantities',
    category: 'Inventory',
  },
  {
    key: RESOURCES.STOCK_TRANSFERS,
    name: 'Stock Transfers',
    description: 'Transfer stock between warehouses',
    category: 'Inventory',
  },
  {
    key: RESOURCES.STOCK_TRANSACTIONS,
    name: 'Stock Transactions',
    description: 'View stock transaction history',
    category: 'Inventory',
  },
  {
    key: RESOURCES.STOCK_TRANSFORMATIONS,
    name: 'Stock Transformations',
    description: 'Transform items into other items',
    category: 'Inventory',
  },
  {
    key: RESOURCES.REORDER_MANAGEMENT,
    name: 'Reorder Management',
    description: 'Manage reorder points and alerts',
    category: 'Inventory',
  },

  // Sales Management
  {
    key: RESOURCES.CUSTOMERS,
    name: 'Customers',
    description: 'Manage customer information',
    category: 'Sales',
  },
  {
    key: RESOURCES.SALES_QUOTATIONS,
    name: 'Sales Quotations',
    description: 'Create and manage sales quotations',
    category: 'Sales',
  },
  {
    key: RESOURCES.SALES_ORDERS,
    name: 'Sales Orders',
    description: 'Create and manage sales orders',
    category: 'Sales',
  },
  {
    key: RESOURCES.SALES_INVOICES,
    name: 'Sales Invoices',
    description: 'Create and manage sales invoices',
    category: 'Sales',
  },
  {
    key: RESOURCES.POS,
    name: 'POS',
    description: 'Point of Sale transactions',
    category: 'Sales',
  },
  {
    key: RESOURCES.VAN_SALES,
    name: 'Van Sales',
    description: 'Manage van sales operations and transactions',
    category: 'Sales',
  },

  // Purchasing Management
  {
    key: RESOURCES.SUPPLIERS,
    name: 'Suppliers',
    description: 'Manage supplier information',
    category: 'Purchasing',
  },
  {
    key: RESOURCES.PURCHASE_ORDERS,
    name: 'Purchase Orders',
    description: 'Create and manage purchase orders',
    category: 'Purchasing',
  },
  {
    key: RESOURCES.PURCHASE_RECEIPTS,
    name: 'Purchase Receipts',
    description: 'Receive and manage goods receipts',
    category: 'Purchasing',
  },

  // Accounting & Finance
  {
    key: RESOURCES.CHART_OF_ACCOUNTS,
    name: 'Chart of Accounts',
    description: 'Manage account structure',
    category: 'Accounting',
  },
  {
    key: RESOURCES.JOURNAL_ENTRIES,
    name: 'Journal Entries',
    description: 'Create and manage journal entries',
    category: 'Accounting',
  },
  {
    key: RESOURCES.GENERAL_LEDGER,
    name: 'General Ledger',
    description: 'View general ledger reports',
    category: 'Accounting',
  },
  {
    key: RESOURCES.INVOICE_PAYMENTS,
    name: 'Invoice Payments',
    description: 'Manage invoice payments',
    category: 'Accounting',
  },

  // Employee Management
  {
    key: RESOURCES.EMPLOYEES,
    name: 'Employees',
    description: 'Manage employee information',
    category: 'HR',
  },
  {
    key: RESOURCES.COMMISSIONS,
    name: 'Commissions',
    description: 'View and manage employee commissions',
    category: 'HR',
  },

  // Reporting & Analytics
  {
    key: RESOURCES.REPORTS,
    name: 'Reports',
    description: 'Access system reports',
    category: 'Reports',
  },
  {
    key: RESOURCES.ANALYTICS,
    name: 'Analytics',
    description: 'View analytics and insights',
    category: 'Reports',
  },
  {
    key: RESOURCES.DASHBOARD,
    name: 'Dashboard',
    description: 'View dashboard and metrics',
    category: 'Reports',
  },
];

/**
 * Group resources by category
 */
export const RESOURCE_CATEGORIES = Array.from(
  new Set(RESOURCE_METADATA.map((r) => r.category))
).sort();

/**
 * Get resources by category
 */
export function getResourcesByCategory(category: string): ResourceMetadata[] {
  return RESOURCE_METADATA.filter((r) => r.category === category);
}

/**
 * Get resource metadata by key
 */
export function getResourceMetadata(resource: Resource): ResourceMetadata | undefined {
  return RESOURCE_METADATA.find((r) => r.key === resource);
}
