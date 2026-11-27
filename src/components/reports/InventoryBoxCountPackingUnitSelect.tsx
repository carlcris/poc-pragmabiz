"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  INVENTORY_BOX_COUNT_UNIT_SEARCH_MAX_LENGTH,
  useInventoryBoxCountPackingUnits,
} from "@/hooks/useInventoryBoxCountPackingUnits";
import type { InventoryBoxCountPackingUnit } from "@/types/inventory-box-count-report";

type InventoryBoxCountPackingUnitSelectProps = {
  id: string;
  value: InventoryBoxCountPackingUnit | null;
  onValueChange: (option: InventoryBoxCountPackingUnit) => void;
  companyId?: string;
  businessUnitId?: string;
  enabled: boolean;
  disabled: boolean;
};

export function InventoryBoxCountPackingUnitSelect({
  id,
  value,
  onValueChange,
  companyId,
  businessUnitId,
  enabled,
  disabled,
}: InventoryBoxCountPackingUnitSelectProps) {
  const t = useTranslations("inventoryBoxCountReport");
  const common = useTranslations("common");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const searchIsSettling = search.trim() !== debouncedSearch;
  const query = useInventoryBoxCountPackingUnits({
    companyId,
    businessUnitId,
    search: debouncedSearch,
    enabled,
  });
  const options = useMemo(
    () =>
      Array.from(
        new Map(
          query.data?.pages.flatMap((page) => page.data.map((unit) => [unit.id, unit]))
        ).values()
      ),
    [query.data?.pages]
  );
  const listedOptions = searchIsSettling ? [] : options;
  const canFetchMore = !query.isFetching && !searchIsSettling;

  return (
    <AsyncSearchCombobox
      triggerId={id}
      value={value?.id ?? ""}
      selectedOption={value}
      onValueChange={(nextId) => {
        const next = listedOptions.find((unit) => unit.id === nextId);
        if (next) onValueChange(next);
      }}
      options={listedOptions}
      getOptionValue={(unit) => unit.id}
      getOptionLabel={(unit) => t("unitNameWithCode", { name: unit.name, code: unit.code })}
      getOptionSearchValue={(unit) => `${unit.code} ${unit.name}`}
      placeholder={t("selectCalculationUnit")}
      searchValue={search}
      onSearchValueChange={(next) =>
        setSearch(next.slice(0, INVENTORY_BOX_COUNT_UNIT_SEARCH_MAX_LENGTH))
      }
      searchPlaceholder={t("searchCalculationUnits")}
      emptyMessage={
        query.isError && !query.isFetchNextPageError
          ? t("calculationUnitsLoadError")
          : t("noCalculationUnits")
      }
      loadingMessage={t("loadingCalculationUnits")}
      isLoading={searchIsSettling || (query.isFetching && !query.isFetchingNextPage)}
      disabled={disabled}
      pagination={{
        hasMore: query.hasNextPage && !searchIsSettling,
        isFetchingMore: query.isFetchingNextPage,
        canFetchMore,
        hasError: query.isFetchNextPageError,
        onFetchMore: () => {
          if (canFetchMore) void query.fetchNextPage({ cancelRefetch: false });
        },
        loadMoreLabel: common("loadMore"),
        retryLabel: t("retryCalculationUnits"),
        loadingMoreLabel: t("loadingCalculationUnits"),
      }}
    />
  );
}
