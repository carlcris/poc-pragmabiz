"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ShoppingBag,
  FileText,
  Settings,
  Warehouse,
  ChevronRight,
  BarChart3,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    title: "Inventory",
    icon: Package,
    href: "/inventory/items",
    children: [
      { title: "Item Master", href: "/inventory/items" },
      { title: "Warehouses", href: "/inventory/warehouses" },
      { title: "Stock Transactions", href: "/inventory/stock" },
      { title: "Stock Ledger", href: "/inventory/ledger" },
      { title: "Stock Adjustments", href: "/inventory/adjustments" },
      { title: "Reorder Management", href: "/inventory/reorder" },
    ],
  },
  {
    title: "Sales",
    icon: ShoppingCart,
    href: "/sales",
    children: [
      { title: "Point of Sale", href: "/sales/pos" },
      { title: "Customers", href: "/sales/customers" },
      { title: "Quotations", href: "/sales/quotations" },
      { title: "Sales Orders", href: "/sales/orders" },
      { title: "Invoices", href: "/sales/invoices" },
    ],
  },
  {
    title: "Purchasing",
    icon: ShoppingBag,
    href: "/purchasing",
    children: [
      { title: "Suppliers", href: "/purchasing/suppliers" },
      { title: "Purchase Orders", href: "/purchasing/orders" },
      { title: "Purchase Receipts", href: "/purchasing/receipts" },
    ],
  },
  {
    title: "Accounting",
    icon: Calculator,
    href: "/accounting",
    children: [
      { title: "Chart of Accounts", href: "/accounting/chart-of-accounts" },
      { title: "Journal Entries", href: "/accounting/journals" },
      { title: "General Ledger", href: "/accounting/ledger" },
    ],
  },
  {
    title: "Reports",
    icon: FileText,
    href: "/reports",
    children: [
      { title: "Sales Analytics", href: "/reports/sales-analytics" },
      { title: "Stock Reports", href: "/reports/stock" },
    ],
  },
  {
    title: "Settings",
    icon: Settings,
    href: "/settings",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const toggleMenu = (title: string) => {
    setOpenMenus(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 min-h-screen">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white">ERP System</h1>
        <p className="text-sm text-gray-400">Complete Business Solution</p>
      </div>

      <nav className="px-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(item.href.replace("/items", "") + "/");
          const isOpen = openMenus[item.title] ?? isActive;

          return (
            <div key={item.href}>
              {item.children ? (
                <div>
                  <button
                    onClick={() => toggleMenu(item.title)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5" />
                      {item.title}
                    </div>
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 transition-transform",
                        isOpen && "rotate-90"
                      )}
                    />
                  </button>

                  {isOpen && (
                    <div className="ml-8 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "block px-3 py-2 rounded-md text-sm transition-colors",
                            pathname === child.href
                              ? "bg-gray-800 text-white font-medium"
                              : "text-gray-400 hover:bg-gray-800 hover:text-white"
                          )}
                        >
                          {child.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.title}
                </Link>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
