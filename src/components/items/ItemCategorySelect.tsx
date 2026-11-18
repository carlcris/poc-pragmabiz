"use client";

import { useMemo, useState, type Ref } from "react";
import { useTranslations } from "next-intl";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { ItemCategory } from "@/types/item-category";

const ALL_CATEGORIES_VALUE = "all";

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
  const common = useTranslations("common");
  const [search, setSearch] = useState("");
  const [selectedOption, setSelectedOption] = useState<ItemCategory | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const searchIsSettling = search.trim() !== debouncedSearch;
  const {
    data,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    isFetchNextPageError,
  } = useItemCategories({ search: debouncedSearch });

  const fetchedCategories = useMemo(() => {
    const pages = data?.pages;
    if (!pages) return [];
    // Pages are appended in order. Later pages cannot repeat an earlier row for
    // a stable `name, id` ordering, but a category renamed between two requests
    // can, so rows are deduplicated rather than assumed unique. The dedupe key
    // is the selected value, because two distinct ids can share a name and this
    // control is also used with `valueField: "name"`.
    const seen = new Set<string>();
    return pages.flatMap((page) =>
      page.data.filter((category) => {
        const key = category[valueField];
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
    );
  }, [data?.pages, valueField]);

  const allOption = { id: ALL_CATEGORIES_VALUE, name: t("allCategories") };
  const options = allowAll ? [allOption, ...fetchedCategories] : fetchedCategories;
  const optionValue = (option: ItemCategory) =>
    option.id === ALL_CATEGORIES_VALUE ? ALL_CATEGORIES_VALUE : option[valueField];
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
        onOptionChange?.(option?.id === ALL_CATEGORIES_VALUE ? null : option);
      }}
      searchValue={search}
      onSearchValueChange={setSearch}
      options={options}
      selectedOption={selected}
      getOptionValue={optionValue}
      getOptionLabel={(option) => option.name}
      placeholder={t("selectCategory")}
      searchPlaceholder={t("searchPlaceholder")}
      emptyMessage={isError ? t("loadError") : t("empty")}
      loadingMessage={t("loading")}
      isLoading={(isFetching && !isFetchingNextPage) || searchIsSettling}
      pagination={{
        hasMore: hasNextPage,
        isFetchingMore: isFetchingNextPage,
        // A pending request or a search still settling owns the next page, so
        // rapid scrolling cannot queue duplicate or already-obsolete requests.
        canFetchMore: !isFetching && !searchIsSettling,
        // Only a failed next-page request turns the row into a retry, so a
        // failed background refetch of already-listed pages is not reported as
        // a pagination failure. A failed first page leaves no rows and is
        // reported by the empty state instead.
        hasError: isFetchNextPageError,
        onFetchMore: () => {
          // `cancelRefetch: false` keeps an in-flight page request as the one
          // that resolves instead of restarting it on every scroll event.
          void fetchNextPage({ cancelRefetch: false });
        },
        loadMoreLabel: common("loadMore"),
        retryLabel: t("retryLoadMore"),
        loadingMoreLabel: t("loading"),
      }}
      buttonClassName={buttonClassName}
      triggerId={id}
      triggerRef={ref}
      describedBy={aria["aria-describedby"]}
      invalid={aria["aria-invalid"]}
    />
  );
}
