"use client";

import Link from "next/link";
import { AlertCircle, AlertTriangle, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LowStockItem, OutOfStockItem } from "@/types/warehouse-dashboard";
import { formatQuantity } from "./dashboard-formatting";

type StockAttentionPanelProps = {
  outOfStocks: OutOfStockItem[];
  lowStocks: LowStockItem[];
  showOutOfStock: boolean;
  showLowStock: boolean;
  isLoading: boolean;
  locale: string;
};

type StockAttentionRow = {
  itemId: string;
  name: string;
  locationCode: string | null;
  quantity: string;
  detail: string | null;
};

const SKELETON_ROW_COUNT = 3;

export const StockAttentionPanel = ({
  outOfStocks,
  lowStocks,
  showOutOfStock,
  showLowStock,
  isLoading,
  locale,
}: StockAttentionPanelProps) => {
  const t = useTranslations("warehouseDashboard");

  if (!showOutOfStock && !showLowStock) return null;

  const outOfStockRows: StockAttentionRow[] = outOfStocks.map((item) => ({
    itemId: item.item_id,
    name: item.item_name,
    locationCode: item.location_code,
    quantity: `${formatQuantity(item.qty, locale)} ${item.uom}`,
    detail: null,
  }));
  const lowStockRows: StockAttentionRow[] = lowStocks.map((item) => ({
    itemId: item.item_id,
    name: item.item_name,
    locationCode: item.location_code,
    quantity: `${formatQuantity(item.qty, locale)} ${item.uom}`,
    detail: t("reorderAt", { qty: formatQuantity(item.reorder_level, locale) }),
  }));

  const groups = [
    showOutOfStock && {
      key: "out",
      title: t("outOfStock"),
      icon: AlertCircle,
      toneClass: "text-red-700 dark:text-red-400",
      rows: outOfStockRows,
      emptyMessage: t("noOutOfStockItems"),
    },
    showLowStock && {
      key: "low",
      title: t("belowReorder"),
      icon: AlertTriangle,
      toneClass: "text-amber-700 dark:text-amber-400",
      rows: lowStockRows,
      emptyMessage: t("noLowStockItems"),
    },
  ].filter((group): group is Exclude<typeof group, false> => Boolean(group));

  return (
    <section
      aria-labelledby="stock-attention-title"
      className="min-w-0 rounded-lg border bg-card shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <h2 id="stock-attention-title" className="text-base font-semibold">
          {t("stockAttention")}
        </h2>
        <Link
          href="/inventory/items"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9"
        >
          {t("viewAllInventory")}
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>

      <div
        className={cn(
          "grid divide-y",
          groups.length > 1 &&
            "md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-1 xl:divide-x-0 xl:divide-y"
        )}
      >
        {groups.map((group) => (
          <div key={group.key} className="min-w-0 py-2">
            <h3
              className={`flex items-center gap-2 px-4 py-1.5 text-sm font-semibold sm:px-5 ${group.toneClass}`}
            >
              <group.icon aria-hidden="true" className="h-4 w-4" />
              {group.title}
            </h3>
            {isLoading ? (
              <div className="space-y-1 px-4 sm:px-5">
                {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                  <div key={index} className="flex h-14 items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            ) : group.rows.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground sm:px-5">
                {group.emptyMessage}
              </p>
            ) : (
              <ul>
                {group.rows.map((row) => (
                  <li key={row.itemId}>
                    <Link
                      href={`/inventory/items/${row.itemId}`}
                      className="flex min-h-14 items-center justify-between gap-3 px-4 py-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span
                          className="line-clamp-2 break-words text-sm font-medium"
                          title={row.name}
                        >
                          {row.name}
                        </span>
                        {row.locationCode ? (
                          <span className="text-xs text-muted-foreground">{row.locationCode}</span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 flex-col items-end text-right">
                        <span
                          className={`whitespace-nowrap text-sm font-semibold tabular-nums ${group.toneClass}`}
                        >
                          {row.quantity}
                        </span>
                        {row.detail ? (
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {row.detail}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
