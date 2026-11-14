"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ExpiringBatch, ExpiringBatches } from "@/types/warehouse-operations-overview";
import { formatQuantity, formatShortDate, parseDashboardDate } from "../dashboard-formatting";
import { OverviewCard } from "./OverviewCard";

type ExpiringBatchesListProps = {
  expiring: ExpiringBatches;
  locale: string;
  className?: string;
};

// Listed batches expire today or later; expired stock is only counted.
const statusToneClass = (daysLeft: number) => {
  if (daysLeft <= 7) return "font-semibold text-orange-700 dark:text-orange-400";
  if (daysLeft <= 30) return "font-semibold text-amber-700 dark:text-amber-400";
  return "text-muted-foreground";
};

export const ExpiringBatchesList = ({ expiring, locale, className }: ExpiringBatchesListProps) => {
  const t = useTranslations("operationsOverview");

  const statusLabel = (batch: ExpiringBatch) => {
    if (batch.daysLeft === 0) return t("expiresToday");
    return t("daysLeft", { count: batch.daysLeft });
  };
  const quantity = (batch: ExpiringBatch) =>
    `${formatQuantity(batch.qtyOnHand, locale)}${batch.uom ? ` ${batch.uom}` : ""}`;
  const expiryDate = (batch: ExpiringBatch) =>
    formatShortDate(parseDashboardDate(batch.expirationDate), locale);

  const renderStatus = (batch: ExpiringBatch) => (
    <span className={cn("whitespace-nowrap text-sm", statusToneClass(batch.daysLeft))}>
      {statusLabel(batch)}
    </span>
  );

  return (
    <OverviewCard
      titleId="expiring-batches-title"
      title={t("expiringTitle")}
      subtitle={
        <>
          {t("expiringSubtitle")}
          {expiring.expired > 0 ? (
            <>
              {" · "}
              <span className="font-semibold text-red-700 dark:text-red-400">
                {t("expiredCount", { count: expiring.expired })}
              </span>
            </>
          ) : null}
          {expiring.withinSevenDays > 0
            ? ` · ${t("withinSevenDays", { count: expiring.withinSevenDays })}`
            : null}
        </>
      }
      className={className}
      bodyClassName="px-0 pb-0 sm:px-0"
    >
      {expiring.batches.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
          {t("noExpiringBatches")}
        </p>
      ) : (
        <>
          <ul className="divide-y border-t lg:hidden">
            {expiring.batches.map((batch) => (
              <li key={batch.batchId}>
                <Link
                  href={`/inventory/items/${batch.itemId}`}
                  className="flex min-h-16 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="line-clamp-2 break-words text-sm font-medium">
                        {batch.itemName}
                      </span>
                      {renderStatus(batch)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {batch.batchCode} · {batch.warehouseCode} · {quantity(batch)} ·{" "}
                      <span className="whitespace-nowrap">
                        {t("expiresOn", { date: expiryDate(batch) })}
                      </span>
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>

          <table className="hidden w-full text-sm lg:table">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="px-5 py-2 font-medium">
                  {t("itemColumn")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("batchColumn")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("warehouseColumn")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("onHandColumn")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("expiresColumn")}
                </th>
                <th scope="col" className="px-5 py-2 font-medium">
                  {t("statusColumn")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y border-t">
              {expiring.batches.map((batch) => (
                <tr key={batch.batchId} className="transition-colors hover:bg-muted/50">
                  <td className="px-5 py-2.5">
                    <Link
                      href={`/inventory/items/${batch.itemId}`}
                      className="line-clamp-2 break-words font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {batch.itemName}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    {batch.batchCode}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    {batch.warehouseCode}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                    {quantity(batch)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">{expiryDate(batch)}</td>
                  <td className="px-5 py-2.5">{renderStatus(batch)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
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
