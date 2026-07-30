"use client";

import { type ReactNode, useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useItem, useItems } from "@/hooks/useItems";
import { cn } from "@/lib/utils";
import type { ItemPriceTier } from "@/types/item";

export type ItemSelectOption = {
  id: string;
  code: string;
  name: string;
  description?: string;
  uom: string;
  uomId: string;
  listPrice: number;
  defaultPriceTier?: string | null;
  priceTiers?: ItemPriceTier[];
  available?: number;
  reorderPoint?: number;
  isActive?: boolean;
};

type ItemSelectProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  onItemSelect?: (item: ItemSelectOption) => void;
  selectedOption?: ItemSelectOption | null;
  disabled?: boolean;
  enabled?: boolean;
  warehouseId?: string;
  includeStock?: boolean;
  showStock?: boolean;
  renderTrailing?: (item: ItemSelectOption) => ReactNode;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  loadingMessage?: string;
};

const toItemSelectOption = (item: {
  id: string;
  code: string;
  name: string;
  uom: string;
  uomId: string;
  listPrice: number | null;
  defaultPriceTier?: string | null;
  priceTiers?: ItemPriceTier[];
  available?: number;
  reorderPoint?: number;
  reorderLevel?: number;
  isActive?: boolean;
  description?: string;
}): ItemSelectOption => ({
  id: item.id,
  code: item.code,
  name: item.name,
  description: item.description,
  uom: item.uom,
  uomId: item.uomId,
  listPrice: item.listPrice ?? 0,
  defaultPriceTier: item.defaultPriceTier,
  priceTiers: item.priceTiers,
  available: item.available,
  reorderPoint: item.reorderPoint ?? item.reorderLevel,
  isActive: item.isActive,
});

export function ItemSelect({
  value = "",
  onValueChange,
  onItemSelect,
  selectedOption = null,
  disabled,
  enabled = true,
  warehouseId,
  includeStock = false,
  showStock = false,
  renderTrailing,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  loadingMessage,
}: ItemSelectProps) {
  const t = useTranslations("inventoryItemSelect");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const {
    data: itemsData,
    isLoading,
    isFetching,
  } = useItems({
    limit: 5,
    search: debouncedSearch || undefined,
    warehouseId,
    includeStock: includeStock || showStock,
    isActive: true,
    enabled,
  });
  const items = (itemsData?.data || []).map(toItemSelectOption);
  const selectedItemFromPage = items.find((item) => item.id === value) ?? null;
  const selectedItemLookupId = value && !selectedOption && !selectedItemFromPage ? value : "";
  const { data: selectedItemResponse } = useItem(selectedItemLookupId);
  const fetchedSelectedItem = selectedItemResponse?.data
    ? toItemSelectOption(selectedItemResponse.data)
    : null;
  const selectedItem = selectedOption ?? selectedItemFromPage ?? fetchedSelectedItem;

  return (
    <AsyncSearchCombobox
      value={value}
      onValueChange={(nextValue) => {
        onValueChange?.(nextValue);
        const selected = items.find((item) => item.id === nextValue);
        if (selected) {
          onItemSelect?.(selected);
        }
      }}
      searchValue={search}
      onSearchValueChange={setSearch}
      options={items.filter((item) => item.isActive !== false)}
      selectedOption={selectedItem}
      getOptionValue={(item) => item.id}
      getOptionLabel={(item) => `${item.code} - ${item.name}`}
      getOptionSearchValue={(item) => `${item.code} ${item.name}`}
      placeholder={placeholder ?? t("selectItem")}
      searchPlaceholder={searchPlaceholder ?? t("searchItems")}
      emptyMessage={emptyMessage ?? t("noItemsFound")}
      loadingMessage={loadingMessage ?? t("loadingItems")}
      isLoading={isLoading || isFetching}
      disabled={disabled}
      renderOption={(item, selected) => (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Check className={cn("h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium">{showStock ? item.name : item.code}</span>
              {showStock && (item.available ?? 0) <= 0 ? (
                <span className="shrink-0 text-xs font-medium text-red-700">{t("outOfStock")}</span>
              ) : null}
              {showStock &&
              (item.available ?? 0) > 0 &&
              (item.available ?? 0) <= (item.reorderPoint ?? 0) ? (
                <span className="shrink-0 text-xs font-medium text-amber-700">{t("lowStock")}</span>
              ) : null}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {showStock
                ? `${item.code} • ${item.uom} • ${t("stockCount", {
                    count: (item.available ?? 0).toFixed(2),
                  })}`
                : item.name}
            </div>
          </div>
          {renderTrailing ? (
            <div className="shrink-0 text-sm font-medium">{renderTrailing(item)}</div>
          ) : null}
        </div>
      )}
    />
  );
}
