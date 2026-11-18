"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useReportItemOptions } from "@/hooks/useReportItemOptions";
import { cn } from "@/lib/utils";
import type { ReportItemOption } from "@/types/report-item-options";

const ALL_ITEMS_VALUE = "__all_items__";
const ITEM_SEARCH_MAX_LENGTH = 100;

type ReportItemSelectProps = {
  /** `null` is the All Items filter; a value keeps its code and name off-page. */
  value: ReportItemOption | null;
  onValueChange: (option: ReportItemOption | null) => void;
  /** Gates the catalog request until the report preview is open. */
  enabled?: boolean;
  disabled?: boolean;
  id?: string;
};

export function ReportItemSelect({
  value,
  onValueChange,
  enabled = true,
  disabled = false,
  id,
}: ReportItemSelectProps) {
  const t = useTranslations("inventoryItemSelect");
  const common = useTranslations("common");
  const [search, setSearch] = useState("");
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
  } = useReportItemOptions({ search: debouncedSearch, enabled });

  const fetchedItems = useMemo(() => {
    const pages = data?.pages;
    if (!pages) return [];
    // Pages are appended in order. A stable `item_name, id` ordering cannot
    // repeat a row across pages, but an item renamed between two requests can,
    // so rows are deduplicated by id.
    const seen = new Set<string>();
    return pages.flatMap((page) =>
      page.data.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
    );
  }, [data?.pages]);

  // All Items is the empty-search default. A typed search hides it so cmdk's
  // empty state can own loading, error, and no-results for that term; clearing
  // the search or reopening the popover lists it again.
  const searchIsBlank = search.trim().length === 0;
  const allItemsOption: ReportItemOption = {
    id: ALL_ITEMS_VALUE,
    code: "",
    name: t("allItems"),
  };
  // A settling search still shows the previous term's rows, which keyboard and
  // pointer selection would treat as matches for what is now in the box.
  const listedItems = searchIsSettling ? [] : fetchedItems;
  // A settling search and a first-page request are the same wait to the person,
  // so both report loading instead of letting an empty list read as no results.
  const isLoadingOptions = searchIsSettling || (isFetching && !isFetchingNextPage);
  const options = searchIsBlank ? [allItemsOption, ...listedItems] : listedItems;
  const selectedValue = value?.id ?? ALL_ITEMS_VALUE;
  const selectedOption = value
    ? fetchedItems.find((item) => item.id === value.id) ?? value
    : allItemsOption;
  // All Items is listed only for a blank search, so the catalog state has no
  // empty state to render into. The footer reports it independently instead.
  const blankSearchStatus = searchIsBlank
    ? isLoadingOptions
      ? t("loadingItems")
      : isError && !isFetchNextPageError
        ? t("loadError")
        : listedItems.length === 0
          ? t("noItemsFound")
          : null
    : null;

  // Shared by the list rows and the trigger so both read the same way: the name
  // on the first line and the code as muted subtext below it. Spans only, since
  // the shared trigger wraps whatever it is given in a span. All Items has no
  // code and stays a single line.
  const renderItemLabel = (option: ReportItemOption) => (
    <span className="flex min-w-0 flex-col text-left">
      <span className="truncate font-medium">{option.name}</span>
      {option.id === ALL_ITEMS_VALUE ? null : (
        <span className="truncate text-xs font-normal text-muted-foreground">{option.code}</span>
      )}
    </span>
  );

  return (
    <AsyncSearchCombobox
      value={selectedValue}
      onValueChange={(nextValue) => {
        if (nextValue === ALL_ITEMS_VALUE) {
          onValueChange(null);
          return;
        }
        const option = fetchedItems.find((item) => item.id === nextValue);
        if (option) onValueChange(option);
      }}
      searchValue={search}
      // Matches the catalog endpoint's search bound, so a pasted term is capped
      // here instead of being trimmed silently by the request.
      onSearchValueChange={(nextSearch) => setSearch(nextSearch.slice(0, ITEM_SEARCH_MAX_LENGTH))}
      options={options}
      selectedOption={selectedOption}
      getOptionValue={(option) => option.id}
      getOptionLabel={(option) =>
        option.id === ALL_ITEMS_VALUE ? option.name : `${option.code} - ${option.name}`
      }
      // Empty for All Items, so the shared selected-option merge cannot
      // reintroduce it into a typed search's results.
      getOptionSearchValue={(option) =>
        option.id === ALL_ITEMS_VALUE ? "" : `${option.code} ${option.name}`
      }
      // Item rows keep the name on one truncated line, so hovering a row shows
      // the full name as native browser hover text. All Items is a short fixed
      // label that always fits, so it has none.
      getOptionTitle={(option) => (option.id === ALL_ITEMS_VALUE ? undefined : option.name)}
      placeholder={t("selectItem")}
      searchPlaceholder={t("searchItems")}
      // A failed first page leaves no rows, so the empty state carries the
      // error. A failed later page keeps its rows and retries from the footer,
      // and a failed background refetch of listed pages is not reported here.
      emptyMessage={isError && !isFetchNextPageError ? t("loadError") : t("noItemsFound")}
      footer={
        blankSearchStatus ? (
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">{blankSearchStatus}</p>
        ) : undefined
      }
      loadingMessage={t("loadingItems")}
      // A next-page request must not read as a first load, which would replace
      // the listed rows with the loading message.
      isLoading={isLoadingOptions}
      disabled={disabled}
      buttonClassName="h-auto min-h-10 py-1.5"
      // Two lines per item row: a full page of six ~48px rows plus the ~32px
      // All Items row and the group's 8px padding is about 328px, so the
      // shared 20rem cap would clip the last row and 24rem would also admit
      // the Load more row with no overflow left to scroll. 21rem shows every
      // item row while still scrolling to reach later pages, and the Radix
      // clamp keeps the list inside the popover on short viewports.
      listClassName="max-h-[min(21rem,calc(var(--radix-popover-content-available-height)-3rem))]"
      renderSelectedOption={renderItemLabel}
      renderOption={(option, selected) => (
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {/* Aligned to the first line's cap height rather than centered across
              both lines, so the mark sits beside the item name. */}
          <Check
            className={cn("mt-0.5 h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")}
          />
          {renderItemLabel(option)}
        </div>
      )}
      pagination={{
        // While a new search settles the listed rows are the previous term's and
        // are hidden, so there is no list for a next page to extend.
        hasMore: hasNextPage && !searchIsSettling,
        isFetchingMore: isFetchingNextPage,
        // A pending request or a search still settling owns the next page, so
        // rapid scrolling cannot queue duplicate or already-obsolete requests.
        canFetchMore: !isFetching && !searchIsSettling,
        hasError: isFetchNextPageError,
        onFetchMore: () => {
          // The settling guard is repeated here because the request must never
          // page the term the person has already typed past.
          if (isFetching || searchIsSettling) return;
          // `cancelRefetch: false` keeps an in-flight page request as the one
          // that resolves instead of restarting it on every scroll event.
          void fetchNextPage({ cancelRefetch: false });
        },
        loadMoreLabel: common("loadMore"),
        retryLabel: t("retryLoadMore"),
        loadingMoreLabel: t("loadingItems"),
      }}
      triggerId={id}
    />
  );
}
