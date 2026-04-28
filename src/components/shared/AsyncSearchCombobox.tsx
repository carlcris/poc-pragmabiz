"use client";

import { type ReactNode, useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  loadingMessage?: string;
  isLoading?: boolean;
  disabled?: boolean;
  buttonClassName?: string;
  popoverClassName?: string;
};

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
  placeholder,
  searchPlaceholder,
  emptyMessage,
  loadingMessage = "Loading...",
  isLoading = false,
  disabled = false,
  buttonClassName,
  popoverClassName,
}: AsyncSearchComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [internalSearch, setInternalSearch] = useState("");
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
  }, [getOptionLabel, getOptionSearchValue, getOptionValue, normalizedSearch, options, selectedOption]);

  const selected = useMemo(
    () => mergedOptions.find((option) => getOptionValue(option) === value) ?? selectedOption ?? null,
    [getOptionValue, mergedOptions, selectedOption, value]
  );

  return (
    <Popover
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
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between", !value && "text-muted-foreground", buttonClassName)}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selected ? getOptionLabel(selected) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] max-h-[var(--radix-popover-content-available-height)] overflow-hidden p-0",
          popoverClassName
        )}
        align="start"
      >
        <Command shouldFilter={false} className="max-h-full">
          <CommandInput
            placeholder={searchPlaceholder}
            value={currentSearch}
            onValueChange={setSearch}
          />
          <div
            className="overflow-y-auto overscroll-contain"
            style={{
              maxHeight: "min(18rem, calc(var(--radix-popover-content-available-height) - 3rem))",
            }}
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
                      value={getOptionSearchValue?.(option) ?? optionLabel}
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
                            className={cn("mr-2 h-4 w-4", selectedState ? "opacity-100" : "opacity-0")}
                          />
                          {optionLabel}
                        </>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
