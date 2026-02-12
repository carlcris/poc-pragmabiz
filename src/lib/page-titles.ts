export const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/inventory/items": "Inventory Master",
  "/inventory/warehouses": "Warehouse Management",
  "/inventory/stock": "Stock Transactions",
  "/inventory/adjustments": "Stock Adjustments",
  "/inventory/stock-requests": "Stock Requests",
  "/inventory/transformations": "Stock Transformations",
  "/inventory/reorder": "Reorder Management",
  "/purchasing/overview": "Purchasing Overview",
  "/purchasing/suppliers": "Supplier Management",
  "/purchasing/stock-requisitions": "Stock Requisitions",
  "/purchasing/load-lists": "Load Lists",
  "/purchasing/grns": "Goods Receipt Notes",
  "/reports/stock": "Stock Reports",
  "/admin/users": "User Management",
  "/admin/roles": "Role Management",
  "/admin/settings": "Company Settings",
  "/admin/business-units": "Business Units",
};

export function getPageTitle(pathname: string): string {
  return pageTitles[pathname] || "Dashboard";
}
