"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ShoppingBag,
  FileText,
  Settings,
  ChevronRight,
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
      { title: "POS Transactions", href: "/sales/pos/transactions" },
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
      { title: "Trial Balance", href: "/accounting/trial-balance" },
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
    <aside className="w-64 border-r border-gray-800 min-h-screen flex flex-col" style={{ backgroundColor: '#240032' }}>
      <div className="p-6 flex items-center gap-3 border-b border-white/10">
        <div className="w-12 h-12 relative flex-shrink-0">
          <Image
            src="/erp.png"
            alt="ERP Logo"
            fill
            className="object-contain"
          />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">PragmaERP</h1>
          <p className="text-xs text-gray-400">Business Solution</p>
        </div>
      </div>

      <nav className="px-3 space-y-1 overflow-y-auto flex-1 pb-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          // Only highlight parent if it's an exact match (no children) or if it's a page without children
          const isParentActive = !item.children && pathname === item.href;
          const hasActiveChild = item.children?.some(child => pathname === child.href);
          const isOpen = openMenus[item.title] ?? hasActiveChild;

          return (
            <div key={item.href}>
              {item.children ? (
                <div>
                  <button
                    onClick={() => toggleMenu(item.title)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-300 hover:bg-white/10 hover:text-white"
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
                              ? "bg-white/20 text-white font-medium"
                              : "text-gray-300 hover:bg-white/10 hover:text-white"
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
                    isParentActive
                      ? "bg-white/20 text-white font-medium"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
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
