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
  locationPath?: string;
};

type WarehouseLocationSelectProps = {
  warehouseId: string | null | undefined;
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
  const [search, setSearch] = useState("");
  const [lastSelectedOption, setLastSelectedOption] = useState<WarehouseLocationOption | null>(
    selectedOption
  );
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const selectedOptionMissing = Boolean(
    value && (lastSelectedOption?.id !== value || !lastSelectedOption.locationPath)
  );
  const { data, isLoading } = useLookupWarehouseLocations(warehouseId, {
    search: debouncedSearch || undefined,
    limit: 5,
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
      (!lastSelectedOption?.locationPath ||
        (selectedOption.locationPath &&
          selectedOption.locationPath !== lastSelectedOption.locationPath))
    ) {
      setLastSelectedOption(selectedOption);
      return;
    }
    if (!value) setLastSelectedOption(null);
  }, [
    lastSelectedOption?.id,
    lastSelectedOption?.locationPath,
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
      onSearchValueChange={setSearch}
      options={options}
      selectedOption={effectiveSelectedOption}
      getOptionValue={(location) => location.id}
      getOptionLabel={(location) =>
        location.id === NO_LOCATION_VALUE
          ? location.code
          : location.locationPath || `${location.code}${location.name ? ` - ${location.name}` : ""}`
      }
      getOptionSearchValue={(location) => `${location.code} ${location.name ?? ""}`}
      placeholder={warehouseId ? t("selectLocation") : t("selectWarehouseFirst")}
      searchPlaceholder={t("searchPlaceholder")}
      emptyMessage={t("empty")}
      loadingMessage={t("loading")}
      isLoading={isLoading}
      disabled={disabled || !warehouseId}
      buttonClassName={buttonClassName}
      triggerId={triggerId}
      invalid={invalid}
      describedBy={describedBy}
    />
  );
}
