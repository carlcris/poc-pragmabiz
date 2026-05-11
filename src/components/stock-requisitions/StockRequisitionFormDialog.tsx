"use client";

import { useEffect, useMemo, useState } from "react";
import type { FieldErrors, Path } from "react-hook-form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Check, Plus, Trash2, FileText, Package, ShoppingCart } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrency } from "@/hooks/useCurrency";
import { useGranularCapabilities } from "@/hooks/useGranularCapabilities";
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import {
  createStockRequisitionFormSchema,
  type StockRequisitionFormValues,
} from "@/lib/validations/stock-requisition";
import type { StockRequisition } from "@/types/stock-requisition";

type RequisitionCostSource = {
  importCost?: number | null;
  importCurrency?: string | null;
  purchasePrice?: number | null;
  standardCost?: number | null;
  listPrice?: number | null;
};

const getDefaultRequisitionUnitCost = (item: RequisitionCostSource | null | undefined): number => {
  const cost =
    item?.importCost ?? item?.purchasePrice ?? item?.standardCost ?? item?.listPrice ?? 0;
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

type StockRequisitionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockRequisition?: StockRequisition | null;
};

const STOCK_REQUISITION_COST_CAPABILITY_KEYS = [
  GRANULAR_CAPABILITIES.STOCK_REQUISITIONS_TOTAL_AMOUNT,
  GRANULAR_CAPABILITIES.STOCK_REQUISITIONS_UNIT_COST,
] as const;

