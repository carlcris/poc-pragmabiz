"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQuantity } from "./dashboard-formatting";

export type DashboardSummaryMetric = {
  key: string;
  href: string;
  count: number;
  label: string;
  hint: string;
  urgentCount?: number;
};

type DashboardSummaryStripProps = {
  metrics: DashboardSummaryMetric[];
  isLoading: boolean;
  locale: string;
};

export const DashboardSummaryStrip = ({
  metrics,
  isLoading,
  locale,
}: DashboardSummaryStripProps) => {
  const t = useTranslations("dashboardPage");
  const columnCount = isLoading ? 3 : metrics.length;

  if (!isLoading && metrics.length === 0) return null;

  return (
    <section
      aria-label={t("summaryLabel")}
      className="grid divide-x overflow-hidden rounded-lg border bg-card shadow-sm"
      style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
    >
      {isLoading
        ? Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex min-h-20 flex-col gap-2 p-3 sm:p-4">
              <Skeleton className="h-6 w-8" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))
        : metrics.map((metric) => (
            <Link
              key={metric.key}
              href={metric.href}
              className="group flex min-h-20 min-w-0 flex-col gap-0.5 p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-4 lg:flex-row lg:items-center lg:gap-4 lg:px-5"
            >
              <span className="text-2xl font-semibold tabular-nums leading-none lg:min-w-10 lg:text-3xl">
                {formatQuantity(metric.count, locale)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold lg:text-base">{metric.label}</span>
                <span className="text-xs text-muted-foreground sm:text-sm">
                  <span className="hidden lg:inline">{metric.hint}</span>
                  {metric.urgentCount ? (
                    <>
                      <span className="hidden lg:inline"> · </span>
                      <span className="font-semibold text-red-700 dark:text-red-400">
                        {t("urgentCount", { count: metric.urgentCount })}
                      </span>
                    </>
                  ) : null}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="hidden h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 lg:block"
              />
            </Link>
          ))}
    </section>
  );
};
