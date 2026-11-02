"use client";

import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrency } from "@/hooks/useCurrency";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useItem, useItems } from "@/hooks/useItems";
import { cn } from "@/lib/utils";
import {
  formatDocumentAmount,
  formatDocumentQuantity,
  getDocumentCurrencySymbol,
} from "@/lib/documents/document-display";
import { isValidDocumentLineQuantity } from "@/lib/validations/document-line";
import type { DocumentFormLine } from "@/types/document-line";
import type { Item } from "@/types/item";
import { getDocumentLineGridStyle, type DocumentLineColumn } from "./document-line-columns";

// Narrow projection shared by the item list and item-with-stock response shapes.
type DocumentItemOption = Pick<
  Item,
  | "id"
  | "code"
  | "name"
  | "isActive"
  | "importCost"
  | "importCurrency"
  | "purchasePrice"
  | "listPrice"
>;

type LineEntryField = "item" | "unit" | "quantity" | "unitCost";

type LineEntryError = {
  field: LineEntryField;
  message: string;
};

type DocumentLineEntryProps = {
  columns: DocumentLineColumn[];
  canViewUnitCost: boolean;
  /** Currency every line must share; null when the document has no lines or hides costs. */
  lockedCurrency: string | null;
  mixedCurrencyMessage: string;
  /** Items already on the document; when given, adding one of them again is rejected. */
  existingItemIds?: ReadonlySet<string>;
  itemTriggerRef: RefObject<HTMLButtonElement | null>;
  linesError: string | null;
  onAdd: (line: DocumentFormLine) => void;
  onEntryChange: (hasPendingEntry: boolean) => void;
};

const getDefaultUnitCost = (item?: DocumentItemOption | null) =>
  item?.importCost ?? item?.purchasePrice ?? item?.listPrice ?? 0;

const normalizeCurrencyCode = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
};

const getDefaultCostCurrency = (item: DocumentItemOption | null | undefined, fallback: string) =>
  item?.importCost != null ? (normalizeCurrencyCode(item.importCurrency) ?? fallback) : fallback;

const cellClassName = "min-w-0 lg:px-2 lg:first:pl-0 lg:last:pr-0";
const labelClassName = "mb-1.5 block text-sm font-medium";
const derivedValueClassName = "flex h-10 items-center justify-end text-sm tabular-nums";

