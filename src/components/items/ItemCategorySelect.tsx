"use client";

import { useState, type Ref } from "react";
import { useTranslations } from "next-intl";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { ItemCategory } from "@/types/item-category";

type ItemCategorySelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  onOptionChange?: (option: ItemCategory | null) => void;
  valueField?: "id" | "name";
  allowAll?: boolean;
  buttonClassName?: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

export function ItemCategorySelect({
  value,
  onValueChange,
  onOptionChange,
  valueField = "id",
  allowAll = false,
  buttonClassName,
  id,
  ref,
  ...aria
}: ItemCategorySelectProps) {
  const t = useTranslations("itemCategorySelect");
  const [search, setSearch] = useState("");
  const [selectedOption, setSelectedOption] = useState<ItemCategory | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const { data, isFetching, error } = useItemCategories({ search: debouncedSearch, limit: 5 });
  const allOption = { id: "all", name: t("allCategories") };
  const options = allowAll ? [allOption, ...(data?.data ?? [])] : (data?.data ?? []);
  const optionValue = (option: ItemCategory) => (option.id === "all" ? "all" : option[valueField]);
  const selected =
    options.find((option) => optionValue(option) === value) ??
    (selectedOption && optionValue(selectedOption) === value ? selectedOption : null) ??
    (valueField === "name" && value ? { id: value, name: value } : null);

  return (
    <AsyncSearchCombobox
      value={value}
      onValueChange={(nextValue) => {
        const option = options.find((entry) => optionValue(entry) === nextValue) ?? null;
        setSelectedOption(option);
        onValueChange(nextValue);
        onOptionChange?.(option?.id === "all" ? null : option);
      }}
      searchValue={search}
      onSearchValueChange={setSearch}
      options={options}
      selectedOption={selected}
      getOptionValue={optionValue}
      getOptionLabel={(option) => option.name}
      placeholder={t("selectCategory")}
      searchPlaceholder={t("searchPlaceholder")}
      emptyMessage={error ? t("loadError") : t("empty")}
      loadingMessage={t("loading")}
      isLoading={isFetching || search.trim() !== debouncedSearch}
      buttonClassName={buttonClassName}
      triggerId={id}
      triggerRef={ref}
      describedBy={aria["aria-describedby"]}
      invalid={aria["aria-invalid"]}
    />
  );
}
