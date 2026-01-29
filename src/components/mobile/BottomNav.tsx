"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, ShoppingCart, PackagePlus, Home, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isCenter?: boolean;
}

// Reorder: 2 items, center dashboard, 2 items
const navItems: NavItem[] = [
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
    href: "/mobile/van-sales/dashboard",
    label: "",
    icon: Home,
    isCenter: true,
  },
  {
    href: "/mobile/van-sales/load",
    label: "Load",
    icon: PackagePlus,
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
    <>
      {/* Backdrop shadow for elevated button */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 h-20">
        <div className="absolute -top-2 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full bg-white opacity-50 blur-xl" />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="relative mx-auto max-w-md">
          {/* Curved cutout background */}
          <div className="absolute -top-6 left-1/2 h-12 w-24 -translate-x-1/2 rounded-t-[50px] bg-white" />

          <div className="relative flex items-center px-3 py-1.5">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

              // Center button (elevated)
              if (item.isCenter) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-center transition-all",
                      "absolute -top-6 left-1/2 -translate-x-1/2",
                      "active:scale-90"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-20 w-20 items-center justify-center rounded-full transition-all",
                        "shadow-[0_8px_24px_rgba(0,0,0,0.15)]",
                        "border-4 border-white",
                        isActive
                          ? "bg-gradient-to-br from-primary to-primary/90"
                          : "bg-gradient-to-br from-primary to-primary/90 hover:scale-105"
                      )}
                    >
                      <Icon className="h-9 w-9 text-white" />
                    </div>
                  </Link>
                );
              }

              // Spacing configuration
              // index 0: Sell, index 1: Inventory, index 2: Home (center), index 3: Load, index 4: More
              const getSpacing = () => {
                if (index === 0) return "mr-auto"; // Sell - push to left
                if (index === 1) return "mr-16"; // Inventory - extra space before home
                if (index === 3) return "ml-16"; // Load - extra space after home
                if (index === 4) return "ml-auto"; // More - push to right
                return "";
              };

              // Regular nav items (skip rendering in center slot)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center py-1 transition-all",
                    "active:scale-90",
                    getSpacing(),
                    index === 2 && "pointer-events-none w-20 opacity-0" // Hide center placeholder but maintain space
                  )}
                >
                  <div
                    className={cn(
                      "mb-0.5 flex h-11 w-11 items-center justify-center rounded-xl transition-all",
                      isActive ? "bg-primary/10 text-primary" : "text-gray-400 hover:bg-gray-50"
                    )}
                  >
                    <Icon className={cn("transition-all", isActive ? "h-7 w-7" : "h-6 w-6")} />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] transition-all",
                      isActive ? "font-bold text-primary" : "font-medium text-gray-500"
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
    </>
  );
}
