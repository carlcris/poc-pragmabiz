"use client";

import { type ReactNode, type Ref, type UIEvent, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type AsyncSearchComboboxProps<T> = {
  value: string;
  onValueChange: (value: string) => void;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  options: T[];
  selectedOption?: T | null;
  getOptionValue: (option: T) => string;
  getOptionLabel: (option: T) => string;
  getOptionSearchValue?: (option: T) => string;
  renderOption?: (option: T, selected: boolean) => ReactNode;
  renderSelectedOption?: (option: T) => ReactNode;
  /**
   * Opt-in native hover text for an option row whose label is truncated, so
   * pointing at a row reveals the full text the single line cuts off. Applied
   * to the list row only, never to the trigger, and never to the accessible
   * name. Return `undefined` for options that need no hover text.
   */
  getOptionTitle?: (option: T) => string | undefined;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  loadingMessage?: string;
  isLoading?: boolean;
  disabled?: boolean;
  buttonClassName?: string;
  triggerRef?: Ref<HTMLButtonElement>;
  triggerId?: string;
  invalid?: boolean;
  describedBy?: string;
  popoverClassName?: string;
  /** Overrides the scroll area's default height cap, for taller option rows. */
  listClassName?: string;
  footer?: ReactNode;
  /**
   * Appends the next page of options when the list is scrolled near its end.
   * Omit it and the list stays a plain single-page list: no scroll listener, no
   * extra row, and the popover keeps its default non-modal behavior.
   */
  pagination?: {
    hasMore: boolean;
    isFetchingMore: boolean;
    /** Blocked while a page request is pending, so a new search wins over a stale page. */
    canFetchMore: boolean;
    hasError: boolean;
    onFetchMore: () => void;
    loadMoreLabel: string;
    retryLabel: string;
    loadingMoreLabel: string;
  };
};

// Starts the next request while the last rows are still in view, so scrolling
// stays continuous rather than stopping at the bottom and waiting.
const LOAD_MORE_SCROLL_THRESHOLD_PX = 48;

export function AsyncSearchCombobox<T>({
  value,
  onValueChange,
  searchValue,
  onSearchValueChange,
  options,
  selectedOption = null,
  getOptionValue,
  getOptionLabel,
  getOptionSearchValue,
  renderOption,
  renderSelectedOption,
  getOptionTitle,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  loadingMessage = "Loading...",
  isLoading = false,
  disabled = false,
  buttonClassName,
  triggerRef,
  triggerId,
  invalid,
  describedBy,
  popoverClassName,
  listClassName,
  footer,
  pagination,
}: AsyncSearchComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [internalSearch, setInternalSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const currentSearch = searchValue ?? internalSearch;
  const setSearch = onSearchValueChange ?? setInternalSearch;
  const normalizedSearch = currentSearch.trim().toLowerCase();

  const mergedOptions = useMemo(() => {
    if (!selectedOption) return options;

    const selectedValue = getOptionValue(selectedOption);
    if (options.some((option) => getOptionValue(option) === selectedValue)) {
      return options;
    }

    if (normalizedSearch.length > 0) {
      const selectedSearchValue = (
        getOptionSearchValue?.(selectedOption) ?? getOptionLabel(selectedOption)
      ).toLowerCase();

      if (!selectedSearchValue.includes(normalizedSearch)) {
        return options;
      }
    }

    return [selectedOption, ...options];
  }, [
    getOptionLabel,
    getOptionSearchValue,
    getOptionValue,
    normalizedSearch,
    options,
    selectedOption,
  ]);

  const selected = useMemo(
    () =>
      mergedOptions.find((option) => getOptionValue(option) === value) ?? selectedOption ?? null,
    [getOptionValue, mergedOptions, selectedOption, value]
  );

  const requestMore = () => {
    if (!pagination?.hasMore || !pagination.canFetchMore) return;
    pagination.onFetchMore();
  };

  const handleSearchChange = (nextSearch: string) => {
    setSearch(nextSearch);
    // A new search replaces a paginated list from its first page. Without this
    // the container keeps its old offset, lands at the end of the shorter new
    // list, and asks for a page the person never scrolled to.
    if (pagination && listRef.current) listRef.current.scrollTop = 0;
  };

  const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!pagination || pagination.hasError) return;
    const list = event.currentTarget;
    const distanceToEnd = list.scrollHeight - list.scrollTop - list.clientHeight;
    if (distanceToEnd <= LOAD_MORE_SCROLL_THRESHOLD_PX) requestMore();
  };

  return (
    <Popover
      // A paginated list has to scroll to reach later pages. Inside a modal
      // dialog the dialog's scroll lock only exempts its own content, so a
      // popover portaled to the body never receives wheel or touch scrolling.
      // Modal mode gives this popover its own exemption. The value is fixed per
      // instance and never derived from whether more pages exist, so focus
      // behavior stays the same once the list reaches its end.
      modal={pagination !== undefined}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setSearch("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          id={triggerId}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          disabled={disabled}
          className={cn(
            "w-full justify-between",
            !value && "text-muted-foreground",
            buttonClassName
          )}
        >
          {selected && renderSelectedOption ? (
            <span className="min-w-0 flex-1 text-left">{renderSelectedOption(selected)}</span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-left">
              {selected ? getOptionLabel(selected) : placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] overflow-hidden p-0",
          popoverClassName
        )}
        align="start"
        onOpenAutoFocus={(event) => {
          // On touch screens, focusing the search box opens the on-screen keyboard, which
          // shrinks the visual viewport and flips the list above the trigger over the form.
          // Keep the list below; people tap the search box when they want to type.
          if (window.matchMedia("(pointer: coarse)").matches) event.preventDefault();
        }}
      >
        <Command shouldFilter={false} className="max-h-full">
          <CommandInput
            placeholder={searchPlaceholder}
            value={currentSearch}
            onValueChange={handleSearchChange}
          />
          <div
            ref={listRef}
            onScroll={pagination ? handleListScroll : undefined}
            // A paginated list is capped tall enough to show a full page of rows
            // plus a synthetic option when the viewport has room — seven option
            // rows and the group's padding fit in the 15rem cap before the Load
            // more footer — and scrolls when it does not. Reaching a later page
            // is always possible: the
            // list scrolls whenever the cap cuts it off, and the Load more row
            // below stays available whenever more pages exist. Both caps stay
            // under the height Radix measured for the popover.
            className={cn(
              "overflow-y-auto overscroll-contain",
              pagination
                ? "max-h-[min(15rem,calc(var(--radix-popover-content-available-height)-3rem))]"
                : "max-h-[min(18rem,calc(var(--radix-popover-content-available-height)-3rem))]",
              // Last, so a caller with taller option rows replaces the default
              // cap rather than fighting it.
              listClassName
            )}
          >
            <CommandList className="max-h-none overflow-visible">
              <CommandEmpty>{isLoading ? loadingMessage : emptyMessage}</CommandEmpty>
              <CommandGroup>
                {mergedOptions.map((option) => {
                  const optionValue = getOptionValue(option);
                  const optionLabel = getOptionLabel(option);
                  const selectedState = optionValue === value;

                  return (
                    <CommandItem
                      key={optionValue}
                      value={optionValue}
                      // Native hover text for a row whose label is truncated.
                      // The row's own content stays the accessible name, so
                      // this adds nothing for screen readers to repeat.
                      title={getOptionTitle?.(option)}
                      className={cn("w-full", renderOption && "items-stretch")}
                      onSelect={() => {
                        onValueChange(optionValue);
                        setOpen(false);
                      }}
                    >
                      {renderOption ? (
                        renderOption(option, selectedState)
                      ) : (
                        <>
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedState ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {optionLabel}
                        </>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
            {pagination && pagination.hasMore && (
              // Sits inside the scroll area so scrolling reaches it, but outside
              // CommandList so it is never an arrow-key or type-ahead target.
              // It is the keyboard and assistive-technology path to later pages,
              // and the retry path when a page request fails.
              <div className="border-t p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center text-xs font-normal text-muted-foreground"
                  disabled={!pagination.canFetchMore}
                  onClick={requestMore}
                  onKeyDown={(event) => {
                    // cmdk's root Enter handler selects the highlighted item and
                    // prevents default, which would pick a category instead of
                    // loading the next page. Stop Enter here and let the browser
                    // activate the focused button; every other key, Escape
                    // included, still reaches the Command root.
                    if (event.key === "Enter") event.stopPropagation();
                  }}
                >
                  {pagination.isFetchingMore ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      {pagination.loadingMoreLabel}
                    </>
                  ) : pagination.hasError ? (
                    pagination.retryLabel
                  ) : (
                    pagination.loadMoreLabel
                  )}
                </Button>
              </div>
            )}
          </div>
        </Command>
        {footer}
      </PopoverContent>
    </Popover>
  );
}
