"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { FieldErrors, Path } from "react-hook-form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateStockRequisition, useUpdateStockRequisition } from "@/hooks/useStockRequisitions";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSupplier, useSuppliers } from "@/hooks/useSuppliers";
import { useItem, useItems } from "@/hooks/useItems";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCurrency } from "@/hooks/useCurrency";
import { useGranularCapabilities } from "@/hooks/useGranularCapabilities";
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import {
  createStockRequisitionFormSchema,
  type StockRequisitionFormValues,
} from "@/lib/validations/stock-requisition";
import type { StockRequisition } from "@/types/stock-requisition";
import { cn } from "@/lib/utils";

type RequisitionCostSource = {
  importCost?: number | null;
  importCurrency?: string | null;
  purchasePrice?: number | null;
  listPrice?: number | null;
};

const getDefaultRequisitionUnitCost = (item: RequisitionCostSource | null | undefined): number => {
  const cost = item?.importCost ?? item?.purchasePrice ?? item?.listPrice ?? 0;
  const parsed = Number(cost);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getDefaultRequisitionCostCurrency = (
  item: RequisitionCostSource | null | undefined
): string | null => (item?.importCost != null ? (item.importCurrency ?? null) : null);

const getNarrowCurrencySymbol = (currencyCode: string, fallback: string): string => {
  try {
    const currencyPart = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .formatToParts(0)
      .find((part) => part.type === "currency");

    return currencyPart?.value || fallback;
  } catch {
    return fallback;
  }
};

const formatImportUnitCost = (amount: number, currencyCode: string): string =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
    currencyDisplay: "narrowSymbol",
  }).format(amount);

const getLineItemCurrencyKey = (lineItem: Pick<LineItem, "unitPriceCurrency">): string | null =>
  lineItem.unitPriceCurrency ?? null;

type LineItem = {
  itemId: string;
  itemCode?: string;
  itemName?: string;
  itemUnitOptionId: string;
  uomId: string;
  uomLabel: string;
  qtyPerUnit: number;
  requestedQty: number;
  unitPrice: number;
  unitPriceCurrency?: string | null;
  notes?: string;
};

export type StockRequisitionInitialLineItem = LineItem;

const EMPTY_INITIAL_LINE_ITEMS: StockRequisitionInitialLineItem[] = [];

type StockRequisitionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockRequisition?: StockRequisition | null;
  initialLineItems?: StockRequisitionInitialLineItem[];
};

const STOCK_REQUISITION_COST_CAPABILITY_KEYS = [
  GRANULAR_CAPABILITIES.STOCK_REQUISITIONS_TOTAL_AMOUNT,
  GRANULAR_CAPABILITIES.STOCK_REQUISITIONS_UNIT_COST,
] as const;

// Mirrors the line items table's fixed column widths (w-36, w-20, w-20, w-24, w-32, w-32, w-24)
// so each New Item field sits directly above the column it fills.
const LINE_ITEM_GRID_COLUMNS = {
  quantityOnly: "md:grid-cols-[minmax(0,1fr)_9rem_5rem_5rem_6rem_6rem]",
  withUnitCost: "md:grid-cols-[minmax(0,1fr)_9rem_5rem_5rem_6rem_8rem_6rem]",
  withAmounts: "md:grid-cols-[minmax(0,1fr)_9rem_5rem_5rem_6rem_8rem_8rem_6rem]",
} as const;

