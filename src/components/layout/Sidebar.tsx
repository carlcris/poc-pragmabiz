"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  FileText,
  Shield,
  Menu,
  X,
  Warehouse,
  ArrowRightLeft,
  Settings,
  ClipboardList,
  Truck,
  List,
  Repeat,
  AlertCircle,
  Users,
  Building2,
  PackageCheck,
  BarChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BusinessUnitSwitcher } from "@/components/business-unit/BusinessUnitSwitcher";
import { usePermissions } from "@/hooks/usePermissions";
import { RESOURCES } from "@/constants/resources";
import { useSidebarStore } from "@/stores/sidebarStore";
import type { Resource } from "@/constants/resources";
import type { UserPermissions } from "@/types/rbac";

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
      { title: "Item Master", href: "/inventory/items", resource: RESOURCES.ITEMS as Resource, icon: Package },
      {
        title: "Warehouses",
        href: "/inventory/warehouses",
        resource: RESOURCES.WAREHOUSES as Resource,
        icon: Warehouse,
      },
      {
        title: "Stock Transactions",
        href: "/inventory/stock",
        resource: RESOURCES.STOCK_TRANSFERS as Resource,
        icon: ArrowRightLeft,
      },
      {
        title: "Stock Adjustments",
        href: "/inventory/adjustments",
        resource: RESOURCES.STOCK_ADJUSTMENTS as Resource,
        icon: Settings,
      },
      {
        title: "Stock Requests",
        href: "/inventory/stock-requests",
        resource: RESOURCES.STOCK_REQUESTS as Resource,
        icon: ClipboardList,
      },
      {
        title: "Delivery Notes",
        href: "/inventory/delivery-notes",
        resource: RESOURCES.STOCK_REQUESTS as Resource,
        icon: Truck,
      },
      {
        title: "Pick Lists",
        href: "/inventory/pick-lists",
        resource: RESOURCES.STOCK_REQUESTS as Resource,
        icon: List,
      },
      {
        title: "Stock Transformations",
        href: "/inventory/transformations",
        resource: RESOURCES.STOCK_TRANSFORMATIONS as Resource,
        icon: Repeat,
      },
      {
        title: "Reorder Management",
        href: "/inventory/reorder",
        resource: RESOURCES.REORDER_MANAGEMENT as Resource,
        icon: AlertCircle,
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
        title: "Overview",
        href: "/purchasing/overview",
        resource: RESOURCES.DASHBOARD as Resource,
        icon: LayoutDashboard,
      },
      {
        title: "Suppliers",
        href: "/purchasing/suppliers",
        resource: RESOURCES.SUPPLIERS as Resource,
        icon: Building2,
      },
      {
        title: "Stock Requisitions",
        href: "/purchasing/stock-requisitions",
        resource: RESOURCES.STOCK_REQUISITIONS as Resource,
        icon: ClipboardList,
      },
      {
        title: "Load Lists",
        href: "/purchasing/load-lists",
        resource: RESOURCES.LOAD_LISTS as Resource,
        icon: Truck,
      },
      {
        title: "Goods Receipt Notes",
        href: "/purchasing/grns",
        resource: RESOURCES.GOODS_RECEIPT_NOTES as Resource,
        icon: PackageCheck,
      },
      // {
      //   title: "Putaway Station",
      //   href: "/purchasing/grns/putaway",
      //   resource: RESOURCES.GOODS_RECEIPT_NOTES as Resource,
      // },
      // {
      //   title: "Purchase Orders",
      //   href: "/purchasing/orders",
      //   resource: RESOURCES.PURCHASE_ORDERS as Resource,
      // },
      // {
      //   title: "Purchase Receipts",
      //   href: "/purchasing/receipts",
      //   resource: RESOURCES.PURCHASE_RECEIPTS as Resource,
      // },
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
      { title: "Reports Directory", href: "/reports", resource: RESOURCES.REPORTS as Resource, icon: LayoutDashboard },
      //{ title: "Sales Analytics", href: "/reports/sales-analytics", resource: RESOURCES.REPORTS as Resource },
      { title: "Stock Reports", href: "/reports/stock", resource: RESOURCES.REPORTS as Resource, icon: BarChart },
      //{ title: "Commission Reports", href: "/reports/commission", resource: RESOURCES.REPORTS as Resource },
    ],
  },
  {
    title: "Admin",
    icon: Shield,
    href: "/admin",
    children: [
      { title: "Users", href: "/admin/users", resource: RESOURCES.USERS as Resource, icon: Users },
      { title: "Roles", href: "/admin/roles", resource: RESOURCES.ROLES as Resource, icon: Shield },
      {
        title: "Company Settings",
        href: "/admin/settings",
        resource: RESOURCES.COMPANY_SETTINGS as Resource,
        icon: Settings,
      },
      {
        title: "Business Units",
        href: "/admin/business-units",
        resource: RESOURCES.BUSINESS_UNITS as Resource,
        icon: Building2,
      },
    ],
  },
];

type SidebarProps = {
  initialPermissions?: UserPermissions | null;
  initialBusinessUnitName?: string | null;
};

