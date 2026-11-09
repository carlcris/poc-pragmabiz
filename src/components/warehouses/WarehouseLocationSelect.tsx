"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLookupWarehouseLocations } from "@/hooks/useLookups";
import { getWarehouseLocationDisplayName } from "@/lib/warehouse-location-form";

const NO_LOCATION_VALUE = "__no_location__";

export type WarehouseLocationOption = {
  id: string;
  warehouseId?: string;
  code: string;
  name?: string | null;
  locationPath?: string;
  locationNamePath?: string;
};

type WarehouseLocationSelectProps = {
  warehouseId: string | null | undefined;
  itemId?: string;
  value: string;
  onValueChange: (value: string) => void;
  selectedOption?: WarehouseLocationOption | null;
  onOptionChange?: (option: WarehouseLocationOption | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
  includeInactive?: boolean;
  storableOnly?: boolean;
  locationType?: string;
  excludeSubtreeId?: string;
  pickableOnly?: boolean;
  disabled?: boolean;
  buttonClassName?: string;
  triggerId?: string;
  invalid?: boolean;
  describedBy?: string;
};

export function WarehouseLocationSelect({
  warehouseId,
  itemId,
  value,
  onValueChange,
  selectedOption = null,
  onOptionChange,
  allowNone = false,
  noneLabel,
  includeInactive = false,
  storableOnly = false,
  locationType,
  excludeSubtreeId,
  pickableOnly,
  disabled = false,
  buttonClassName,
  triggerId,
  invalid,
  describedBy,
}: WarehouseLocationSelectProps) {
  const t = useTranslations("warehouseLocationSelect");
  const pagination = useTranslations("pagination");
  const [search, setSearch] = useState("");
  const [paging, setPaging] = useState({ scope: "", page: 1 });
  const [lastSelectedOption, setLastSelectedOption] = useState<WarehouseLocationOption | null>(
    selectedOption
  );
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const scope = JSON.stringify([
    warehouseId,
    itemId,
    debouncedSearch,
    includeInactive,
    storableOnly,
    locationType,
    excludeSubtreeId,
    pickableOnly,
  ]);
  const page = paging.scope === scope ? paging.page : 1;
  useEffect(() => {
    if (paging.scope !== scope) setPaging({ scope, page: 1 });
  }, [paging.scope, scope]);
  const selectedOptionMissing = Boolean(
    value && (lastSelectedOption?.id !== value || !lastSelectedOption.locationNamePath)
  );
  const { data, isFetching } = useLookupWarehouseLocations(warehouseId, {
    itemId,
    search: debouncedSearch || undefined,
    limit: 5,
    page,
    selectedId: selectedOptionMissing ? value : undefined,
    includeInactive,
    storableOnly,
    locationType,
    excludeSubtreeId,
    pickableOnly,
  });
  const locationOptions = useMemo<WarehouseLocationOption[]>(() => data?.data ?? [], [data?.data]);
  const selectedFromResults =
    locationOptions.find((location) => location.id === value) ??
    (data?.selected?.id === value ? data.selected : null);

  useEffect(() => {
    if (selectedFromResults) {
      setLastSelectedOption(selectedFromResults);
      if (lastSelectedOption?.id !== selectedFromResults.id) {
        onOptionChange?.(selectedFromResults);
      }
      return;
    }
    if (
      selectedOption?.id === value &&
      (!lastSelectedOption?.locationNamePath ||
        (selectedOption.locationNamePath &&
          selectedOption.locationNamePath !== lastSelectedOption.locationNamePath))
    ) {
      setLastSelectedOption(selectedOption);
      return;
    }
    if (!value) setLastSelectedOption(null);
  }, [
    lastSelectedOption?.id,
    lastSelectedOption?.locationNamePath,
    onOptionChange,
    selectedFromResults,
    selectedOption,
    value,
  ]);

  const noLocationOption = useMemo<WarehouseLocationOption>(
    () => ({ id: NO_LOCATION_VALUE, code: noneLabel ?? t("noLocation"), name: null }),
    [noneLabel, t]
  );
  const options = allowNone ? [noLocationOption, ...locationOptions] : locationOptions;
  const effectiveValue = allowNone && !value ? NO_LOCATION_VALUE : value;
  const effectiveSelectedOption =
    allowNone && !value
      ? noLocationOption
      : selectedFromResults ||
        (lastSelectedOption?.id === value ? lastSelectedOption : null) ||
        (selectedOption?.id === value ? selectedOption : null);

  return (
    <AsyncSearchCombobox
      value={effectiveValue}
      onValueChange={(nextValue) => {
        const isNoLocation = nextValue === NO_LOCATION_VALUE;
        const nextLocation = isNoLocation
          ? null
          : (locationOptions.find((location) => location.id === nextValue) ?? null);
        setLastSelectedOption(nextLocation);
        onOptionChange?.(nextLocation);
        onValueChange(isNoLocation ? "" : nextValue);
      }}
      searchValue={search}
      onSearchValueChange={(nextSearch) => {
        setSearch(nextSearch);
        setPaging({ scope: "", page: 1 });
      }}
      options={options}
      selectedOption={effectiveSelectedOption}
      getOptionValue={(location) => location.id}
      getOptionLabel={(location) =>
        location.id === NO_LOCATION_VALUE
          ? location.code
          : location.locationNamePath || getWarehouseLocationDisplayName(location)
      }
      getOptionSearchValue={(location) => `${location.code} ${location.name ?? ""}`}
      placeholder={warehouseId ? t("selectLocation") : t("selectWarehouseFirst")}
      searchPlaceholder={t("searchPlaceholder")}
      emptyMessage={t("empty")}
      loadingMessage={t("loading")}
      isLoading={isFetching || search.trim() !== debouncedSearch}
      footer={
        (page > 1 || data?.hasMore) && (
          <div className="flex justify-between border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={pagination("goToPreviousPage")}
              disabled={page === 1 || isFetching || search.trim() !== debouncedSearch}
              onClick={() => setPaging({ scope, page: page - 1 })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={pagination("goToNextPage")}
              disabled={!data?.hasMore || isFetching || search.trim() !== debouncedSearch}
              onClick={() => setPaging({ scope, page: page + 1 })}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )
      }
      disabled={disabled || !warehouseId}
      buttonClassName={buttonClassName}
      triggerId={triggerId}
      invalid={invalid}
      describedBy={describedBy}
    />
  );
}
