"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SlowMovingStock } from "@/types/warehouse-operations-overview";
import { formatQuantity } from "../dashboard-formatting";
import { OverviewCard } from "./OverviewCard";

type SlowMovingStockListProps = {
  slowMoving: SlowMovingStock;
  locale: string;
  className?: string;
};

export const SlowMovingStockList = ({
  slowMoving,
  locale,
  className,
}: SlowMovingStockListProps) => {
  const t = useTranslations("operationsOverview");

  return (
    <OverviewCard
      titleId="slow-moving-title"
      title={t("slowTitle")}
      subtitle={t("slowSubtitle")}
      className={className}
      bodyClassName="px-0 pb-0 sm:px-0"
    >
      <p className="flex items-baseline gap-2 px-4 pb-2 sm:px-5">
        <span className="text-3xl font-semibold leading-none">
          {formatQuantity(slowMoving.total, locale)}
        </span>
        <span className="text-sm text-muted-foreground">{t("slowItemsLabel")}</span>
      </p>
      {slowMoving.items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground sm:px-5">
          {t("noSlowMoving")}
        </p>
      ) : (
        <ul className="divide-y border-t">
          {slowMoving.items.map((item) => (
            <li key={item.itemId}>
              <Link
                href={`/inventory/items/${item.itemId}`}
                className="flex min-h-14 items-center justify-between gap-3 px-4 py-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="line-clamp-2 break-words text-sm font-medium">
                    {item.itemName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatQuantity(item.onHand, locale)}
                    {item.uom ? ` ${item.uom}` : ""}
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-sm font-semibold">
                  {item.daysIdle === null
                    ? t("neverMoved")
                    : t("daysIdle", { count: item.daysIdle })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex justify-end border-t px-4 py-1 sm:px-5">
        <Link
          href="/reports"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9"
        >
          {t("openReports")}
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </OverviewCard>
  );
};
