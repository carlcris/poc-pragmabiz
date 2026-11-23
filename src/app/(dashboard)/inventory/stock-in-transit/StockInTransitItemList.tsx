import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { StockInTransitItemRow } from "@/types/stock-in-transit";
import { ARRIVAL_WINDOW_STYLES, useArrivalLabels } from "./useArrivalLabels";

type StockInTransitItemListProps = {
  items: StockInTransitItemRow[];
  selectedItemId?: string;
  searchInput: string;
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onSearchChange: (value: string) => void;
  onSelectItem: (itemId: string) => void;
  onLoadMore: () => void;
};

export function StockInTransitItemList({
  items,
  selectedItemId,
  searchInput,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  onSearchChange,
  onSelectItem,
  onLoadMore,
}: StockInTransitItemListProps) {
  const t = useTranslations("stockInTransitPage");
  const {
    formatArrivalDate,
    formatDistinctBaseQuantity,
    formatOrderedQuantities,
    formatRelativeArrival,
  } = useArrivalLabels();

  return (
    <section
      aria-label={t("itemListLabel")}
      className="flex min-w-0 flex-col border-b bg-muted/30 lg:border-b-0 lg:border-r"
    >
      <div className="border-b p-3">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label={t("itemSearchLabel")}
            placeholder={t("itemSearchPlaceholder")}
            value={searchInput}
            onChange={(event) => onSearchChange(event.target.value)}
            maxLength={100}
            className="bg-background pl-8"
          />
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto lg:max-h-screen">
        {isLoading
          ? Array.from({ length: 6 }, (_, index) => (
              <div key={index} aria-hidden="true" className="space-y-2 border-b px-4 py-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))
          : items.map((item) => {
              const isSelected = item.itemId === selectedItemId;
              const style = ARRIVAL_WINDOW_STYLES[item.nextArrivalWindow];
              const baseQuantity = formatDistinctBaseQuantity(
                item.orderedUnitTotals,
                item.totalBaseQuantity,
                item.baseUnitName ?? t("baseUnits")
              );

              return (
                <button
                  key={item.itemId}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectItem(item.itemId)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    isSelected && "bg-muted"
                  )}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span
                      className={cn(
                        "min-w-0 truncate text-sm font-semibold",
                        isSelected && "text-violet-700 dark:text-violet-300"
                      )}
                    >
                      {item.itemCode}
                    </span>
                    <span className={cn("shrink-0 text-xs font-medium", style.text)}>
                      {item.nextEstimatedArrivalDate
                        ? t("nextArrival", {
                            date: formatArrivalDate(item.nextEstimatedArrivalDate),
                            relative: formatRelativeArrival(item.nextDaysUntilArrival),
                          })
                        : t("noEta")}
                    </span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{item.itemName}</span>
                  <span className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="min-w-0 text-sm font-semibold tabular-nums">
                      {formatOrderedQuantities(item.orderedUnitTotals)}
                    </span>
                    {baseQuantity && (
                      <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                        {baseQuantity}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
        {hasNextPage && (
          <div className="p-3">
            <Button
              variant="outline"
              className="w-full"
              disabled={isFetchingNextPage}
              onClick={onLoadMore}
            >
              {isFetchingNextPage ? t("loadingMore") : t("loadMore")}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
