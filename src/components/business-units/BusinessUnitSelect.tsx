"use client";

import { type Ref, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLookupBusinessUnits, type LookupBusinessUnitOption } from "@/hooks/useLookups";
import { cn } from "@/lib/utils";

type BusinessUnitSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  onOptionChange?: (option: LookupBusinessUnitOption | null) => void;
  selectedOption?: LookupBusinessUnitOption | null;
  excludeId?: string;
  disabled?: boolean;
  buttonClassName?: string;
  triggerRef?: Ref<HTMLButtonElement>;
  /** "warehouse" words the picker for screens where business unit names stand for warehouses. */
  labelVariant?: "businessUnit" | "warehouse";
};

const LABEL_KEYS = {
  businessUnit: {
    placeholder: "selectBusinessUnit",
    searchPlaceholder: "searchPlaceholder",
    empty: "empty",
    loading: "loading",
  },
  warehouse: {
    placeholder: "selectWarehouse",
    searchPlaceholder: "searchWarehousePlaceholder",
    empty: "emptyWarehouses",
    loading: "loadingWarehouses",
  },
} as const;

export function BusinessUnitSelect({
  value,
  onValueChange,
  onOptionChange,
  selectedOption = null,
  excludeId,
  disabled = false,
  buttonClassName,
  triggerRef,
  labelVariant = "businessUnit",
}: BusinessUnitSelectProps) {
  const t = useTranslations("businessUnitSelect");
  const labelKeys = LABEL_KEYS[labelVariant];
  const [search, setSearch] = useState("");
  const [lastSelectedOption, setLastSelectedOption] = useState<LookupBusinessUnitOption | null>(
    selectedOption
  );
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const { data, isLoading } = useLookupBusinessUnits({
    search: debouncedSearch || undefined,
    excludeId,
    limit: 5,
  });
  const options = useMemo(() => data?.data ?? [], [data?.data]);
  const selectedFromResults = options.find((option) => option.id === value) ?? null;

  useEffect(() => {
    if (selectedFromResults) {
      setLastSelectedOption(selectedFromResults);
    } else if (!value) {
      setLastSelectedOption(null);
    }
  }, [selectedFromResults, value]);

  const effectiveSelectedOption =
    selectedOption?.id === value
      ? selectedOption
      : selectedFromResults || (lastSelectedOption?.id === value ? lastSelectedOption : null);

  return (
    <AsyncSearchCombobox
      value={value}
      onValueChange={(nextValue) => {
        const option = options.find((candidate) => candidate.id === nextValue) ?? null;
        setLastSelectedOption(option);
        onOptionChange?.(option);
        onValueChange(nextValue);
      }}
      searchValue={search}
      onSearchValueChange={setSearch}
      options={options}
      selectedOption={effectiveSelectedOption}
      getOptionValue={(option) => option.id}
      getOptionLabel={(option) => (option.code ? `${option.code} - ${option.name}` : option.name)}
      getOptionSearchValue={(option) => `${option.code} ${option.name}`}
      renderOption={(option, selected) => (
        <>
          <Check
            className={cn("mr-2 mt-0.5 h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")}
          />
          <div className="min-w-0">
            <div className="truncate">{option.name}</div>
            {option.code ? (
              <div className="text-xs text-muted-foreground">{option.code}</div>
            ) : null}
          </div>
        </>
      )}
      placeholder={t(labelKeys.placeholder)}
      searchPlaceholder={t(labelKeys.searchPlaceholder)}
      emptyMessage={t(labelKeys.empty)}
      loadingMessage={t(labelKeys.loading)}
      isLoading={isLoading}
      disabled={disabled}
      buttonClassName={buttonClassName}
      triggerRef={triggerRef}
    />
  );
}