export function DocumentLineEntry({
  columns,
  canViewUnitCost,
  lockedCurrency,
  mixedCurrencyMessage,
  existingItemIds,
  itemTriggerRef,
  linesError,
  onAdd,
  onEntryChange,
}: DocumentLineEntryProps) {
  const t = useTranslations("documentLines");
  const locale = useLocale();
  const fieldId = useId();
  const { currentCurrency } = useCurrency();
  const containerRef = useRef<HTMLDivElement>(null);
  const unitTriggerRef = useRef<HTMLButtonElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const unitCostRef = useRef<HTMLInputElement>(null);

  const [selectedItem, setSelectedItem] = useState<DocumentItemOption | null>(null);
  const [selectedUnitOptionId, setSelectedUnitOptionId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [entryError, setEntryError] = useState<LineEntryError | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const debouncedItemSearch = useDebouncedValue(itemSearch.trim(), 250);
  const isSearchingItems = debouncedItemSearch.length > 0;

  const { data: preloadItemsData, isLoading: isPreloadingItems } = useItems({
    limit: 5,
    enabled: !isSearchingItems,
  });
  const { data: searchedItemsData, isLoading: isSearchingItemsLoading } = useItems({
    search: debouncedItemSearch,
    limit: 5,
    enabled: isSearchingItems,
  });
  const itemOptions = useMemo<DocumentItemOption[]>(
    () =>
      ((isSearchingItems ? searchedItemsData?.data : preloadItemsData?.data) ?? []).filter(
        (item) => item.isActive
      ),
    [isSearchingItems, preloadItemsData?.data, searchedItemsData?.data]
  );

  const { data: selectedItemResponse } = useItem(selectedItem?.id ?? "");
  const selectedItemDetail =
    selectedItemResponse?.data.id === selectedItem?.id ? selectedItemResponse?.data : undefined;
  const unitOptions = useMemo(
    () => (selectedItemDetail?.unitOptions ?? []).filter((option) => option.isActive),
    [selectedItemDetail?.unitOptions]
  );
  const selectedUnitOption = unitOptions.find((option) => option.id === selectedUnitOptionId);
  const unitLabel = selectedUnitOption
    ? selectedUnitOption.optionLabel?.trim() || selectedUnitOption.uomName
    : "";
  const qtyPerUnit = selectedUnitOption?.qtyPerUnit ?? 1;
  const parsedQuantity = isValidDocumentLineQuantity(quantity) ? Number(quantity) : 0;
  const parsedUnitCost = Number.parseFloat(unitCost);
  const costCurrency = getDefaultCostCurrency(selectedItem, currentCurrency.code);
  const totalQty = parsedQuantity * qtyPerUnit;
  const lineTotal = Number.isFinite(parsedUnitCost) ? totalQty * parsedUnitCost : 0;
  const hasPendingEntry = selectedItem != null;

  useEffect(() => {
    onEntryChange(hasPendingEntry);
  }, [hasPendingEntry, onEntryChange]);

  useEffect(() => {
    if (!selectedItemDetail) return;
    const fallbackOption =
      unitOptions.find((option) => option.isDefault) ||
      unitOptions.find((option) => option.isBase) ||
      unitOptions[0];
    setSelectedUnitOptionId((current) =>
      current && unitOptions.some((option) => option.id === current)
        ? current
        : (fallbackOption?.id ?? "")
    );
  }, [selectedItemDetail, unitOptions]);

  const errorFor = (field: LineEntryField) => (entryError?.field === field ? entryError : null);
  const errorId = `${fieldId}-error`;
  const itemInvalid = errorFor("item") != null || linesError != null;

  const focusField = (field: LineEntryField) => {
    const control = {
      item: itemTriggerRef.current,
      unit: unitTriggerRef.current,
      quantity: quantityRef.current,
      unitCost: unitCostRef.current,
    }[field];
    (control?.disabled ? itemTriggerRef.current : control)?.focus();
  };

  const showError = (field: LineEntryField, message: string) => {
    setEntryError({ field, message });
    focusField(field);
  };

  const resetEntry = () => {
    setSelectedItem(null);
    setSelectedUnitOptionId("");
    setQuantity("");
    setUnitCost("");
    setItemSearch("");
    setEntryError(null);
  };

  const handleAdd = () => {
    if (!selectedItem) return showError("item", t("itemRequired"));
    if (existingItemIds?.has(selectedItem.id)) {
      return showError("item", t("duplicateItemNotAllowed", { code: selectedItem.code }));
    }
    if (!selectedUnitOption) return showError("unit", t("unitRequired"));
    if (!isValidDocumentLineQuantity(quantity)) return showError("quantity", t("quantityRequired"));
    if (canViewUnitCost && (!Number.isFinite(parsedUnitCost) || parsedUnitCost < 0)) {
      return showError("unitCost", t("unitCostRequired"));
    }
    if (lockedCurrency && lockedCurrency !== costCurrency) {
      return showError("item", mixedCurrencyMessage);
    }

    const unitPrice = canViewUnitCost ? parsedUnitCost : Number(getDefaultUnitCost(selectedItem));
    onAdd({
      key: crypto.randomUUID(),
      itemId: selectedItem.id,
      itemCode: selectedItem.code,
      itemName: selectedItem.name,
      itemUnitOptionId: selectedUnitOption.id,
      uomId: selectedUnitOption.uomId,
      unitLabel,
      uomCode: selectedUnitOption.uomCode,
      qtyPerUnit,
      quantity: Number(quantity),
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      unitPriceCurrency: costCurrency,
    });
    setAnnouncement(t("lineAdded", { code: selectedItem.code }));
    resetEntry();
    itemTriggerRef.current?.focus();
  };

  // Portaled popovers are outside this container's DOM, so their own Enter/Escape stay untouched.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Node) || !containerRef.current?.contains(event.target)) return;
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      handleAdd();
    } else if (event.key === "Escape" && hasPendingEntry) {
      event.preventDefault();
      resetEntry();
      itemTriggerRef.current?.focus();
    }
  };

  const visibleMessage = entryError?.message ?? linesError;

  return (
    <div
      ref={containerRef}
      role="group"
      aria-labelledby={`${fieldId}-title`}
      onKeyDown={handleKeyDown}
      className="border-b bg-primary/5 px-5 py-5 sm:px-7"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 id={`${fieldId}-title`} className="text-sm font-semibold">
          {t("newItemTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t.rich("newItemHint", {
            kbd: (chunks) => (
              <kbd className="rounded border border-b-2 bg-background px-1.5 font-sans text-xs font-semibold text-foreground">
                {chunks}
              </kbd>
            ),
          })}
        </p>
      </div>

      <div
        style={getDocumentLineGridStyle(columns)}
        className="mt-4 grid grid-cols-2 items-start gap-x-3 gap-y-4 lg:grid-cols-[var(--document-line-columns)] lg:gap-x-0"
      >
        <div className={cn(cellClassName, "col-span-2 lg:col-span-1")}>
          <label htmlFor={`${fieldId}-item`} className={labelClassName}>
            {t("item")}
          </label>
          <AsyncSearchCombobox
            value={selectedItem?.id ?? ""}
            onValueChange={(itemId) => {
              const item = itemOptions.find((option) => option.id === itemId) ?? null;
              setSelectedItem(item);
              setSelectedUnitOptionId("");
              setUnitCost(item ? Number(getDefaultUnitCost(item)).toFixed(2) : "");
              setEntryError(
                item && existingItemIds?.has(item.id)
                  ? {
                      field: "item",
                      message: t("duplicateItemNotAllowed", { code: item.code }),
                    }
                  : null
              );
            }}
            searchValue={itemSearch}
            onSearchValueChange={setItemSearch}
            options={itemOptions}
            selectedOption={selectedItem}
            getOptionValue={(item) => item.id}
            getOptionLabel={(item) => `${item.code} · ${item.name}`}
            getOptionSearchValue={(item) => `${item.code} ${item.name}`}
            renderOption={(item) => (
              <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold">{item.code}</div>
                  <div className="whitespace-normal text-sm text-muted-foreground">{item.name}</div>
                </div>
                {canViewUnitCost ? (
                  <div className="shrink-0 text-sm tabular-nums">
                    {formatDocumentAmount(
                      Number(getDefaultUnitCost(item)),
                      getDefaultCostCurrency(item, currentCurrency.code),
                      locale
                    )}
                  </div>
                ) : null}
              </div>
            )}
            placeholder={t("searchItem")}
            searchPlaceholder={t("searchItem")}
            emptyMessage={t("noItemFound")}
            loadingMessage={t("loadingItems")}
            isLoading={isSearchingItems ? isSearchingItemsLoading : isPreloadingItems}
            triggerRef={itemTriggerRef}
            triggerId={`${fieldId}-item`}
            invalid={itemInvalid}
            describedBy={itemInvalid ? errorId : undefined}
            buttonClassName="h-10 bg-background"
            popoverClassName="lg:w-96"
          />
        </div>

        <div className={cn(cellClassName, "col-span-2 lg:col-span-1")}>
          <label htmlFor={`${fieldId}-unit`} className={labelClassName}>
            {t("unit")}
          </label>
          <Select
            value={selectedUnitOptionId}
            onValueChange={(value) => {
              setSelectedUnitOptionId(value);
              setEntryError((error) => (error?.field === "unit" ? null : error));
            }}
            disabled={!selectedItem || unitOptions.length === 0}
          >
            <SelectTrigger
              ref={unitTriggerRef}
              id={`${fieldId}-unit`}
              aria-invalid={errorFor("unit") != null}
              aria-describedby={errorFor("unit") ? errorId : undefined}
              className="h-10 bg-background"
            >
              <SelectValue placeholder={t("selectUnit")} />
            </SelectTrigger>
            <SelectContent>
              {unitOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.optionLabel?.trim() || option.uomName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedUnitOption ? (
            <p className="mt-1.5 px-3 text-xs text-muted-foreground">
              {t("qtyPerUnit", {
                qty: formatDocumentQuantity(qtyPerUnit, locale),
                unit: selectedUnitOption.uomCode || unitLabel,
              })}
            </p>
          ) : null}
        </div>

        <div className={cellClassName}>
          <label htmlFor={`${fieldId}-quantity`} className={cn(labelClassName, "lg:text-right")}>
            {t("qty")}
          </label>
          <Input
            ref={quantityRef}
            id={`${fieldId}-quantity`}
            inputMode="decimal"
            value={quantity}
            placeholder="0"
            onChange={(event) => {
              setQuantity(event.target.value);
              setEntryError((error) => (error?.field === "quantity" ? null : error));
            }}
            aria-invalid={errorFor("quantity") != null}
            aria-describedby={errorFor("quantity") ? errorId : undefined}
            className="h-10 bg-background text-right tabular-nums"
          />
        </div>

        <div className={cellClassName}>
          <span className={cn(labelClassName, "lg:text-right")}>{t("totalQty")}</span>
          <div className={cn(derivedValueClassName, !parsedQuantity && "text-muted-foreground")}>
            {selectedUnitOption && parsedQuantity
              ? formatDocumentQuantity(totalQty, locale)
              : t("noValue")}
          </div>
        </div>

        {columns.includes("unitCost") ? (
          <div className={cellClassName}>
            <label htmlFor={`${fieldId}-unitCost`} className={cn(labelClassName, "lg:text-right")}>
              {t("unitCost")}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {getDocumentCurrencySymbol(costCurrency, locale)}
              </span>
              <Input
                ref={unitCostRef}
                id={`${fieldId}-unitCost`}
                inputMode="decimal"
                value={unitCost}
                placeholder="0.00"
                onChange={(event) => {
                  const next = event.target.value;
                  if (next === "" || /^\d*(\.\d{0,2})?$/.test(next)) {
                    setUnitCost(next);
                    setEntryError((error) => (error?.field === "unitCost" ? null : error));
                  }
                }}
                aria-invalid={errorFor("unitCost") != null}
                aria-describedby={errorFor("unitCost") ? errorId : undefined}
                className="h-10 bg-background pl-8 text-right tabular-nums"
              />
            </div>
          </div>
        ) : null}

        {columns.includes("lineTotal") ? (
          <div className={cellClassName}>
            <span className={cn(labelClassName, "lg:text-right")}>{t("lineTotal")}</span>
            <div
              className={cn(
                derivedValueClassName,
                "font-semibold",
                !lineTotal && "text-muted-foreground"
              )}
            >
              {formatDocumentAmount(lineTotal, costCurrency, locale)}
            </div>
          </div>
        ) : null}

        <div className={cn(cellClassName, "col-span-2 lg:col-span-1")}>
          <span aria-hidden="true" className={cn(labelClassName, "hidden lg:block")}>
            &nbsp;
          </span>
          <Button type="button" onClick={handleAdd} className="h-10 w-full">
            {t("addLine")}
          </Button>
        </div>
      </div>

      {visibleMessage ? (
        <p id={errorId} role="alert" className="mt-3 text-sm font-medium text-destructive">
          {visibleMessage}
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
