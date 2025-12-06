"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, ShoppingCart, CheckCircle, BarChart3, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    href: "/mobile/van-sales/dashboard",
    label: "Dashboard",
    icon: BarChart3,
  },
  {
    href: "/mobile/van-sales/sell",
    label: "Sell",
    icon: ShoppingCart,
  },
  {
    href: "/mobile/view/loaded-items",
    label: "Inventory",
    icon: Package,
  },
  {
    href: "/mobile/van-sales/load",
    label: "Load",
    icon: Package,
  },
  {
    href: "/mobile/more",
    label: "More",
    icon: Menu,
  },
];

export function BottomNav() {
  const pathname = usePathname();

  // Hide navigation on login page
  if (pathname === "/mobile/login" || pathname === "/mobile") {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg">
      <div className="mx-auto max-w-md">
        <div className="flex justify-around items-center py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            // Check if current path matches or is a child of this nav item
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[60px] py-2 px-3 rounded-lg transition-all",
                  "active:scale-95 active:bg-gray-100",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                <Icon
                  className={cn(
                    "h-6 w-6 mb-1 transition-transform",
                    isActive && "scale-110"
                  )}
                />
                <span
                  className={cn(
                    "text-xs font-medium",
                    isActive && "font-bold"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Safe area for iOS devices */}
      <div className="h-[env(safe-area-inset-bottom)] bg-white" />
    </nav>
  );
}
