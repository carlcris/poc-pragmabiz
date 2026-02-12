"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const pathNameMap: Record<string, string> = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  items: "Item Master",
  warehouses: "Warehouses",
  stock: "Stock Transactions",
  adjustments: "Stock Adjustments",
  "stock-requests": "Stock Requests",
  transformations: "Stock Transformations",
  reorder: "Reorder Management",
  purchasing: "Purchasing",
  overview: "Overview",
  suppliers: "Suppliers",
  "stock-requisitions": "Stock Requisitions",
  "load-lists": "Load Lists",
  grns: "Goods Receipt Notes",
  reports: "Reports",
  admin: "Admin",
  users: "Users",
  roles: "Roles",
  settings: "Company Settings",
  "business-units": "Business Units",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const pathSegments = pathname.split("/").filter(Boolean);

  // Get only the last segment (current page)
  const lastSegment = pathSegments[pathSegments.length - 1];
  const currentPageLabel = pathNameMap[lastSegment] || lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);

  return (
    <nav className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
      <Link
        href="/dashboard"
        className="flex items-center hover:text-foreground transition-colors font-medium"
      >
        Home
      </Link>

      {/* Only show current page */}
      <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
      <span className="font-medium text-foreground">{currentPageLabel}</span>
    </nav>
  );
}
