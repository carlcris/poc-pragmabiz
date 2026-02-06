"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  FileText,
  ChevronRight,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BusinessUnitSwitcher } from "@/components/business-unit/BusinessUnitSwitcher";
import { usePermissions } from "@/hooks/usePermissions";
import { RESOURCES } from "@/constants/resources";
import type { Resource } from "@/constants/resources";

const menuItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    resource: RESOURCES.DASHBOARD as Resource,
  },
  {
    title: "Inventory",
    icon: Package,
    href: "/inventory/items",
    children: [
      { title: "Item Master", href: "/inventory/items", resource: RESOURCES.ITEMS as Resource },
      {
        title: "Warehouses",
        href: "/inventory/warehouses",
        resource: RESOURCES.WAREHOUSES as Resource,
      },
      {
        title: "Stock Transactions",
        href: "/inventory/stock",
        resource: RESOURCES.STOCK_TRANSFERS as Resource,
      },
      {
        title: "Stock Adjustments",
        href: "/inventory/adjustments",
        resource: RESOURCES.STOCK_ADJUSTMENTS as Resource,
      },
      {
        title: "Stock Requests",
        href: "/inventory/stock-requests",
        resource: RESOURCES.STOCK_REQUESTS as Resource,
      },
      {
        title: "Stock Transformations",
        href: "/inventory/transformations",
        resource: RESOURCES.STOCK_TRANSFORMATIONS as Resource,
      },
      {
        title: "Reorder Management",
        href: "/inventory/reorder",
        resource: RESOURCES.REORDER_MANAGEMENT as Resource,
      },
    ],
  },
  // {
  //   title: "Sales",
  //   icon: ShoppingCart,
  //   href: "/sales",
  //   children: [
  //     { title: "Point of Sale", href: "/sales/pos", resource: RESOURCES.POS as Resource },
  //     { title: "POS Transactions", href: "/sales/pos/transactions", resource: RESOURCES.POS as Resource },
  //     { title: "Customers", href: "/sales/customers", resource: RESOURCES.CUSTOMERS as Resource },
  //     { title: "Quotations", href: "/sales/quotations", resource: RESOURCES.SALES_QUOTATIONS as Resource },
  //     { title: "Sales Orders", href: "/sales/orders", resource: RESOURCES.SALES_ORDERS as Resource },
  //     { title: "Invoices", href: "/sales/invoices", resource: RESOURCES.SALES_INVOICES as Resource },
  //   ],
  // },
  {
    title: "Purchasing",
    icon: ShoppingBag,
    href: "/purchasing",
    children: [
      {
        title: "Suppliers",
        href: "/purchasing/suppliers",
        resource: RESOURCES.SUPPLIERS as Resource,
      },
      {
        title: "Stock Requisitions",
        href: "/purchasing/stock-requisitions",
        resource: RESOURCES.STOCK_REQUISITIONS as Resource,
      },
      {
        title: "Load Lists",
        href: "/purchasing/load-lists",
        resource: RESOURCES.LOAD_LISTS as Resource,
      },
      {
        title: "Goods Receipt Notes",
        href: "/purchasing/grns",
        resource: RESOURCES.GOODS_RECEIPT_NOTES as Resource,
      },
      {
        title: "Putaway Station",
        href: "/purchasing/grns/putaway",
        resource: RESOURCES.GOODS_RECEIPT_NOTES as Resource,
      },
      {
        title: "Purchase Orders",
        href: "/purchasing/orders",
        resource: RESOURCES.PURCHASE_ORDERS as Resource,
      },
      {
        title: "Purchase Receipts",
        href: "/purchasing/receipts",
        resource: RESOURCES.PURCHASE_RECEIPTS as Resource,
      },
    ],
  },
  // {
  //   title: "Accounting",
  //   icon: Calculator,
  //   href: "/accounting",
  //   children: [
  //     { title: "Chart of Accounts", href: "/accounting/chart-of-accounts", resource: RESOURCES.CHART_OF_ACCOUNTS as Resource },
  //     { title: "Journal Entries", href: "/accounting/journals", resource: RESOURCES.JOURNAL_ENTRIES as Resource },
  //     { title: "General Ledger", href: "/accounting/ledger", resource: RESOURCES.GENERAL_LEDGER as Resource },
  //     { title: "Trial Balance", href: "/accounting/trial-balance", resource: RESOURCES.GENERAL_LEDGER as Resource },
  //   ],
  // },
  {
    title: "Reports",
    icon: FileText,
    href: "/reports",
    children: [
      //{ title: "Sales Analytics", href: "/reports/sales-analytics", resource: RESOURCES.REPORTS as Resource },
      { title: "Stock Reports", href: "/reports/stock", resource: RESOURCES.REPORTS as Resource },
      //{ title: "Commission Reports", href: "/reports/commission", resource: RESOURCES.REPORTS as Resource },
    ],
  },
  {
    title: "Admin",
    icon: Shield,
    href: "/admin",
    children: [
      { title: "Users", href: "/admin/users", resource: RESOURCES.USERS as Resource },
      { title: "Roles", href: "/admin/roles", resource: RESOURCES.ROLES as Resource },
      {
        title: "Company Settings",
        href: "/admin/settings",
        resource: RESOURCES.COMPANY_SETTINGS as Resource,
      },
      {
        title: "Business Units",
        href: "/admin/business-units",
        resource: RESOURCES.BUSINESS_UNITS as Resource,
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const { can, isLoading: permissionsLoading, permissions } = usePermissions();

  const toggleMenu = (title: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  // Don't render menu items until permissions are loaded
  // This prevents flickering where unauthorized items briefly appear
  const shouldShowMenu = !permissionsLoading && permissions !== null;

  return (
    <aside
      className="flex min-h-screen w-64 flex-col border-r border-gray-800"
      style={{ backgroundColor: "#240032" }}
    >
      <div className="border-b border-white/10 p-6">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-white/15 via-white/10 to-white/5 shadow-[0_12px_30px_rgba(15,23,42,0.35)] ring-1 ring-white/15">
            <Image
              src="/achlers_circle.png"
              alt="Achlers Logo"
              fill
              className="object-contain p-0"
            />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-semibold text-white">Achlers</h4>
            <p className="text-sm font-medium text-white/80">Integrated Sales</p>
            <div className="h-px w-10 bg-white/20" />
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/45">Inventory System</p>
          </div>
        </div>
      </div>

      {/* Business Unit Switcher */}
      <div className="border-b border-white/10 p-3">
        <BusinessUnitSwitcher />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
        {!shouldShowMenu ? (
          <div className="animate-pulse space-y-2 py-4">
            {/* Skeleton loader for menu items */}
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center gap-3 rounded-md px-3 py-2.5">
                  <div className="h-5 w-5 rounded bg-white/10"></div>
                  <div className="h-4 max-w-[120px] flex-1 rounded bg-white/10"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          menuItems.map((item) => {
            const Icon = item.icon;
            // Only highlight parent if it's an exact match (no children) or if it's a page without children
            const isParentActive = !item.children && pathname === item.href;
            const hasActiveChild = item.children?.some((child) => pathname === child.href);
            const isOpen = openMenus[item.title] ?? hasActiveChild;

            // For parent items with children, only show if user has access to at least one child
            if (item.children) {
              // Check if user has access to any child
              const hasAccessToAnyChild = item.children.some((child) =>
                can(child.resource, "view")
              );

              // Don't render parent if user has no access to any children
              if (!hasAccessToAnyChild) {
                return null;
              }

              return (
                <div key={item.href}>
                  <div>
                    <button
                      onClick={() => toggleMenu(item.title)}
                      className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5" />
                        {item.title}
                      </div>
                      <ChevronRight
                        className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")}
                      />
                    </button>

                    {isOpen && (
                      <div className="ml-8 mt-1 space-y-1">
                        {item.children.map((child) => {
                          // Only show child if user has permission
                          if (can(child.resource, "view")) {
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                className={cn(
                                  "block rounded-md px-3 py-2 text-sm transition-colors",
                                  pathname === child.href
                                    ? "bg-white/20 font-medium text-white"
                                    : "text-gray-300 hover:bg-white/10 hover:text-white"
                                )}
                              >
                                {child.title}
                              </Link>
                            );
                          }
                          return null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // For items without children, only show if user has permission
            if (can(item.resource!, "view")) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isParentActive
                      ? "bg-white/20 font-medium text-white"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.title}
                </Link>
              );
            }

            return null;
          })
        )}
      </nav>
    </aside>
  );
}
