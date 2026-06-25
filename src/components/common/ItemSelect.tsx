"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useItem, useItems } from "@/hooks/useItems";

type ItemSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  loadingMessage?: string;
};

export function ItemSelect({
  value,
  onValueChange,
  disabled,
  placeholder = "Select item",
  searchPlaceholder = "Search items...",
  emptyMessage = "No items found",
  loadingMessage = "Loading...",
}: ItemSelectProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());
  const { data: itemsData, isLoading } = useItems({
    limit: 5,
    search: debouncedSearch || undefined,
  });
  const { data: selectedItemResponse } = useItem(value);
  const items = itemsData?.data || [];
  const selectedItem =
    items.find((item) => item.id === value) ?? selectedItemResponse?.data ?? null;

  return (
    <AsyncSearchCombobox
      value={value}
      onValueChange={onValueChange}
      searchValue={search}
      onSearchValueChange={setSearch}
      options={items.filter((item) => item.isActive)}
      selectedOption={selectedItem}
      getOptionValue={(item) => item.id}
      getOptionLabel={(item) => `${item.code} - ${item.name}`}
      getOptionSearchValue={(item) => `${item.code} ${item.name}`}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      loadingMessage={loadingMessage}
      isLoading={isLoading}
      disabled={disabled}
      renderOption={(item, selected) => (
        <div className="flex min-w-0 items-center gap-2">
          <Check className={`h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`} />
          <div className="min-w-0">
            <div className="truncate font-medium">{item.code}</div>
            <div className="truncate text-xs text-muted-foreground">{item.name}</div>
          </div>
        </div>
      )}
    />
  );
}
