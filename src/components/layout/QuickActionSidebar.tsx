"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ClipboardPlus,
  FilePlus2,
  PackagePlus,
  ShoppingCart,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { RESOURCES, type Resource } from "@/constants/resources";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import type { UserPermissions } from "@/types/rbac";

type QuickAction = {
  labelKey:
    | "addItem"
    | "newStockRequisition"
    | "newStockRequest"
    | "newQuotation"
    | "newSalesOrder";
  href: string;
  activePath?: string;
  icon: LucideIcon;
  resource: Resource;
};

const quickActions: QuickAction[] = [
  {
    labelKey: "addItem",
    href: "/inventory/items/create",
    activePath: "/inventory/items/create",
    icon: PackagePlus,
    resource: RESOURCES.ITEMS,
  },
  {
    labelKey: "newStockRequisition",
    href: "/purchasing/stock-requisitions?create=1",
    icon: ClipboardPlus,
    resource: RESOURCES.STOCK_REQUISITIONS,
  },
  {
    labelKey: "newStockRequest",
    href: "/inventory/stock-requests?create=1",
    icon: PackagePlus,
    resource: RESOURCES.STOCK_REQUESTS,
  },
  {
    labelKey: "newQuotation",
    href: "/sales/quotations/create",
    activePath: "/sales/quotations/create",
    icon: FilePlus2,
    resource: RESOURCES.SALES_QUOTATIONS,
  },
  {
    labelKey: "newSalesOrder",
    href: "/sales/orders/create",
    activePath: "/sales/orders/create",
    icon: ShoppingCart,
    resource: RESOURCES.SALES_ORDERS,
  },
];

type QuickActionSidebarProps = {
  initialPermissions?: UserPermissions | null;
};

export function QuickActionSidebar({ initialPermissions = null }: QuickActionSidebarProps) {
  const t = useTranslations("quickActions");
  const pathname = usePathname();
  const [hasMounted, setHasMounted] = useState(false);
  const { permissions } = usePermissions();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const effectivePermissions = hasMounted
    ? (permissions ?? initialPermissions)
    : initialPermissions;
  const visibleActions = quickActions.filter((action) => {
    const permission = effectivePermissions?.[action.resource];
    return permission?.can_view && permission.can_create;
  });

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <aside
      aria-label={t("label")}
      className="hidden w-16 shrink-0 flex-col items-center border-l border-border bg-card/80 py-4 lg:flex"
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <Zap className="h-4 w-4" />
      </div>
      <div className="my-4 h-px w-8 bg-border" />
      <nav aria-label={t("label")} className="flex flex-col items-center gap-2">
        {visibleActions.map((action) => {
          const Icon = action.icon;
          const label = t(action.labelKey);
          const isActive = action.activePath ? pathname === action.activePath : false;

          return (
            <div key={action.labelKey} className="group relative">
              <Link
                href={action.href}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition-colors",
                  "hover:border-primary/20 hover:bg-primary/10 hover:text-primary",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive && "border-primary/20 bg-primary/10 text-primary"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="sr-only">{label}</span>
              </Link>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-full top-1/2 z-40 mr-3 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-md border border-border bg-popover px-3 py-2 text-xs font-medium text-popover-foreground opacity-0 shadow-md transition-all group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:translate-x-0 group-hover:opacity-100"
              >
                {label}
              </span>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
