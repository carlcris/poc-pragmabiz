"use client";

import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import type { StockMovementItem } from "@/types/warehouse-dashboard";
import { formatQuantity } from "./dashboard-formatting";

type StockMovementsListProps = {
  movements: StockMovementItem[];
  isLoading: boolean;
  locale: string;
};

type MovementKind = "in" | "out" | "transfer" | "adjustment" | "other";

const MOVEMENT_STYLES: Record<
  MovementKind,
  { icon: LucideIcon; iconClass: string; textClass: string }
> = {
  in: {
    icon: ArrowDown,
    iconClass: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400",
    textClass: "text-green-700 dark:text-green-400",
  },
  out: {
    icon: ArrowUp,
    iconClass: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
    textClass: "text-red-700 dark:text-red-400",
  },
  transfer: {
    icon: ArrowLeftRight,
    iconClass: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    textClass: "text-blue-700 dark:text-blue-400",
  },
  adjustment: {
    icon: SlidersHorizontal,
    iconClass: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
    textClass: "text-orange-700 dark:text-orange-400",
  },
  other: {
    icon: ArrowLeftRight,
    iconClass: "bg-muted text-muted-foreground",
    textClass: "text-muted-foreground",
  },
};

const toMovementKind = (type: string): MovementKind =>
  type === "in" || type === "out" || type === "transfer" || type === "adjustment" ? type : "other";

const SKELETON_ROW_COUNT = 5;

export const StockMovementsList = ({ movements, isLoading, locale }: StockMovementsListProps) => {
  const t = useTranslations("warehouseDashboard");
  const kindLabels: Record<MovementKind, string> = {
    in: t("movementType_in"),
    out: t("movementType_out"),
    transfer: t("movementType_transfer"),
    adjustment: t("movementType_adjustment"),
    other: t("movementType_other"),
  };

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return t("justNow");
    if (diffMins < 60) return t("minutesAgo", { count: diffMins });
    if (diffHours < 24) return t("hoursAgo", { count: diffHours });
    return date.toLocaleString(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Stock-out rows store a positive quantity; the sign comes from the movement kind.
  const formatSignedQuantity = (kind: MovementKind, qty: number) => {
    const amount = formatQuantity(Math.abs(qty), locale);
    if (kind === "in") return `+${amount}`;
    if (kind === "out") return `−${amount}`;
    return qty < 0 ? `−${amount}` : amount;
  };

  return (
    <section
      aria-labelledby="stock-movements-title"
      className="min-w-0 rounded-lg border bg-card shadow-sm"
    >
      <div className="border-b px-4 py-3 sm:px-5">
        <h2 id="stock-movements-title" className="text-base font-semibold">
          {t("recentStockMovements")}
        </h2>
      </div>
      {isLoading ? (
        <div className="divide-y">
          {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
            <div key={index} className="flex h-14 items-center gap-3 px-4 sm:px-5">
              <Skeleton className="h-7 w-7 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : movements.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          {t("noRecentStockMovements")}
        </p>
      ) : (
        <ul className="divide-y">
          {movements.map((movement, index) => {
            const kind = toMovementKind(movement.type);
            const style = MOVEMENT_STYLES[kind];
            const Icon = style.icon;
            return (
              <li
                key={`${movement.timestamp}-${index}`}
                className="flex min-h-14 items-center gap-3 px-4 py-2 sm:px-5"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${style.iconClass}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className="line-clamp-2 break-words text-sm font-medium"
                    title={movement.item_name}
                  >
                    {movement.item_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <span className={`font-semibold ${style.textClass}`}>{kindLabels[kind]}</span>
                    {" · "}
                    {movement.performed_by ?? t("unknownUser")}
                    {" · "}
                    <time dateTime={movement.timestamp}>
                      {formatRelativeTime(movement.timestamp)}
                    </time>
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums">
                  {formatSignedQuantity(kind, movement.qty)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">{movement.uom}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
