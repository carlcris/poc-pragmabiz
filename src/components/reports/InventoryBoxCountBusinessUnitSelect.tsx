"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  INVENTORY_BOX_COUNT_BUSINESS_UNIT_SEARCH_MAX_LENGTH,
  useInventoryBoxCountBusinessUnits,
} from "@/hooks/useInventoryBoxCountBusinessUnits";
import type { InventoryBoxCountBusinessUnit } from "@/types/inventory-box-count-report";

const ALL_BUSINESS_UNITS = "all";

type InventoryBoxCountBusinessUnitSelectProps = {
  id: string;
  value: InventoryBoxCountBusinessUnit | null;
  onValueChange: (unit: InventoryBoxCountBusinessUnit | null) => void;
  companyId?: string;
  currentBusinessUnitId?: string;
  enabled: boolean;
  disabled: boolean;
};

export function InventoryBoxCountBusinessUnitSelect({
  id,
  value,
  onValueChange,
  companyId,
  currentBusinessUnitId,
  enabled,
  disabled,
}: InventoryBoxCountBusinessUnitSelectProps) {
  const t = useTranslations("inventoryBoxCountReport");
  const picker = useTranslations("businessUnitSelect");
  const common = useTranslations("common");
  const [search, setSearch] = useState("");
  const trimmedSearch = search.trim();
  const debouncedSearch = useDebouncedValue(trimmedSearch, 300);
  const searchIsSettling = trimmedSearch !== debouncedSearch;
  const query = useInventoryBoxCountBusinessUnits({
    companyId,
    currentBusinessUnitId,
    search: debouncedSearch,
    enabled,
  });
  const fetchedUnits = useMemo(
    () =>
      Array.from(
        new Map(
          query.data?.pages.flatMap((page) => page.data.map((unit) => [unit.id, unit]))
        ).values()
      ),
    [query.data?.pages]
  );
  const listedUnits = searchIsSettling ? [] : fetchedUnits;
  const allUnitsOption = { id: ALL_BUSINESS_UNITS, name: t("allBusinessUnits") };
  const searchIsBlank = trimmedSearch.length === 0;
  const options = searchIsBlank ? [allUnitsOption, ...listedUnits] : listedUnits;
  const selectedOption = value ?? allUnitsOption;
  const isLoading = searchIsSettling || (query.isFetching && !query.isFetchingNextPage);
  const loadFailed = query.isError && !query.isFetchNextPageError && listedUnits.length === 0;
  const canFetchMore = !query.isFetching && !searchIsSettling;

  // When the synthetic option is visible, cmdk cannot show its own empty state.
  const blankSearchStatus = searchIsBlank
    ? isLoading
      ? picker("loading")
      : loadFailed
        ? t("businessUnitsLoadError")
        : listedUnits.length === 0
          ? picker("empty")
          : null
    : null;
  const canRetry = loadFailed && !isLoading;

  return (
    <AsyncSearchCombobox
      triggerId={id}
      value={selectedOption.id}
      selectedOption={selectedOption}
      onValueChange={(nextId) => {
        if (nextId === ALL_BUSINESS_UNITS) {
          onValueChange(null);
          return;
        }
        const unit = listedUnits.find(({ id }) => id === nextId);
        if (unit) onValueChange(unit);
      }}
      options={options}
      getOptionValue={(unit) => unit.id}
      getOptionLabel={(unit) => unit.name}
      getOptionSearchValue={(unit) => (unit.id === ALL_BUSINESS_UNITS ? "" : unit.name)}
      getOptionTitle={(unit) => unit.name}
      placeholder={picker("selectBusinessUnit")}
      searchValue={search}
      onSearchValueChange={(next) =>
        setSearch(next.slice(0, INVENTORY_BOX_COUNT_BUSINESS_UNIT_SEARCH_MAX_LENGTH))
      }
      searchPlaceholder={picker("searchPlaceholder")}
      emptyMessage={loadFailed ? t("businessUnitsLoadError") : picker("empty")}
      loadingMessage={picker("loading")}
      isLoading={isLoading}
      disabled={disabled}
      footer={
        blankSearchStatus || canRetry ? (
          <div className="space-y-1 border-t px-3 py-2 text-xs text-muted-foreground">
            {blankSearchStatus && <p role="status">{blankSearchStatus}</p>}
            {canRetry && (
              <Button type="button" variant="ghost" size="sm" onClick={() => void query.refetch()}>
                {t("retryBusinessUnits")}
              </Button>
            )}
          </div>
        ) : undefined
      }
      pagination={{
        hasMore: query.hasNextPage && !searchIsSettling,
        isFetchingMore: query.isFetchingNextPage,
        canFetchMore,
        hasError: query.isFetchNextPageError,
        onFetchMore: () => {
          if (canFetchMore) void query.fetchNextPage({ cancelRefetch: false });
        },
        loadMoreLabel: common("loadMore"),
        retryLabel: t("retryBusinessUnits"),
        loadingMoreLabel: picker("loading"),
      }}
    />
  );
}
