"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLookupBusinessUnits, type LookupBusinessUnitOption } from "@/hooks/useLookups";

type BusinessUnitSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  onOptionChange?: (option: LookupBusinessUnitOption | null) => void;
  selectedOption?: LookupBusinessUnitOption | null;
  excludeId?: string;
  disabled?: boolean;
  buttonClassName?: string;
};

export function BusinessUnitSelect({
  value,
  onValueChange,
  onOptionChange,
  selectedOption = null,
  excludeId,
  disabled = false,
  buttonClassName,
}: BusinessUnitSelectProps) {
  const t = useTranslations("businessUnitSelect");
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
      placeholder={t("selectBusinessUnit")}
      searchPlaceholder={t("searchPlaceholder")}
      emptyMessage={t("empty")}
      loadingMessage={t("loading")}
      isLoading={isLoading}
      disabled={disabled}
      buttonClassName={buttonClassName}
    />
  );
}
