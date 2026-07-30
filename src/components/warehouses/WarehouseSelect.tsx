"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useLookupWarehouses,
  type LookupWarehouseOption,
  type WarehouseLookupScope,
} from "@/hooks/useLookups";

const ALL_WAREHOUSES_VALUE = "__all_warehouses__";

type WarehouseSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  onOptionChange?: (option: LookupWarehouseOption | null) => void;
  scope: WarehouseLookupScope;
  allowAll?: boolean;
  selectedOption?: LookupWarehouseOption | null;
  disabled?: boolean;
  buttonClassName?: string;
  allOptionLabel?: string;
  showCodeInLabel?: boolean;
};

export function WarehouseSelect({
  value,
  onValueChange,
  onOptionChange,
  scope,
  allowAll = false,
  selectedOption = null,
  disabled = false,
  buttonClassName,
  allOptionLabel,
  showCodeInLabel = true,
}: WarehouseSelectProps) {
  const t = useTranslations("warehouseSelect");
  const [search, setSearch] = useState("");
  const [lastSelectedOption, setLastSelectedOption] = useState<LookupWarehouseOption | null>(
    selectedOption
  );
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const { data, isLoading } = useLookupWarehouses({
    scope,
    search: debouncedSearch || undefined,
    limit: 5,
  });
  const warehouseOptions = useMemo(() => data?.data ?? [], [data?.data]);
  const selectedFromResults = warehouseOptions.find((warehouse) => warehouse.id === value) ?? null;

  useEffect(() => {
    if (selectedFromResults) {
      setLastSelectedOption(selectedFromResults);
      return;
    }

    if (!value) {
      setLastSelectedOption(null);
    }
  }, [selectedFromResults, value]);

  const allWarehousesOption = useMemo<LookupWarehouseOption>(
    () => ({
      id: ALL_WAREHOUSES_VALUE,
      code: "",
      name: allOptionLabel ?? t("allWarehouses"),
      businessUnitId: null,
      isActive: true,
    }),
    [allOptionLabel, t]
  );
  const options = allowAll ? [allWarehousesOption, ...warehouseOptions] : warehouseOptions;
  const effectiveValue = allowAll && !value ? ALL_WAREHOUSES_VALUE : value;
  const effectiveSelectedOption =
    allowAll && !value
      ? allWarehousesOption
      : selectedOption?.id === value
        ? selectedOption
        : selectedFromResults || (lastSelectedOption?.id === value ? lastSelectedOption : null);

  return (
    <AsyncSearchCombobox
      value={effectiveValue}
      onValueChange={(nextValue) => {
        const nextWarehouse =
          warehouseOptions.find((warehouse) => warehouse.id === nextValue) ?? null;
        setLastSelectedOption(nextWarehouse);
        const isAllWarehouses = nextValue === ALL_WAREHOUSES_VALUE;
        onOptionChange?.(isAllWarehouses ? null : nextWarehouse);
        onValueChange(isAllWarehouses ? "" : nextValue);
      }}
      searchValue={search}
      onSearchValueChange={setSearch}
      options={options}
      selectedOption={effectiveSelectedOption}
      getOptionValue={(warehouse) => warehouse.id}
      getOptionLabel={(warehouse) =>
        warehouse.id === ALL_WAREHOUSES_VALUE
          ? warehouse.name
          : showCodeInLabel && warehouse.code
            ? `${warehouse.code} - ${warehouse.name}`
            : warehouse.name
      }
      getOptionSearchValue={(warehouse) => `${warehouse.code} ${warehouse.name}`}
      placeholder={t("selectWarehouse")}
      searchPlaceholder={t("searchPlaceholder")}
      emptyMessage={t("empty")}
      loadingMessage={t("loading")}
      isLoading={isLoading}
      disabled={disabled}
      buttonClassName={buttonClassName}
    />
  );
}
