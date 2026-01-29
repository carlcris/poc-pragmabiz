/**
 * Role-based default landing pages
 * Maps role names to their default page after login
 */

import type { Resource } from "@/constants/resources";
import type { UserPermissions } from "@/types/rbac";

export const ROLE_DEFAULT_PAGES: Record<string, string> = {
  "Super Admin": "/dashboard",
  Admin: "/dashboard",
  Manager: "/dashboard",
  Cashier: "/sales/pos",
  User: "/dashboard",
  Viewer: "/dashboard",
};

/**
 * Page to resource mapping
 * Maps page paths to the required permission resource
 */
const PAGE_RESOURCE_MAP: Record<string, Resource> = {
  "/dashboard": "dashboard",
  "/sales/pos": "pos",
  "/sales/customers": "customers",
  "/sales/quotations": "sales_quotations",
  "/sales/orders": "sales_orders",
  "/sales/invoices": "sales_invoices",
  "/inventory/items": "items",
  "/inventory/warehouses": "warehouses",
  "/inventory/stock": "stock_transfers",
  "/inventory/adjustments": "stock_adjustments",
  "/inventory/transformations": "stock_transformations",
  "/inventory/reorder": "reorder_management",
  "/purchasing/suppliers": "suppliers",
  "/purchasing/orders": "purchase_orders",
  "/purchasing/receipts": "purchase_receipts",
  "/accounting/chart-of-accounts": "chart_of_accounts",
  "/accounting/journals": "journal_entries",
  "/accounting/ledger": "general_ledger",
  "/accounting/trial-balance": "general_ledger",
  "/reports/sales-analytics": "reports",
  "/reports/stock": "reports",
  "/reports/commission": "reports",
  "/admin/users": "users",
  "/admin/roles": "roles",
  "/admin/settings": "company_settings",
  "/admin/business-units": "business_units",
};

/**
 * List of all accessible pages in priority order
 * Used to find the first accessible page when role default is not available
 */
const PAGE_PRIORITY = [
  "/dashboard",
  "/sales/pos",
  "/sales/customers",
  "/inventory/items",
  "/sales/orders",
  "/sales/invoices",
  "/purchasing/orders",
  "/reports/sales-analytics",
];

/**
 * Get the default page for a given role
 * @param roleName - The name of the role
 * @returns The default page path, or '/dashboard' as fallback
 */
export function getDefaultPageForRole(roleName: string): string {
  return ROLE_DEFAULT_PAGES[roleName] || "/dashboard";
}

/**
 * Get the default page for a user based on their roles
 * If user has multiple roles, returns the first matching role's default page
 * @param roleNames - Array of role names the user has
 * @returns The default page path
 */
export function getDefaultPageForUser(roleNames: string[]): string {
  if (!roleNames || roleNames.length === 0) {
    return "/dashboard";
  }

  // Check roles in priority order (Super Admin > Admin > Manager > Cashier > User > Viewer)
  const rolePriority = ["Super Admin", "Admin", "Manager", "Cashier", "User", "Viewer"];

  for (const role of rolePriority) {
    if (roleNames.includes(role)) {
      return getDefaultPageForRole(role);
    }
  }

  // If no matching role found, return the first role's default page
  return getDefaultPageForRole(roleNames[0]);
}

/**
 * Get the first accessible page for a user based on their permissions
 * PRODUCTION-READY: Checks actual permissions before redirecting
 *
 * @param permissions - User's effective permissions
 * @param roleNames - Array of role names (optional, for fallback)
 * @returns The first accessible page path, or '/403' if no access
 */
export function getFirstAccessiblePage(
  permissions: UserPermissions | null,
  roleNames?: string[]
): string {
  // If no permissions, redirect to 403
  if (!permissions) {
    return "/403";
  }

  // Try role default page first
  if (roleNames && roleNames.length > 0) {
    const roleDefaultPage = getDefaultPageForUser(roleNames);
    const requiredResource = PAGE_RESOURCE_MAP[roleDefaultPage];

    if (requiredResource && permissions[requiredResource]?.can_view) {
      return roleDefaultPage;
    }
  }

  // If role default is not accessible, find first accessible page
  for (const page of PAGE_PRIORITY) {
    const requiredResource = PAGE_RESOURCE_MAP[page];
    if (requiredResource && permissions[requiredResource]?.can_view) {
      return page;
    }
  }

  // If no accessible pages found, check if user has ANY view permission
  const hasAnyPermission = Object.values(permissions).some((perm) => perm.can_view);

  if (hasAnyPermission) {
    // Find any page user can access
    for (const [page, resource] of Object.entries(PAGE_RESOURCE_MAP)) {
      if (permissions[resource]?.can_view) {
        return page;
      }
    }
  }

  // No accessible pages - redirect to 403
  return "/403";
}

/**
 * Check if user can access a specific page
 * @param page - Page path to check
 * @param permissions - User's effective permissions
 * @returns True if user can access the page
 */
export function canAccessPage(page: string, permissions: UserPermissions | null): boolean {
  if (!permissions) return false;

  const requiredResource = PAGE_RESOURCE_MAP[page];
  if (!requiredResource) return true; // Unknown pages are accessible (will be caught by route guards)

  return permissions[requiredResource]?.can_view ?? false;
}
