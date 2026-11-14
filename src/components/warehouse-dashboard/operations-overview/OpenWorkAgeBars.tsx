"use client";

import { useTranslations } from "next-intl";
import type { OpenWorkAge, OpenWorkAgeBuckets } from "@/types/warehouse-operations-overview";
import { formatQuantity } from "../dashboard-formatting";
import { OverviewCard } from "./OverviewCard";

type OpenWorkAgeBarsProps = {
  openWorkAge: OpenWorkAge;
  locale: string;
  className?: string;
};

// Ordinal ramp: older work is darker in light mode and brighter in dark mode.
const AGE_COLORS = [
  "var(--chart-age-1)",
  "var(--chart-age-2)",
  "var(--chart-age-3)",
  "var(--chart-age-4)",
] as const;

export const OpenWorkAgeBars = ({ openWorkAge, locale, className }: OpenWorkAgeBarsProps) => {
  const t = useTranslations("operationsOverview");
  const bucketLabels = [t("age_under1"), t("age_1to3"), t("age_4to7"), t("age_over7")];

  const rows = [
    { key: "pickLists", label: t("workPickLists"), buckets: openWorkAge.pickLists },
    { key: "stockRequests", label: t("workStockRequests"), buckets: openWorkAge.stockRequests },
    { key: "incoming", label: t("workIncoming"), buckets: openWorkAge.incoming },
  ].filter(
    (row): row is { key: string; label: string; buckets: OpenWorkAgeBuckets } =>
      row.buckets !== null
  );

  if (rows.length === 0) return null;

  const totals = rows.map((row) => row.buckets.reduce((sum, count) => sum + count, 0));
  const max = Math.max(1, ...totals);

  return (
    <OverviewCard
      titleId="open-work-age-title"
      title={t("workAgeTitle")}
      subtitle={t("workAgeSubtitle")}
      className={className}
    >
      <ul className="flex flex-wrap gap-x-3 gap-y-1 pb-3" aria-label={t("workAgeLegend")}>
        {bucketLabels.map((label, index) => (
          <li key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: AGE_COLORS[index] }}
            />
            {label}
          </li>
        ))}
      </ul>
      {totals.every((total) => total === 0) ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("noOpenWork")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row, rowIndex) => {
            const total = totals[rowIndex];
            const segments = row.buckets
              .map((count, index) => ({ count, index }))
              .filter((segment) => segment.count > 0);
            return (
              <li key={row.key} className="flex flex-col gap-1.5">
                <span className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-semibold tabular-nums">
                    {formatQuantity(total, locale)}
                  </span>
                </span>
                <span
                  role="img"
                  aria-label={t("workAgeAria", {
                    label: row.label,
                    under1: row.buckets[0],
                    d1to3: row.buckets[1],
                    d4to7: row.buckets[2],
                    over7: row.buckets[3],
                  })}
                  className="flex h-5 gap-0.5"
                  style={{ width: `${(total / max) * 100}%` }}
                >
                  {segments.map((segment, index) => (
                    <span
                      key={segment.index}
                      title={`${bucketLabels[segment.index]}: ${formatQuantity(segment.count, locale)}`}
                      className={index === segments.length - 1 ? "rounded-r" : undefined}
                      style={{
                        flex: `${segment.count} 1 0`,
                        background: AGE_COLORS[segment.index],
                      }}
                    />
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </OverviewCard>
  );
};