export function Sidebar({
  initialPermissions = null,
  initialBusinessUnitName = null,
}: SidebarProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const isOpen = useSidebarStore((state) => state.isOpen);
  const {
    isLoading: permissionsLoading,
    permissions,
    error: permissionsError,
  } = usePermissions();

  // Ensure first client render matches server-rendered HTML to avoid hydration mismatch.
  // After mount, switch to live client permission state (with server snapshot as fallback).
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const effectivePermissions = hasMounted ? permissions ?? initialPermissions : initialPermissions;
  const sidebarOpen = hasMounted ? isOpen : true;
  const canViewResource = (resource: Resource) => Boolean(effectivePermissions?.[resource]?.can_view);

  // Don't render menu items until permissions are loaded
  // If cached permissions exist (persisted), render immediately and refresh in background.
  const shouldShowMenu = effectivePermissions !== null;

  return (
    <aside
      className={cn(
        "flex w-full flex-col border-b border-gray-800 transition-all duration-300",
        "md:min-h-screen md:border-b-0 md:border-r",
        sidebarOpen ? "md:w-64" : "md:w-20"
      )}
      style={{ backgroundColor: "#240032" }}
    >
      <div className="border-b border-white/10 p-4 md:p-6">
        <div className={cn("flex items-center gap-4", sidebarOpen ? "justify-between" : "md:justify-center")}>
          <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-white/15 via-white/10 to-white/5 shadow-[0_12px_30px_rgba(15,23,42,0.35)] ring-1 ring-white/15">
            <Image
              src="/achlers_circle.png"
              alt="Achlers Logo"
              fill
              className="object-contain p-0"
            />
          </div>
          <div className={cn("space-y-1", !sidebarOpen && "hidden md:hidden")}>
            <h4 className="text-base font-semibold text-white">Achlers</h4>
            <p className="text-sm font-medium text-white/80">Integrated Sales</p>
            <div className="h-px w-10 bg-white/20" />
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/45">Inventory System</p>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileOpen((prev) => !prev)}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 text-white/80 transition-colors hover:bg-white/10 md:hidden",
              sidebarOpen ? "ml-auto" : ""
            )}
            aria-label={isMobileOpen ? "Close menu" : "Open menu"}
          >
            {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-200 md:flex md:min-h-0 md:flex-1 md:flex-col md:overflow-visible",
          isMobileOpen ? "max-h-[calc(100vh-6.5rem)] opacity-100" : "max-h-0 opacity-0",
          "md:max-h-none md:opacity-100"
        )}
      >
        {/* Business Unit Switcher */}
        <div className={cn("border-b border-white/10 p-3", !sidebarOpen && "hidden md:hidden")}>
          <BusinessUnitSwitcher initialBusinessUnitName={initialBusinessUnitName} />
        </div>

        <nav
          className="scrollbar-hide flex-1 space-y-1 overflow-y-auto px-3 pb-6 md:min-h-0"
          suppressHydrationWarning
        >
          {!shouldShowMenu ? (
            permissionsLoading || !permissionsError ? (
              <div className="animate-pulse space-y-2 py-4">
                {/* Skeleton loader for menu items */}
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center gap-3 rounded-md px-3 py-2.5">
                      <div className="h-5 w-5 rounded bg-white/10"></div>
                      <div className={cn("h-4 max-w-[120px] flex-1 rounded bg-white/10", !sidebarOpen && "hidden md:hidden")}></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={cn("px-3 py-4 text-sm text-white/70", !sidebarOpen && "hidden md:hidden")}>Unable to load menu permissions.</div>
            )
          ) : (
            <>
              {/* Mobile and Desktop Expanded view - show full menu with text */}
              <div className={cn(!sidebarOpen && "hidden md:hidden")}>
                {menuItems.map((item) => {
              const Icon = item.icon;
              const isParentActive = !item.children && pathname === item.href;

              if (item.children) {
                const visibleChildren = item.children.filter((child) => canViewResource(child.resource));
                if (visibleChildren.length === 0) {
                  return null;
                }

                return (
                  <div key={item.href} className="pt-2">
                    <div className="px-3 pb-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                        {item.title}
                      </div>
                    </div>
                    <div className="space-y-1 pl-4">
                      {visibleChildren.map((child) => {
                        const ChildIcon = child.icon;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setIsMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                              pathname === child.href
                                ? "bg-white/20 font-medium text-white"
                                : "text-gray-300 hover:bg-white/10 hover:text-white"
                            )}
                          >
                            {ChildIcon && <ChildIcon className="h-4 w-4" />}
                            {child.title}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              if (canViewResource(item.resource!)) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isParentActive
                        ? "bg-white/20 font-medium text-white"
                        : "text-gray-300 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                );
              }

              return null;
                })}
              </div>

              {/* Desktop Collapsed view - show only icons */}
              <div className={cn("hidden", !sidebarOpen && "md:flex md:flex-col md:items-center md:space-y-2 md:py-4")}>
              {menuItems.map((item) => {
                const Icon = item.icon;

                if (item.children) {
                  const visibleChildren = item.children.filter((child) => canViewResource(child.resource));
                  if (visibleChildren.length === 0) {
                    return null;
                  }

                  // For parent items with children, show all child icons
                  return visibleChildren.map((child) => {
                    const ChildIcon = child.icon;
                    if (!ChildIcon) return null;

                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        title={child.title}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-md transition-colors",
                          pathname === child.href
                            ? "bg-white/20 text-white"
                            : "text-gray-300 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <ChildIcon className="h-5 w-5" />
                      </Link>
                    );
                  });
                }

                if (canViewResource(item.resource!)) {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.title}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-md transition-colors",
                        isActive
                          ? "bg-white/20 text-white"
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </Link>
                  );
                }

                return null;
              })}
              </div>
            </>
          )}
        </nav>
      </div>
    </aside>
  );
}