export function StockRequisitionFormDialog({
  open,
  onOpenChange,
  stockRequisition,
  initialLineItems = EMPTY_INITIAL_LINE_ITEMS,
}: StockRequisitionFormDialogProps) {
  const t = useTranslations("stockRequisitionForm");
  const tValidation = useTranslations("stockRequisitionValidation");
  const locale = useLocale();
  const newItemFieldId = useId();
  const isEditMode = !!stockRequisition;
  const { formatCurrency, currentCurrency } = useCurrency();
  const { data: granularCapabilities } = useGranularCapabilities(
    STOCK_REQUISITION_COST_CAPABILITY_KEYS
  );
  const canViewTotalAmount =
    stockRequisition?.capabilities?.canViewTotalAmount ??
    granularCapabilities?.[GRANULAR_CAPABILITIES.STOCK_REQUISITIONS_TOTAL_AMOUNT] === true;
  const canViewUnitCost =
    stockRequisition?.capabilities?.canViewUnitCost ??
    granularCapabilities?.[GRANULAR_CAPABILITIES.STOCK_REQUISITIONS_UNIT_COST] === true;
  const canShowFormAmounts = canViewTotalAmount && canViewUnitCost;
  const createMutation = useCreateStockRequisition();
  const updateMutation = useUpdateStockRequisition();
  const [supplierSearch, setSupplierSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const debouncedSupplierSearch = useDebouncedValue(supplierSearch.trim());
  const debouncedItemSearch = useDebouncedValue(itemSearch.trim());
  const srFormSchema = useMemo(
    () => createStockRequisitionFormSchema((key) => tValidation(key)),
    [tValidation]
  );

  const { data: suppliersData, isLoading: isSuppliersLoading } = useSuppliers({
    search: debouncedSupplierSearch || undefined,
    status: "active",
    limit: 5,
  });
  const suppliers = suppliersData?.data || [];

  const { data: itemsData, isLoading: isItemsLoading } = useItems({
    search: debouncedItemSearch || undefined,
    limit: 5,
  });
  const items = useMemo(() => itemsData?.data || [], [itemsData?.data]);

  // Line items state
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedUnitOptionId, setSelectedUnitOptionId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [addItemError, setAddItemError] = useState("");
  const { data: selectedItemResponse } = useItem(selectedItemId);
  const selectedItemDetail = selectedItemResponse?.data;
  const itemOptions = useMemo(() => {
    const activeItems = items.filter((item) => item.isActive);
    if (!selectedItemDetail || activeItems.some((item) => item.id === selectedItemDetail.id)) {
      return activeItems;
    }

    return [selectedItemDetail, ...activeItems];
  }, [items, selectedItemDetail]);
  const unitOptions = (selectedItemDetail?.unitOptions || []).filter((option) => option.isActive);
  const selectedUnitOption =
    unitOptions.find((option) => option.id === selectedUnitOptionId) ||
    selectedItemDetail?.unitOptions?.find((option) => option.id === selectedUnitOptionId) ||
    null;
  const selectedCostItem =
    selectedItemDetail ?? items.find((item) => item.id === selectedItemId) ?? null;
  const selectedImportCurrency = getDefaultRequisitionCostCurrency(selectedCostItem);
  const selectedCostCurrency = selectedImportCurrency ?? currentCurrency.code;
  const selectedUnitCostSymbol = getNarrowCurrencySymbol(
    selectedCostCurrency,
    selectedCostCurrency
  );
  const formatRequisitionUnitCost = (
    item: (RequisitionCostSource & { importCurrency?: string | null }) | null | undefined
  ) => {
    const amount = getDefaultRequisitionUnitCost(item);
    const currencyCode = getDefaultRequisitionCostCurrency(item) ?? currentCurrency.code;
    return currencyCode === currentCurrency.code
      ? formatCurrency(amount)
      : formatImportUnitCost(amount, currencyCode);
  };

  // Default values
  const defaultValues = useMemo<StockRequisitionFormValues>(
    () => ({
      supplierId: "",
      requisitionDate: new Date().toISOString().split("T")[0],
      requiredByDate: "",
      notes: "",
    }),
    []
  );

  const form = useForm<StockRequisitionFormValues>({
    resolver: zodResolver(srFormSchema),
    defaultValues,
  });
  const selectedSupplierId = form.watch("supplierId");
  const { data: selectedSupplierData } = useSupplier(selectedSupplierId);
  const selectedSupplier =
    suppliers.find((supplier) => supplier.id === selectedSupplierId) ??
    selectedSupplierData ??
    null;

  // Calculate totals without adding different currencies together.
  const totalAmountsByCurrency = useMemo(() => {
    const totals = new Map<string | null, number>();
    for (const item of lineItems) {
      const currencyKey = getLineItemCurrencyKey(item);
      const lineTotal = item.requestedQty * item.qtyPerUnit * item.unitPrice;
      totals.set(currencyKey, (totals.get(currencyKey) ?? 0) + lineTotal);
    }
    return Array.from(totals.entries()).map(([currencyCode, amount]) => ({
      currencyCode,
      amount,
    }));
  }, [lineItems]);
  const formatLineItemAmount = (amount: number, currencyCode?: string | null) =>
    currencyCode ? formatImportUnitCost(amount, currencyCode) : formatCurrency(amount);
  const formattedTotalAmount =
    totalAmountsByCurrency.length > 0
      ? totalAmountsByCurrency
          .map(({ amount, currencyCode }) => formatLineItemAmount(amount, currencyCode))
          .join(" + ")
      : formatCurrency(0);

  const derivedTotalQty = selectedUnitOption
    ? Number(quantity || 0) * selectedUnitOption.qtyPerUnit
    : 0;
  const draftLineTotal = derivedTotalQty * Number(price || 0);

  useEffect(() => {
    if (!selectedItemId) return;
    const selectedItem = selectedCostItem;
    if (!selectedItem) return;
    setPrice(getDefaultRequisitionUnitCost(selectedItem).toFixed(2));
  }, [selectedCostItem, selectedItemId]);

  // Reset form when dialog opens/closes or SR changes
  useEffect(() => {
    if (open && stockRequisition) {
      form.reset({
        supplierId: stockRequisition.supplierId,
        requisitionDate: stockRequisition.requisitionDate.split("T")[0],
        requiredByDate: stockRequisition.requiredByDate?.split("T")[0] || "",
        notes: stockRequisition.notes || "",
      });
      // Convert SR line items to form format
      const formLineItems: LineItem[] =
        stockRequisition.items?.map((item) => ({
          itemId: item.itemId,
          itemCode: item.item?.code,
          itemName: item.item?.name,
          itemUnitOptionId: item.itemUnitOptionId || item.itemUnitOption?.id || "",
          uomId: item.uomId,
          uomLabel: item.itemUnitOption?.displayLabel || item.uomCode || "",
          qtyPerUnit: item.itemUnitOption?.qtyPerUnit ?? 1,
          requestedQty: item.requestedQty,
          unitPrice: item.unitPrice ?? 0,
          unitPriceCurrency: canViewUnitCost
            ? (stockRequisition.currency ?? currentCurrency.code)
            : null,
          notes: item.notes,
        })) || [];
      setLineItems(formLineItems);
    } else if (open) {
      form.reset(defaultValues);
      setLineItems(initialLineItems);
      setSelectedItemId("");
      setSelectedUnitOptionId("");
      setQuantity("");
      setPrice("");
      setAddItemError("");
    }
  }, [
    open,
    stockRequisition,
    form,
    defaultValues,
    currentCurrency.code,
    canViewUnitCost,
    initialLineItems,
  ]);

  useEffect(() => {
    if (!selectedItemDetail) {
      setSelectedUnitOptionId("");
      return;
    }

    const fallbackUnitOption =
      unitOptions.find((option) => option.isDefault) ||
      unitOptions.find((option) => option.isBase) ||
      unitOptions[0];

    if (!fallbackUnitOption) {
      setSelectedUnitOptionId("");
      return;
    }

    setSelectedUnitOptionId((currentValue) => {
      if (currentValue && unitOptions.some((option) => option.id === currentValue)) {
        return currentValue;
      }

      return fallbackUnitOption.id;
    });
  }, [selectedItemDetail, unitOptions]);

  const handleAddItem = () => {
    // Clear any previous errors
    setAddItemError("");

    // Validation
    if (!selectedItemId || !selectedUnitOptionId || !quantity || (canViewUnitCost && !price)) {
      setAddItemError(t("addItemMissingFields"));
      return;
    }

    const selectedItem = selectedCostItem;
    if (!selectedItem) {
      setAddItemError(t("itemNotFound"));
      return;
    }

    if (lineItems.some((lineItem) => lineItem.itemId === selectedItemId)) {
      setAddItemError(t("duplicateItemNotAllowed", { item: selectedItem.code }));
      return;
    }

    if (!selectedUnitOption) {
      setAddItemError(t("unitNotFound"));
      return;
    }

    const selectedCurrency = canViewUnitCost ? selectedCostCurrency : null;
    const existingCurrency = lineItems[0] ? getLineItemCurrencyKey(lineItems[0]) : selectedCurrency;
    if (canViewUnitCost && lineItems.length > 0 && existingCurrency !== selectedCurrency) {
      setAddItemError(t("mixedCurrencyNotAllowed"));
      return;
    }

    const newItem: LineItem = {
      itemId: selectedItemId,
      itemCode: selectedItem.code,
      itemName: selectedItem.name,
      itemUnitOptionId: selectedUnitOption.id,
      uomId: selectedUnitOption.uomId,
      uomLabel: selectedUnitOption.displayLabel,
      qtyPerUnit: selectedUnitOption.qtyPerUnit,
      requestedQty: parseFloat(quantity),
      unitPrice: canViewUnitCost ? parseFloat(price) : 0,
      unitPriceCurrency: selectedCurrency,
    };

    setLineItems([...lineItems, newItem]);
    setSelectedItemId("");
    setSelectedUnitOptionId("");
    setQuantity("");
    setPrice("");
    toast.success(t("itemAddedSuccess"));
  };

  const handleRemoveItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  async function onSubmit(values: StockRequisitionFormValues) {
    if (lineItems.length === 0) {
      toast.error(t("lineItemsRequired"));
      return;
    }
    const firstCurrency = lineItems[0] ? getLineItemCurrencyKey(lineItems[0]) : null;
    if (
      canViewUnitCost &&
      lineItems.some((item) => getLineItemCurrencyKey(item) !== firstCurrency)
    ) {
      toast.error(t("mixedCurrencyNotAllowed"));
      return;
    }

    try {
      const requestData = {
        supplierId: values.supplierId,
        requisitionDate: values.requisitionDate,
        requiredByDate: values.requiredByDate,
        notes: values.notes,
        items: lineItems.map((item) => ({
          itemId: item.itemId,
          itemUnitOptionId: item.itemUnitOptionId,
          uomId: item.uomId,
          requestedQty: item.requestedQty,
          notes: item.notes,
        })),
        ...(canViewUnitCost
          ? {
              currency: firstCurrency ?? currentCurrency.code,
              items: lineItems.map((item) => ({
                itemId: item.itemId,
                itemUnitOptionId: item.itemUnitOptionId,
                uomId: item.uomId,
                requestedQty: item.requestedQty,
                unitPrice: item.unitPrice,
                notes: item.notes,
              })),
            }
          : {}),
      };

      if (isEditMode) {
        await updateMutation.mutateAsync({
          id: stockRequisition.id,
          data: requestData,
        });
        toast.success(t("updateSuccess"));
      } else {
        await createMutation.mutateAsync(requestData);
        toast.success(t("createSuccess"));
      }

      onOpenChange(false);
      form.reset();
      setLineItems([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("saveError"));
    }
  }

  const handleInvalidSubmit = (errors: FieldErrors<StockRequisitionFormValues>) => {
    const generalFields: Path<StockRequisitionFormValues>[] = [
      "supplierId",
      "requisitionDate",
      "requiredByDate",
      "notes",
    ];

    const firstGeneralError = generalFields.find((field) => errors[field]);
    if (firstGeneralError) {
      window.requestAnimationFrame(() => form.setFocus(firstGeneralError));
    }
  };

  const lineItemCountLabel = `${lineItems.length} ${
    lineItems.length === 1 ? t("itemSingular") : t("itemPlural")
  }`;
  const lineItemColumnCount = 6 + (canViewUnitCost ? 1 : 0) + (canShowFormAmounts ? 1 : 0);
  const lineItemGridColumns = canShowFormAmounts
    ? LINE_ITEM_GRID_COLUMNS.withAmounts
    : canViewUnitCost
      ? LINE_ITEM_GRID_COLUMNS.withUnitCost
      : LINE_ITEM_GRID_COLUMNS.quantityOnly;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-7xl flex-col gap-0 p-0">
        {/* Header */}
        <div className="flex-shrink-0 px-8 pb-5 pr-14 pt-6">
          <DialogTitle className="text-xl font-semibold tracking-tight text-gray-900">
            {isEditMode ? t("editTitle") : t("createTitle")}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-gray-600">
            {isEditMode ? t("editDescription") : t("createDescription")}
          </DialogDescription>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto"
          >
            {/* Requisition details */}
            <div className="grid flex-shrink-0 grid-cols-1 gap-4 border-y border-gray-200 bg-gray-50 px-8 py-5 md:grid-cols-6">
              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel className="text-sm font-medium text-gray-700">
                      {t("supplierLabel")}
                    </FormLabel>
                    <FormControl>
                      <AsyncSearchCombobox
                        value={field.value}
                        onValueChange={field.onChange}
                        searchValue={supplierSearch}
                        onSearchValueChange={setSupplierSearch}
                        options={suppliers}
                        selectedOption={selectedSupplier}
                        getOptionValue={(supplier) => supplier.id}
                        getOptionLabel={(supplier) => `${supplier.name} (${supplier.code})`}
                        getOptionSearchValue={(supplier) => `${supplier.code} ${supplier.name}`}
                        placeholder={t("selectSupplier")}
                        searchPlaceholder={t("selectSupplier")}
                        emptyMessage={t("selectSupplier")}
                        isLoading={isSuppliersLoading}
                        buttonClassName="h-10 bg-white text-sm border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="requisitionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      {t("requisitionDateLabel")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        className="h-10 border-gray-300 bg-white text-sm focus:border-purple-500 focus:ring-purple-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="requiredByDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      {t("requiredByDateLabel")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        className="h-10 border-gray-300 bg-white text-sm focus:border-purple-500 focus:ring-purple-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel className="text-sm font-medium text-gray-700">
                      {t("notesLabel")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={1}
                        placeholder={t("notesPlaceholder")}
                        className="h-10 min-h-10 resize-none border-gray-300 bg-white text-sm focus:border-purple-500 focus:ring-purple-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* New item and line items */}
            <div className="flex min-h-96 flex-1 flex-col px-8 py-5">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200">
                <section
                  aria-labelledby={`${newItemFieldId}-title`}
                  className="flex-shrink-0 border-b border-purple-200 bg-purple-50/60 pb-4 pt-3.5"
                >
                  <h3
                    id={`${newItemFieldId}-title`}
                    className="px-4 text-sm font-semibold text-purple-800"
                  >
                    {t("newItemTitle")}
                  </h3>
                  <div
                    className={cn(
                      "mt-2.5 grid grid-cols-2 items-end gap-3 px-4 md:gap-0 md:px-0",
                      lineItemGridColumns
                    )}
                  >
                    <div className="col-span-2 space-y-1.5 md:col-span-1 md:pl-4 md:pr-2">
                      <span className="block text-xs font-medium text-gray-600">
                        {t("itemColumn")}
                      </span>
                      <AsyncSearchCombobox
                        value={selectedItemId}
                        onValueChange={(value) => {
                          setSelectedItemId(value);
                          const selectedItem = items.find((item) => item.id === value);
                          setSelectedUnitOptionId("");
                          setPrice(getDefaultRequisitionUnitCost(selectedItem).toFixed(2));
                          const existingLine = lineItems.find(
                            (lineItem) => lineItem.itemId === value
                          );
                          setAddItemError(
                            existingLine
                              ? t("duplicateItemNotAllowed", {
                                  item: existingLine.itemCode ?? existingLine.itemName ?? "",
                                })
                              : ""
                          );
                        }}
                        searchValue={itemSearch}
                        onSearchValueChange={setItemSearch}
                        options={itemOptions}
                        selectedOption={selectedItemDetail ?? null}
                        getOptionValue={(item) => item.id}
                        getOptionLabel={(item) => `${item.code} - ${item.name}`}
                        getOptionSearchValue={(item) => `${item.code} ${item.name}`}
                        placeholder={t("searchItemByCodeOrName")}
                        searchPlaceholder={t("searchItemByCodeOrName")}
                        emptyMessage={t("noItemFound")}
                        isLoading={isItemsLoading}
                        buttonClassName="h-10 w-full min-w-0 justify-between bg-white text-sm border-gray-300 hover:border-purple-400"
                        popoverClassName="w-[520px]"
                        renderOption={(item, selected) => (
                          <div className="flex w-full items-start justify-between gap-3 py-2">
                            <div className="flex min-w-0 items-start gap-2">
                              <Check
                                className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? "opacity-100" : "opacity-0"}`}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium">{item.code}</div>
                                <div className="whitespace-normal break-words text-sm leading-snug text-muted-foreground">
                                  {item.name}
                                </div>
                              </div>
                            </div>
                            {canViewUnitCost && (
                              <div className="flex-shrink-0 self-start pl-3 text-right text-sm font-semibold tabular-nums">
                                {formatRequisitionUnitCost(item)}
                              </div>
                            )}
                          </div>
                        )}
                      />
                    </div>
                    <div className="space-y-1.5 md:px-2">
                      <Label
                        htmlFor={`${newItemFieldId}-unit`}
                        className="block text-xs font-medium text-gray-600"
                      >
                        {t("unitLabel")}
                      </Label>
                      <Select
                        value={selectedUnitOptionId}
                        onValueChange={(value) => {
                          setSelectedUnitOptionId(value);
                          setAddItemError("");
                        }}
                        disabled={!selectedItemId || unitOptions.length === 0}
                      >
                        <SelectTrigger
                          id={`${newItemFieldId}-unit`}
                          className="h-10 border-gray-300 bg-white text-sm focus:border-purple-500 focus:ring-purple-500"
                        >
                          <SelectValue
                            placeholder={selectedItemId ? t("selectUnit") : t("selectItemFirst")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {unitOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.displayLabel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 md:px-2">
                      <span
                        id={`${newItemFieldId}-qty-per-unit`}
                        className="block text-right text-xs font-medium text-gray-600"
                      >
                        {t("qtyPerUnitLabel")}
                      </span>
                      <output
                        aria-labelledby={`${newItemFieldId}-qty-per-unit`}
                        className="flex h-10 items-center justify-end text-sm tabular-nums text-gray-600"
                      >
                        {selectedUnitOption
                          ? selectedUnitOption.qtyPerUnit.toLocaleString(locale, {
                              maximumFractionDigits: 4,
                            })
                          : "--"}
                      </output>
                    </div>
                    <div className="space-y-1.5 md:px-2">
                      <Label
                        htmlFor={`${newItemFieldId}-qty`}
                        className="block text-right text-xs font-medium text-gray-600"
                      >
                        {t("qty")}
                      </Label>
                      <Input
                        id={`${newItemFieldId}-qty`}
                        type="number"
                        placeholder={t("quantityPlaceholder")}
                        value={quantity}
                        onChange={(e) => {
                          setQuantity(e.target.value);
                          setAddItemError("");
                        }}
                        step="0.01"
                        className="h-10 border-gray-300 bg-white px-2 text-right text-sm tabular-nums focus:border-purple-500 focus:ring-purple-500"
                      />
                    </div>
                    <div className="space-y-1.5 md:px-2">
                      <span
                        id={`${newItemFieldId}-total-qty`}
                        className="block text-right text-xs font-medium text-gray-600"
                      >
                        {t("totalQtyLabel")}
                      </span>
                      <output
                        aria-labelledby={`${newItemFieldId}-total-qty`}
                        className="flex h-10 items-center justify-end text-sm tabular-nums text-gray-600"
                      >
                        {selectedUnitOption
                          ? derivedTotalQty.toLocaleString(locale, { maximumFractionDigits: 4 })
                          : "--"}
                      </output>
                    </div>
                    {canViewUnitCost && (
                      <div className="space-y-1.5 md:px-2">
                        <Label
                          htmlFor={`${newItemFieldId}-unit-cost`}
                          className="block text-right text-xs font-medium text-gray-600"
                        >
                          {t("unitCostLabel")}
                        </Label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-sm text-gray-500">
                            {selectedUnitCostSymbol}
                          </span>
                          <Input
                            key={`unit-price-${selectedItemId}`}
                            id={`${newItemFieldId}-unit-cost`}
                            type="text"
                            inputMode="decimal"
                            pattern="^-?\d*(\.\d{0,2})?$"
                            placeholder={t("unitPricePlaceholder")}
                            value={price ?? ""}
                            onChange={(e) => {
                              const next = e.target.value;
                              if (next === "" || /^-?\d*(\.\d{0,2})?$/.test(next)) {
                                setPrice(next);
                                setAddItemError("");
                              }
                            }}
                            className="h-10 border-gray-300 bg-white pl-7 pr-2 text-right text-sm tabular-nums focus:border-purple-500 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                    )}
                    {canShowFormAmounts && (
                      <div className="space-y-1.5 md:px-4">
                        <span
                          id={`${newItemFieldId}-line-total`}
                          className="block text-right text-xs font-medium text-gray-600"
                        >
                          {t("total")}
                        </span>
                        <output
                          aria-labelledby={`${newItemFieldId}-line-total`}
                          className="flex h-10 items-center justify-end text-sm font-semibold tabular-nums text-gray-900"
                        >
                          {selectedUnitOption
                            ? formatLineItemAmount(draftLineTotal, selectedCostCurrency)
                            : "--"}
                        </output>
                      </div>
                    )}
                    <div className="col-span-2 md:col-span-1 md:pl-1.5 md:pr-3">
                      <Button
                        type="button"
                        onClick={handleAddItem}
                        className="h-10 w-full gap-1 bg-purple-600 px-2 text-sm font-semibold text-white hover:bg-purple-700"
                      >
                        <Plus className="h-4 w-4" />
                        {t("addItem")}
                      </Button>
                    </div>
                  </div>

                  {addItemError && (
                    <p
                      role="alert"
                      className="mx-4 mt-3 flex items-start gap-2 text-sm font-medium text-red-700"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      {addItemError}
                    </p>
                  )}
                </section>

                <section
                  aria-labelledby={`${newItemFieldId}-items-title`}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <div className="flex flex-shrink-0 items-center gap-2.5 px-4 pb-2.5 pt-3.5">
                    <h3
                      id={`${newItemFieldId}-items-title`}
                      className="text-sm font-semibold text-gray-900"
                    >
                      {t("itemsTitle")}
                    </h3>
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-purple-800">
                      {lineItems.length}
                    </span>
                  </div>

                  <Table className="table-fixed" containerClassName="min-h-0 flex-1">
                    <TableHeader className="sticky top-0 z-10 bg-gray-50">
                      <TableRow className="border-y border-gray-200 bg-gray-50 hover:bg-gray-50">
                        <TableHead className="h-10 text-xs font-semibold text-gray-600">
                          {t("itemColumn")}
                        </TableHead>
                        <TableHead className="h-10 w-36 px-2 text-xs font-semibold text-gray-600">
                          {t("unitLabel")}
                        </TableHead>
                        <TableHead className="h-10 w-20 px-2 text-right text-xs font-semibold text-gray-600">
                          {t("qtyPerUnitLabel")}
                        </TableHead>
                        <TableHead className="h-10 w-20 px-2 text-right text-xs font-semibold text-gray-600">
                          {t("qty")}
                        </TableHead>
                        <TableHead className="h-10 w-24 px-2 text-right text-xs font-semibold text-gray-600">
                          {t("totalQtyLabel")}
                        </TableHead>
                        {canViewUnitCost && (
                          <TableHead className="h-10 w-32 px-2 text-right text-xs font-semibold text-gray-600">
                            {t("unitCostLabel")}
                          </TableHead>
                        )}
                        {canShowFormAmounts && (
                          <TableHead className="h-10 w-32 text-right text-xs font-semibold text-gray-600">
                            {t("total")}
                          </TableHead>
                        )}
                        <TableHead className="h-10 w-24">
                          <span className="sr-only">{t("actionsColumn")}</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.length === 0 && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={lineItemColumnCount} className="py-8 text-center">
                            <p className="text-sm font-medium text-gray-900">{t("noItemsTitle")}</p>
                            <p className="mt-1 text-sm text-gray-600">{t("noItemsDescription")}</p>
                          </TableCell>
                        </TableRow>
                      )}
                      {lineItems.map((item, index) => (
                        <TableRow key={index} className="border-b border-gray-100">
                          <TableCell className="py-3">
                            <div className="font-semibold text-gray-900">{item.itemCode}</div>
                            <div className="truncate text-sm text-gray-600" title={item.itemName}>
                              {item.itemName}
                            </div>
                          </TableCell>
                          <TableCell className="px-2 py-3 text-sm text-gray-700">
                            {item.uomLabel}
                          </TableCell>
                          <TableCell className="px-2 py-3 text-right text-sm tabular-nums text-gray-600">
                            {item.qtyPerUnit.toLocaleString(locale, { maximumFractionDigits: 4 })}
                          </TableCell>
                          <TableCell className="px-2 py-3 text-right text-sm font-medium tabular-nums text-gray-900">
                            {item.requestedQty}
                          </TableCell>
                          <TableCell className="px-2 py-3 text-right text-sm tabular-nums text-gray-600">
                            {(item.requestedQty * item.qtyPerUnit).toLocaleString(locale, {
                              maximumFractionDigits: 4,
                            })}
                          </TableCell>
                          {canViewUnitCost && (
                            <TableCell className="px-2 py-3 text-right text-sm tabular-nums text-gray-600">
                              {formatLineItemAmount(item.unitPrice, item.unitPriceCurrency)}
                            </TableCell>
                          )}
                          {canShowFormAmounts && (
                            <TableCell className="py-3 text-right text-sm font-semibold tabular-nums text-gray-900">
                              {formatLineItemAmount(
                                item.requestedQty * item.qtyPerUnit * item.unitPrice,
                                item.unitPriceCurrency
                              )}
                            </TableCell>
                          )}
                          <TableCell className="px-3 py-3 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(index)}
                              aria-label={t("removeItem", {
                                item: item.itemCode ?? item.itemName ?? "",
                              })}
                              className="h-9 w-9 rounded-lg p-0 text-gray-500 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-4 border-t border-gray-200 bg-gray-50 px-8 py-4">
              <p className="text-sm text-gray-600">{lineItemCountLabel}</p>
              <div className="flex flex-wrap items-center gap-6">
                {canShowFormAmounts && (
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-sm text-gray-600">{t("totalAmount")}</span>
                    <span className="text-xl font-semibold tabular-nums tracking-tight text-gray-900">
                      {formattedTotalAmount}
                    </span>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="h-10 border-gray-300 px-5 text-sm hover:bg-gray-100"
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="h-10 bg-purple-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
                  >
                    {isSaving ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        {t("saving")}
                      </span>
                    ) : (
                      <>{isEditMode ? t("updateAction") : t("createAction")}</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