export function StockRequisitionFormDialog({
  open,
  onOpenChange,
  stockRequisition,
}: StockRequisitionFormDialogProps) {
  const t = useTranslations("stockRequisitionForm");
  const tValidation = useTranslations("stockRequisitionValidation");
  const locale = useLocale();
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
  const [activeTab, setActiveTab] = useState("general");
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

  useEffect(() => {
    if (!selectedItemId) return;
    const selectedItem = selectedCostItem;
    if (!selectedItem) return;
    setPrice(getDefaultRequisitionUnitCost(selectedItem).toFixed(2));
  }, [selectedCostItem, selectedItemId]);

  // Reset form when dialog opens/closes or SR changes
  useEffect(() => {
    if (open && stockRequisition) {
      setActiveTab("general");
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
      setLineItems([]);
      setSelectedItemId("");
      setSelectedUnitOptionId("");
      setQuantity("");
      setPrice("");
      setAddItemError("");
      setActiveTab("general");
    }
  }, [open, stockRequisition, form, defaultValues, currentCurrency.code, canViewUnitCost]);

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
      setActiveTab("items");
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
      setActiveTab("general");
      window.requestAnimationFrame(() => form.setFocus(firstGeneralError));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col gap-0 p-0">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 pb-5 pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div>
                <DialogTitle className="mb-1 text-2xl font-bold text-gray-900">
                  {isEditMode ? t("editTitle") : t("createTitle")}
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500">
                  {isEditMode ? t("editDescription") : t("createDescription")}
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex-shrink-0 px-6 pt-4">
                <TabsList className="grid h-9 w-full grid-cols-2">
                  <TabsTrigger value="general" className="gap-1.5 text-xs font-semibold">
                    <FileText className="h-3.5 w-3.5" />
                    {t("generalTab")}
                  </TabsTrigger>
                  <TabsTrigger value="items" className="gap-1.5 text-xs font-semibold">
                    <Package className="h-3.5 w-3.5" />
                    {t("itemsTab")}{" "}
                    {lineItems.length > 0 && (
                      <span className="ml-1 rounded-full bg-purple-600 px-1.5 py-0.5 text-[10px] text-white">
                        {lineItems.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent
                value="general"
                className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-6 py-5"
              >
                <div className="mx-auto max-w-5xl space-y-5">
                  {/* Basic Information Card */}
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-transparent">
                          <FileText className="h-4 w-4 text-gray-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          {t("basicInformation")}
                        </h3>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="mb-4 grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="supplierId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold tracking-wide text-gray-700">
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
                                  getOptionLabel={(supplier) =>
                                    `${supplier.name} (${supplier.code})`
                                  }
                                  getOptionSearchValue={(supplier) =>
                                    `${supplier.code} ${supplier.name}`
                                  }
                                  placeholder={t("selectSupplier")}
                                  searchPlaceholder={t("selectSupplier")}
                                  emptyMessage={t("selectSupplier")}
                                  isLoading={isSuppliersLoading}
                                  buttonClassName="h-10 text-sm border-gray-300 focus:border-purple-500 focus:ring-purple-500"
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
                              <FormLabel className="text-xs font-semibold tracking-wide text-gray-700">
                                {t("requisitionDateLabel")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  {...field}
                                  className="h-10 border-gray-300 text-sm focus:border-purple-500 focus:ring-purple-500"
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
                              <FormLabel className="text-xs font-semibold tracking-wide text-gray-700">
                                {t("requiredByDateLabel")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  {...field}
                                  className="h-10 border-gray-300 text-sm focus:border-purple-500 focus:ring-purple-500"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold tracking-wide text-gray-700">
                              {t("notesLabel")}
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                rows={2}
                                placeholder={t("notesPlaceholder")}
                                className="resize-none border-gray-300 text-sm focus:border-purple-500 focus:ring-purple-500"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="items"
                className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-6 py-5"
              >
                <div className="mx-auto max-w-5xl space-y-5">
                  {/* Add Items Card */}
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-purple-100 bg-gradient-to-r from-purple-50 to-violet-50 px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-transparent">
                          <Package className="h-4 w-4 text-gray-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          {t("addItemsTitle")}
                        </h3>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50/30 to-violet-50/30 p-5">
                      <div
                        className={
                          canViewUnitCost
                            ? "grid gap-3 xl:grid-cols-[minmax(0,2.8fr)_minmax(0,1.75fr)_100px_120px_120px_150px_160px]"
                            : "grid gap-3 xl:grid-cols-[minmax(0,2.8fr)_minmax(0,1.75fr)_100px_120px_120px_160px]"
                        }
                      >
                        <div className="min-w-0">
                          <label className="mb-2 block text-xs font-semibold tracking-wide text-gray-700">
                            {t("itemLabel")}
                          </label>
                          <AsyncSearchCombobox
                            value={selectedItemId}
                            onValueChange={(value) => {
                              setSelectedItemId(value);
                              const selectedItem = items.find((item) => item.id === value);
                              setSelectedUnitOptionId("");
                              setPrice(getDefaultRequisitionUnitCost(selectedItem).toFixed(2));
                              setAddItemError("");
                            }}
                            searchValue={itemSearch}
                            onSearchValueChange={setItemSearch}
                            options={itemOptions}
                            selectedOption={selectedItemDetail ?? null}
                            getOptionValue={(item) => item.id}
                            getOptionLabel={(item) => `${item.code} - ${item.name}`}
                            getOptionSearchValue={(item) => `${item.code} ${item.name}`}
                            placeholder={t("searchItemPlaceholder")}
                            searchPlaceholder={t("searchItemByCodeOrName")}
                            emptyMessage={t("noItemFound")}
                            isLoading={isItemsLoading}
                            buttonClassName="w-full min-w-0 justify-between h-10 text-sm bg-white border-gray-300 hover:border-purple-400"
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
                        <div className="min-w-0">
                          <label className="mb-2 block text-xs font-semibold tracking-wide text-gray-700">
                            {t("unitLabel")}
                          </label>
                          <Select
                            value={selectedUnitOptionId}
                            onValueChange={(value) => {
                              setSelectedUnitOptionId(value);
                              setAddItemError("");
                            }}
                            disabled={!selectedItemId || unitOptions.length === 0}
                          >
                            <SelectTrigger className="h-10 border-gray-300 bg-white text-sm focus:border-purple-500 focus:ring-purple-500">
                              <SelectValue
                                placeholder={
                                  selectedItemId ? t("selectUnit") : t("selectItemFirst")
                                }
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
                        <div>
                          <label className="mb-2 block text-xs font-semibold tracking-wide text-gray-700">
                            {t("qtyPerUnitLabel")}
                          </label>
                          <Input
                            value={
                              selectedUnitOption
                                ? selectedUnitOption.qtyPerUnit.toLocaleString(locale, {
                                    maximumFractionDigits: 4,
                                  })
                                : ""
                            }
                            readOnly
                            placeholder="--"
                            className="h-10 border-gray-300 bg-gray-50 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-semibold tracking-wide text-gray-700">
                            {t("quantityLabel")}
                          </label>
                          <Input
                            type="number"
                            placeholder={t("quantityPlaceholder")}
                            value={quantity}
                            onChange={(e) => {
                              setQuantity(e.target.value);
                              setAddItemError("");
                            }}
                            step="0.01"
                            className="h-10 border-gray-300 bg-white text-sm focus:border-purple-500 focus:ring-purple-500"
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="mb-2 block text-xs font-semibold tracking-wide text-gray-700">
                            {t("totalQtyLabel")}
                          </label>
                          <Input
                            value={
                              selectedUnitOption
                                ? derivedTotalQty.toLocaleString(locale, {
                                    maximumFractionDigits: 4,
                                  })
                                : ""
                            }
                            readOnly
                            placeholder="--"
                            className="h-10 border-gray-300 bg-gray-50 text-sm"
                          />
                        </div>
                        {canViewUnitCost && (
                          <div className="min-w-0">
                            <label className="mb-2 block text-xs font-semibold tracking-wide text-gray-700">
                              {t("unitCostLabel")} *
                            </label>
                            <div className="relative">
                              <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm font-semibold text-gray-500">
                                {selectedUnitCostSymbol}
                              </span>
                              <Input
                                key={`unit-price-${selectedItemId}`}
                                type="text"
                                inputMode="decimal"
                                pattern="^-?\\d*(\\.\\d{0,2})?$"
                                placeholder={t("unitPricePlaceholder")}
                                value={price ?? ""}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  if (next === "" || /^-?\\d*(\\.\\d{0,2})?$/.test(next)) {
                                    setPrice(next);
                                    setAddItemError("");
                                  }
                                }}
                                className="h-10 border-gray-300 bg-white pl-8 text-sm focus:border-purple-500 focus:ring-purple-500"
                              />
                            </div>
                          </div>
                        )}
                        <div className="flex items-end">
                          <Button
                            type="button"
                            onClick={handleAddItem}
                            className="h-10 w-full bg-gradient-to-r from-purple-600 to-violet-600 text-sm font-semibold shadow-lg hover:from-purple-700 hover:to-violet-700"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            {t("addItem")}
                          </Button>
                        </div>
                      </div>

                      {/* Inline Error Message */}
                      {addItemError && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                          <svg
                            className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <p className="text-sm font-medium text-red-800">{addItemError}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items List */}
                  {lineItems.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                      <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-transparent">
                              <Package className="h-4 w-4 text-gray-600" />
                            </div>
                            <h3 className="text-sm font-semibold text-gray-900">
                              {t("itemsTitle")}
                            </h3>
                            <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                              {lineItems.length}{" "}
                              {lineItems.length === 1 ? t("itemSingular") : t("itemPlural")}
                            </span>
                          </div>
                          {canShowFormAmounts && (
                            <div className="text-right">
                              <p className="text-xs font-medium text-gray-500">
                                {t("totalAmount")}
                              </p>
                              <p className="bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-xl font-bold text-transparent">
                                {formattedTotalAmount}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-b border-gray-200 bg-gray-50">
                              <TableHead className="h-10 text-xs font-semibold text-gray-700">
                                {t("itemCode")}
                              </TableHead>
                              <TableHead className="h-10 text-xs font-semibold text-gray-700">
                                {t("itemName")}
                              </TableHead>
                              <TableHead className="h-10 text-right text-xs font-semibold text-gray-700">
                                {t("qty")}
                              </TableHead>
                              <TableHead className="h-10 text-xs font-semibold text-gray-700">
                                {t("unitLabel")}
                              </TableHead>
                              <TableHead className="h-10 text-right text-xs font-semibold text-gray-700">
                                {t("totalQtyLabel")}
                              </TableHead>
                              {canViewUnitCost && (
                                <TableHead className="h-10 text-right text-xs font-semibold text-gray-700">
                                  {t("unitCostLabel")}
                                </TableHead>
                              )}
                              {canShowFormAmounts && (
                                <TableHead className="h-10 text-right text-xs font-semibold text-gray-700">
                                  {t("total")}
                                </TableHead>
                              )}
                              <TableHead className="h-10 w-[60px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lineItems.map((item, index) => (
                              <TableRow
                                key={index}
                                className="border-b border-gray-100 transition-colors hover:bg-purple-50/50"
                              >
                                <TableCell className="py-3 text-sm font-semibold text-gray-900">
                                  {item.itemCode}
                                </TableCell>
                                <TableCell className="py-3 text-sm text-gray-700">
                                  {item.itemName}
                                </TableCell>
                                <TableCell className="py-3 text-right text-sm font-medium tabular-nums text-gray-900">
                                  {item.requestedQty}
                                </TableCell>
                                <TableCell className="py-3 text-sm text-gray-700">
                                  {item.uomLabel}
                                </TableCell>
                                <TableCell className="py-3 text-right text-sm font-medium tabular-nums text-gray-900">
                                  {(item.requestedQty * item.qtyPerUnit).toLocaleString(locale, {
                                    maximumFractionDigits: 4,
                                  })}
                                </TableCell>
                                {canViewUnitCost && (
                                  <TableCell className="py-3 text-right text-sm tabular-nums text-gray-700">
                                    {formatLineItemAmount(item.unitPrice, item.unitPriceCurrency)}
                                  </TableCell>
                                )}
                                {canShowFormAmounts && (
                                  <TableCell className="py-3 text-right text-sm font-bold tabular-nums text-purple-600">
                                    {formatLineItemAmount(
                                      item.requestedQty * item.qtyPerUnit * item.unitPrice,
                                      item.unitPriceCurrency
                                    )}
                                  </TableCell>
                                )}
                                <TableCell className="py-3">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveItem(index)}
                                    className="h-8 w-8 rounded-lg p-0 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 shadow-sm">
                      <div className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-violet-100">
                          <ShoppingCart className="h-8 w-8 text-purple-600" />
                        </div>
                        <h3 className="mb-2 text-base font-semibold text-gray-900">
                          {t("noItemsTitle")}
                        </h3>
                        <p className="mx-auto max-w-sm text-sm text-gray-500">
                          {t("noItemsDescription")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Fixed Footer */}
            <div className="flex-shrink-0 border-t border-gray-200 bg-white px-6 py-4">
              <div className="mx-auto flex max-w-5xl items-center justify-between">
                <div className="text-sm text-gray-500">
                  {lineItems.length > 0 && (
                    <span>
                      {canShowFormAmounts
                        ? t("footerSummary", {
                            count: lineItems.length,
                            label: lineItems.length === 1 ? t("itemSingular") : t("itemPlural"),
                            total: formattedTotalAmount,
                          })
                        : `${lineItems.length} ${
                            lineItems.length === 1 ? t("itemSingular") : t("itemPlural")
                          }`}
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="h-10 min-w-[100px] border-gray-300 text-sm hover:bg-gray-50"
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="h-10 min-w-[140px] bg-gradient-to-r from-purple-600 to-violet-600 text-sm font-semibold shadow-lg hover:from-purple-700 hover:to-violet-700"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
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
