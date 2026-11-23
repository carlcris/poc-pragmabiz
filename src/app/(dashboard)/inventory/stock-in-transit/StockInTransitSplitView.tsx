import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleAlert, PackageSearch } from "lucide-react";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStockInTransitItems } from "@/hooks/useStockInTransitItems";
import { StockInTransitItemDetail } from "./StockInTransitItemDetail";
import { StockInTransitItemList } from "./StockInTransitItemList";

type StockInTransitSplitViewProps = {
  companyId?: string;
  isScopeReady: boolean;
};

export function StockInTransitSplitView({ companyId, isScopeReady }: StockInTransitSplitViewProps) {
  const t = useTranslations("stockInTransitPage");
  const detailRef = useRef<HTMLDivElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const isEnabled = isScopeReady && Boolean(companyId);

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === search) return;
    const timeout = window.setTimeout(() => setSearch(trimmed), 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput, search]);

  const query = useStockInTransitItems(search || undefined, { enabled: isEnabled, companyId });
  const pages = isEnabled ? query.data?.pages : undefined;
  const items = useMemo(() => pages?.flatMap((page) => page.data) ?? [], [pages]);
  const firstPage = pages?.[0];
  const selectedItem = items.find((item) => item.itemId === selectedItemId) ?? items[0];
  const isLoading = !isScopeReady || (isEnabled && query.isPending);
  const hasError = !isLoading && (!companyId || query.isError);

  const selectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      detailRef.current?.scrollIntoView({ block: "start" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{t("title")}</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">{t("subtitle")}</p>
        </div>
        <div aria-label={t("summaryLabel")} className="min-h-5 text-sm tabular-nums">
          {isLoading ? (
            <Skeleton className="h-5 w-48" />
          ) : firstPage ? (
            <p className="flex flex-wrap gap-x-2 text-muted-foreground">
              <span>{t("itemCount", { count: firstPage.pagination.total })}</span>
              <span aria-hidden="true">·</span>
              <span>{t("loadListCount", { count: firstPage.summary.loadListCount })}</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  firstPage.summary.lateLoadListCount > 0
                    ? "font-medium text-red-700 dark:text-red-400"
                    : undefined
                }
              >
                {t("lateLoadListCount", { count: firstPage.summary.lateLoadListCount })}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid overflow-hidden rounded-lg border bg-card lg:grid-cols-3">
        <StockInTransitItemList
          items={items}
          selectedItemId={selectedItem?.itemId}
          searchInput={searchInput}
          isLoading={isLoading}
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          onSearchChange={setSearchInput}
          onSelectItem={selectItem}
          onLoadMore={() => query.fetchNextPage()}
        />
        <div ref={detailRef} className="min-w-0 scroll-mt-20 lg:col-span-2">
          {hasError ? (
            <div role="alert" className="flex flex-col items-center gap-4 px-6 py-12 text-center">
              <CircleAlert aria-hidden="true" className="h-8 w-8 text-destructive" />
              <p className="font-medium">{t("loadErrorTitle")}</p>
              {companyId && (
                <Button
                  variant="outline"
                  disabled={query.isFetching}
                  onClick={() => query.refetch()}
                >
                  {t("retry")}
                </Button>
              )}
            </div>
          ) : isLoading ? (
            <div aria-hidden="true" className="space-y-5 p-4 sm:p-6">
              <Skeleton className="h-12 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : selectedItem ? (
            <StockInTransitItemDetail
              key={selectedItem.itemId}
              item={selectedItem}
              companyId={companyId}
              isEnabled={isEnabled}
            />
          ) : (
            <EmptyStatePanel
              icon={PackageSearch}
              title={search ? t("noMatchingItems") : t("emptyTitle")}
              description={search ? t("tryAnotherItemSearch") : t("emptyDescription")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
