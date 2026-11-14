"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Lock, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { StockHealthCounts } from "@/types/warehouse-operations-overview";
import { formatQuantity } from "../dashboard-formatting";
import { OverviewCard } from "./OverviewCard";

type StockHealthSummaryProps = {
  health: StockHealthCounts;
  locale: string;
  className?: string;
};

type HealthPart = {
  key: keyof StockHealthCounts;
  label: string;
  count: number;
  color: string;
  icon: LucideIcon;
  iconClass: string;
};

export const StockHealthSummary = ({ health, locale, className }: StockHealthSummaryProps) => {
  const t = useTranslations("operationsOverview");
  const total = health.inStock + health.belowReorder + health.fullyReserved + health.outOfStock;
  const parts: HealthPart[] = [
    {
      key: "inStock",
      label: t("inStock"),
      count: health.inStock,
      color: "var(--chart-status-good)",
      icon: CheckCircle2,
      iconClass: "text-green-700 dark:text-green-400",
    },
    {
      key: "belowReorder",
      label: t("belowReorder"),
      count: health.belowReorder,
      color: "var(--chart-status-warning)",
      icon: AlertTriangle,
      iconClass: "text-amber-700 dark:text-amber-400",
    },
    {
      key: "fullyReserved",
      label: t("fullyReserved"),
      count: health.fullyReserved,
      color: "var(--chart-status-reserved)",
      icon: Lock,
      iconClass: "text-slate-600 dark:text-slate-400",
    },
    {
      key: "outOfStock",
      label: t("outOfStock"),
      count: health.outOfStock,
      color: "var(--chart-status-critical)",
      icon: AlertCircle,
      iconClass: "text-red-700 dark:text-red-400",
    },
  ];
  const visibleParts = parts.filter((part) => part.count > 0);
  const share = (count: number) => (total === 0 ? "0%" : `${Math.round((count / total) * 100)}%`);

  return (
    <OverviewCard
      titleId="stock-health-title"
      title={t("healthTitle")}
      subtitle={t("healthSubtitle")}
      className={className}
    >
      <p className="flex items-baseline gap-2 pb-3">
        <span className="text-3xl font-semibold leading-none">{formatQuantity(total, locale)}</span>
        <span className="text-sm text-muted-foreground">{t("itemsLabel")}</span>
      </p>
      <div
        role="img"
        aria-label={t("healthAria", {
          total,
          inStock: health.inStock,
          belowReorder: health.belowReorder,
          fullyReserved: health.fullyReserved,
          outOfStock: health.outOfStock,
        })}
        className="flex h-2 gap-0.5"
      >
        {visibleParts.map((part, index) => (
          <span
            key={part.key}
            className={
              visibleParts.length === 1
                ? "rounded-full"
                : index === 0
                  ? "rounded-l-full"
                  : index === visibleParts.length - 1
                    ? "rounded-r-full"
                    : undefined
            }
            style={{ flex: `${part.count} 1 0`, minWidth: "0.25rem", background: part.color }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-col">
        {parts.map((part) => (
          <li key={part.key} className="flex min-h-10 items-center gap-2.5 text-sm">
            <part.icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${part.iconClass}`} />
            <span className="flex-1 font-medium">{part.label}</span>
            <span className="font-semibold tabular-nums">{formatQuantity(part.count, locale)}</span>
            <span className="w-10 text-right tabular-nums text-muted-foreground">
              {share(part.count)}
            </span>
          </li>
        ))}
      </ul>
    </OverviewCard>
  );
};
