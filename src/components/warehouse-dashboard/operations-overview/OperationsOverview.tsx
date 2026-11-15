"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { useWarehouseOperationsOverview } from "@/hooks/useWarehouseOperationsOverview";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { cn } from "@/lib/utils";
import type { OperationsOverviewRange } from "@/types/warehouse-operations-overview";
import { ExpectedArrivalsChart } from "./ExpectedArrivalsChart";
import { ExpiringBatchesList } from "./ExpiringBatchesList";
import { InboundPipelineBars } from "./InboundPipelineBars";
import { OpenWorkAgeBars } from "./OpenWorkAgeBars";
import { SlowMovingStockList } from "./SlowMovingStockList";
import { StockHealthSummary } from "./StockHealthSummary";
import { StockMovementTrendChart } from "./StockMovementTrendChart";

type OperationsOverviewProps = {
  locale: string;
};

type RangeValue = "7" | "14" | "30";

export const OperationsOverview = ({ locale }: OperationsOverviewProps) => {
  const t = useTranslations("operationsOverview");
  const [range, setRange] = useState<RangeValue>("14");
  const days = Number(range) as OperationsOverviewRange;
  const isSwitching = useBusinessUnitStore((state) => state.isSwitching);
  const {
    data: overview,
    error,
    isPending,
    isPlaceholderData,
    refetch,
  } = useWarehouseOperationsOverview(days);
  const data = isSwitching ? undefined : overview;

  const rangeOptions = [
    { value: "7" as const, label: t("range7") },
    { value: "14" as const, label: t("range14") },
    { value: "30" as const, label: t("range30") },
  ];

  const hasWorkAge =
    data &&
    (data.openWorkAge.pickLists !== null ||
      data.openWorkAge.stockRequests !== null ||
      data.openWorkAge.incoming !== null);
  const hasAnySection =
    data &&
    (data.stockMovements ||
      data.stockHealth ||
      data.inbound ||
      hasWorkAge ||
      data.expiringBatches ||
      data.slowMoving);

  // Nothing this user may see: leave no empty section behind.
  if (data && !hasAnySection) return null;

  return (
    <section aria-labelledby="operations-overview-title" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="operations-overview-title" className="text-lg font-semibold tracking-tight">
          {t("title")}
        </h2>
        <SegmentedControl
          aria-label={t("rangeLabel")}
          value={range}
          options={rangeOptions}
          onChange={setRange}
          className="w-full sm:w-auto"
          optionClassName="min-h-11 flex-1 sm:flex-none lg:min-h-0"
        />
      </div>

      {!isSwitching && error && !data ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("loadErrorTitle")}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{t("loadError")}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 lg:h-9"
              onClick={() => refetch()}
            >
              {t("retry")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : isPending || !data ? (
        <div aria-busy="true" className="grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
          <Skeleton className="h-80 rounded-lg md:col-span-2" />
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-4 transition-opacity md:grid-cols-2 md:gap-6 xl:grid-cols-3",
            isPlaceholderData && "opacity-60"
          )}
          aria-busy={isPlaceholderData}
        >
          {data.stockMovements ? (
            <StockMovementTrendChart
              days={data.stockMovements}
              rangeDays={data.days}
              locale={locale}
              className="md:col-span-2"
            />
          ) : null}
          {data.stockHealth ? (
            <StockHealthSummary health={data.stockHealth} locale={locale} />
          ) : null}
          {data.inbound ? <ExpectedArrivalsChart inbound={data.inbound} locale={locale} /> : null}
          {data.inbound ? <InboundPipelineBars inbound={data.inbound} locale={locale} /> : null}
          {hasWorkAge ? <OpenWorkAgeBars openWorkAge={data.openWorkAge} locale={locale} /> : null}
          {data.expiringBatches ? (
            <ExpiringBatchesList
              expiring={data.expiringBatches}
              locale={locale}
              className="md:col-span-2"
            />
          ) : null}
          {data.slowMoving ? (
            <SlowMovingStockList
              slowMoving={data.slowMoving}
              locale={locale}
              className="md:col-span-2 xl:col-span-1"
            />
          ) : null}
        </div>
      )}
    </section>
  );
};
