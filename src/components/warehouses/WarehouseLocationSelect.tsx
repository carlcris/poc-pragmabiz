"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLookupWarehouseLocations } from "@/hooks/useLookups";

const NO_LOCATION_VALUE = "__no_location__";

export type WarehouseLocationOption = {
  id: string;
  warehouseId?: string;
  code: string;
  name?: string | null;
};

type WarehouseLocationSelectProps = {
  warehouseId: string | null | undefined;
  value: string;
  onValueChange: (value: string) => void;
  selectedOption?: WarehouseLocationOption | null;
  onOptionChange?: (option: WarehouseLocationOption | null) => void;
  allowNone?: boolean;
  includeInactive?: boolean;
  storableOnly?: boolean;
  locationType?: string;
  disabled?: boolean;
  buttonClassName?: string;
};

export function WarehouseLocationSelect({
  warehouseId,
  value,
  onValueChange,
  selectedOption = null,
  onOptionChange,
  allowNone = false,
  includeInactive = false,
  storableOnly = false,
  locationType,
  disabled = false,
  buttonClassName,
}: WarehouseLocationSelectProps) {
  const t = useTranslations("warehouseLocationSelect");
  const [search, setSearch] = useState("");
  const [lastSelectedOption, setLastSelectedOption] =
    useState<WarehouseLocationOption | null>(selectedOption);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const selectedOptionMissing = Boolean(value && lastSelectedOption?.id !== value);
  const { data, isLoading } = useLookupWarehouseLocations(warehouseId, {
    search: debouncedSearch || undefined,
    limit: 5,
    selectedId: selectedOptionMissing ? value : undefined,
    includeInactive,
    storableOnly,
    locationType,
  });
  const locationOptions = useMemo<WarehouseLocationOption[]>(() => data?.data ?? [], [data?.data]);
  const selectedFromResults =
    locationOptions.find((location) => location.id === value) ??
    (data?.selected?.id === value ? data.selected : null);

  useEffect(() => {
    if (selectedOption?.id === value) {
      setLastSelectedOption(selectedOption);
      return;
    }
    if (selectedFromResults) {
      setLastSelectedOption(selectedFromResults);
      if (lastSelectedOption?.id !== selectedFromResults.id) {
        onOptionChange?.(selectedFromResults);
      }
      return;
    }
    if (!value) setLastSelectedOption(null);
  }, [lastSelectedOption?.id, onOptionChange, selectedFromResults, selectedOption, value]);

  const noLocationOption = useMemo<WarehouseLocationOption>(
    () => ({ id: NO_LOCATION_VALUE, code: t("noLocation"), name: null }),
    [t]
  );
  const options = allowNone ? [noLocationOption, ...locationOptions] : locationOptions;
  const effectiveValue = allowNone && !value ? NO_LOCATION_VALUE : value;
  const effectiveSelectedOption =
    allowNone && !value
      ? noLocationOption
      : selectedFromResults ||
        (selectedOption?.id === value ? selectedOption : null) ||
        (lastSelectedOption?.id === value ? lastSelectedOption : null);

  return (
    <AsyncSearchCombobox
      value={effectiveValue}
      onValueChange={(nextValue) => {
        const isNoLocation = nextValue === NO_LOCATION_VALUE;
        const nextLocation = isNoLocation
          ? null
          : locationOptions.find((location) => location.id === nextValue) ?? null;
        setLastSelectedOption(nextLocation);
        onOptionChange?.(nextLocation);
        onValueChange(isNoLocation ? "" : nextValue);
      }}
      searchValue={search}
      onSearchValueChange={setSearch}
      options={options}
      selectedOption={effectiveSelectedOption}
      getOptionValue={(location) => location.id}
      getOptionLabel={(location) =>
        location.id === NO_LOCATION_VALUE
          ? location.code
          : `${location.code}${location.name ? ` - ${location.name}` : ""}`
      }
      getOptionSearchValue={(location) => `${location.code} ${location.name ?? ""}`}
      placeholder={warehouseId ? t("selectLocation") : t("selectWarehouseFirst")}
      searchPlaceholder={t("searchPlaceholder")}
      emptyMessage={t("empty")}
      loadingMessage={t("loading")}
      isLoading={isLoading}
      disabled={disabled || !warehouseId}
      buttonClassName={buttonClassName}
    />
  );
}
