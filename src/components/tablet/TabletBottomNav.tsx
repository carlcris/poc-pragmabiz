"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PackageOpen, LayoutDashboard, PackagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isCenter?: boolean;
}

// 3-item navigation: Receiving | Dashboard | Picking
const navItems: NavItem[] = [
  {
    href: "/tablet/receiving",
    label: "Receiving",
    icon: PackageOpen,
  },
  {
    href: "/tablet",
    label: "",
    icon: LayoutDashboard,
    isCenter: true,
  },
  {
    href: "/tablet/picking",
    label: "Picking",
    icon: PackagePlus,
  },
];

export function TabletBottomNav() {
  const pathname = usePathname();

  // Hide navigation on login page
  if (pathname === "/tablet/login") {
    return null;
  }

  return (
    <>
      {/* Backdrop shadow for elevated button */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 h-20">
        <div className="absolute -top-2 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full bg-white opacity-50 blur-xl" />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="relative mx-auto max-w-2xl">
          {/* Curved cutout background */}
          <div className="absolute -top-6 left-1/2 h-12 w-24 -translate-x-1/2 rounded-t-[50px] bg-white" />

          <div className="relative flex items-center justify-between px-8 py-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                (item.href === "/tablet" && pathname === "/tablet") ||
                (item.href !== "/tablet" &&
                  (pathname === item.href || pathname.startsWith(item.href + "/")));

              // Center button (elevated Dashboard)
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

              // Regular nav items (Receiving and Picking)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center py-1 transition-all",
                    "active:scale-90",
                    "w-24" // Fixed width for consistent spacing
                  )}
                >
                  <div
                    className={cn(
                      "mb-1 flex h-12 w-12 items-center justify-center rounded-xl transition-all",
                      isActive ? "bg-primary/10 text-primary" : "text-gray-400 hover:bg-gray-50"
                    )}
                  >
                    <Icon className={cn("transition-all", isActive ? "h-7 w-7" : "h-6 w-6")} />
                  </div>
                  <span
                    className={cn(
                      "text-xs transition-all",
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
