import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStockInTransitItemArrivals } from "@/hooks/useStockInTransitItemArrivals";
import { groupStockInTransitArrivals } from "@/lib/stock-in-transit-arrival-groups";
import { cn } from "@/lib/utils";
import type { StockInTransitItemRow } from "@/types/stock-in-transit";
import { StockInTransitArrivalTimeline } from "./StockInTransitArrivalTimeline";
import { ARRIVAL_WINDOW_ORDER, ARRIVAL_WINDOW_STYLES, useArrivalLabels } from "./useArrivalLabels";

type StockInTransitItemDetailProps = {
  item: StockInTransitItemRow;
  companyId?: string;
  isEnabled: boolean;
};

export function StockInTransitItemDetail({
  item,
  companyId,
  isEnabled,
}: StockInTransitItemDetailProps) {
  const t = useTranslations("stockInTransitPage");
  const { arrivalWindowLabels, formatDistinctBaseQuantity, formatOrderedQuantities } =
    useArrivalLabels();
  const query = useStockInTransitItemArrivals(item.itemId, { enabled: isEnabled, companyId });
  const pages = query.data?.pages;
  const groups = useMemo(
    () => groupStockInTransitArrivals(pages?.flatMap((page) => page.data) ?? []),
    [pages]
  );
  const summary = pages?.[0]?.summary;
  const unitName = item.baseUnitName ?? t("baseUnits");
  const totalBaseQuantity = formatDistinctBaseQuantity(
    item.orderedUnitTotals,
    item.totalBaseQuantity,
    unitName
  );
  const arrivalMix = ARRIVAL_WINDOW_ORDER.flatMap((arrivalWindow) => {
    const quantity = summary?.arrivalWindowTotals[arrivalWindow] ?? 0;
    const orderedUnitTotals = summary?.arrivalWindowOrderedUnitTotals[arrivalWindow] ?? [];
    return quantity > 0
      ? [
          {
            arrivalWindow,
            quantity,
            orderedUnitTotals,
            baseQuantity: formatDistinctBaseQuantity(orderedUnitTotals, quantity, unitName),
          },
        ]
      : [];
  });

  return (
    <section aria-label={t("selectedItemDetails")} className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href={`/inventory/items/${item.itemId}`}
            className="text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300"
          >
            {item.itemCode}
          </Link>
          <h2 className="mt-0.5 break-words text-lg font-semibold tracking-tight sm:text-xl">
            {item.itemName}
          </h2>
        </div>
        <div className="min-w-0 sm:max-w-sm sm:shrink-0 sm:text-right">
          <div className="break-words text-2xl font-bold tabular-nums leading-tight tracking-tight">
            {formatOrderedQuantities(item.orderedUnitTotals)}
          </div>
          <div className="mt-1 text-xs tabular-nums text-muted-foreground">
            {totalBaseQuantity
              ? t("inTransitOnLoadLists", {
                  quantity: totalBaseQuantity,
                  count: item.shipmentCount,
                })
              : t("inTransitLoadListCount", { count: item.shipmentCount })}
          </div>
        </div>
      </div>

      {query.isPending ? (
        <div aria-hidden="true" className="space-y-5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : query.isError ? (
        <div role="alert" className="flex flex-col items-center gap-4 px-6 py-12 text-center">
          <CircleAlert aria-hidden="true" className="h-8 w-8 text-destructive" />
          <p className="font-medium">{t("loadErrorTitle")}</p>
          <Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <div
              role="img"
              aria-label={`${t("arrivalMix")}: ${arrivalMix
                .map(
                  ({ arrivalWindow, orderedUnitTotals }) =>
                    `${arrivalWindowLabels[arrivalWindow]} ${formatOrderedQuantities(orderedUnitTotals)}`
                )
                .join(", ")}`}
              className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted"
            >
              {arrivalMix.map(({ arrivalWindow, quantity }) => (
                <span
                  key={arrivalWindow}
                  className={ARRIVAL_WINDOW_STYLES[arrivalWindow].marker}
                  style={{ flexGrow: quantity, flexBasis: 0 }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {arrivalMix.map(({ arrivalWindow, baseQuantity, orderedUnitTotals }) => (
                <span key={arrivalWindow} className="inline-flex flex-wrap items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-2 w-2 rounded-sm",
                      ARRIVAL_WINDOW_STYLES[arrivalWindow].marker
                    )}
                  />
                  {arrivalWindowLabels[arrivalWindow]}
                  <strong className="font-semibold tabular-nums text-foreground">
                    {formatOrderedQuantities(orderedUnitTotals)}
                  </strong>
                  {baseQuantity && (
                    <span className="tabular-nums">
                      {t("baseQuantityInParentheses", { quantity: baseQuantity })}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("arrivalTimeline")}</h3>
            <StockInTransitArrivalTimeline groups={groups} unitName={unitName} />
            {query.hasNextPage && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  disabled={query.isFetchingNextPage}
                  onClick={() => query.fetchNextPage()}
                >
                  {query.isFetchingNextPage ? t("loadingMore") : t("loadMore")}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
