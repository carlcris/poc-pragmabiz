"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import {
  createStockAdjustmentLineItemSchema,
  type StockAdjustmentLineItemFormValues,
} from "@/lib/stock-adjustments/line-item-schema";
import { AlertCircle, Check, Lock, Minus, Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { STOCK_ADJUSTMENT_BATCH_LOCATIONS_QUERY_KEY } from "@/hooks/queryKeys";
import { useItem, useItems } from "@/hooks/useItems";
import { useCurrency } from "@/hooks/useCurrency";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { StockAdjustmentBatchLocation } from "@/types/stock-adjustment";

type StockAdjustmentLineItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: StockAdjustmentLineItemFormValues) => boolean;
  item?: StockAdjustmentLineItemFormValues | null;
  mode?: "add" | "edit";
  warehouseId?: string;
  locationId?: string;
};

export function StockAdjustmentLineItemDialog({
  open,
  onOpenChange,
  onSave,
  item,
  mode = "add",
  warehouseId,
  locationId,
}: StockAdjustmentLineItemDialogProps) {
  const t = useTranslations("stockAdjustmentLineItemDialog");
  const tValidation = useTranslations("stockAdjustmentLineItemValidation");
  const tUnits = useTranslations("itemLocationsTab");
  const [unitOptionId, setUnitOptionId] = useState("base");
  const [quantityInput, setQuantityInput] = useState("");
  const locale = useLocale();
  const formatter = useFormatter();
  const [itemSearch, setItemSearch] = useState("");
  const [batchSearch, setBatchSearch] = useState("");
  const debouncedItemSearch = useDebouncedValue(itemSearch.trim());
  const debouncedBatchSearch = useDebouncedValue(batchSearch.trim());
  const { data: itemsData, isLoading: isItemsLoading } = useItems({
    search: debouncedItemSearch || undefined,
    limit: 5,
  });
  const items = useMemo(() => itemsData?.data || [], [itemsData?.data]);
  const { formatCurrency, symbol: currencySymbol } = useCurrency();
  const [uomLabel, setUomLabel] = useState<string>("");
  const lineItemSchema = createStockAdjustmentLineItemSchema(
    (key) => tValidation(key),
    tUnits("moveQuantityInvalid")
  );

  const form = useForm<StockAdjustmentLineItemFormValues>({
    resolver: zodResolver(lineItemSchema),
    defaultValues: {
      itemId: "",
      batchEntryMode: "existing",
      itemBatchId: "",
      itemBatchLocationId: "",
      batchLocationSku: "",
      batchCode: "",
      batchReceivedAt: "",
      batchWarehouseLocationId: "",
      batchLocationCode: "",
      batchLocationName: "",
      itemCode: "",
      itemName: "",
      uomId: "",
      uomName: "",
      currentQty: 0,
      adjustedQty: 0,
      unitCost: 0,
      adjustmentAmount: 0,
      adjustmentType: "add",
    },
  });

  // Reset form when dialog opens/closes or item changes
  useEffect(() => {
    setUnitOptionId(item?.enteredUnitOptionId ? "saved" : "base");
    setQuantityInput(item?.enteredQty?.toString() || "");
    if (open && item) {
      const adjustmentDifference = item.adjustedQty - item.currentQty;
      form.reset({
        ...item,
        batchEntryMode: item.itemBatchLocationId || item.itemBatchId ? "existing" : "new",
        adjustmentAmount: Math.abs(adjustmentDifference),
        adjustmentType: adjustmentDifference < 0 ? "remove" : "add",
      });
    } else if (open) {
      form.reset({
        itemId: "",
        batchEntryMode: "existing",
        itemBatchId: "",
        itemBatchLocationId: "",
        batchLocationSku: "",
        batchCode: "",
        batchReceivedAt: "",
        batchWarehouseLocationId: "",
        batchLocationCode: "",
        batchLocationName: "",
        itemCode: "",
        itemName: "",
        uomId: "",
        uomName: "",
        currentQty: 0,
        adjustedQty: 0,
        unitCost: 0,
        adjustmentAmount: 0,
        adjustmentType: "add",
      });
    }
  }, [open, item, form]);

  const watchedItemId = form.watch("itemId");
  const batchEntryMode = form.watch("batchEntryMode");
  const watchedBatchSelectionId = form.watch("itemBatchLocationId") || form.watch("itemBatchId");
  const manualBatchCode = form.watch("batchCode") || "";
  const debouncedManualBatchCode = useDebouncedValue(manualBatchCode.trim());
  const batchQuerySearch =
    batchEntryMode === "new" ? debouncedManualBatchCode : debouncedBatchSearch;
  const { data: selectedItemResponse } = useItem(watchedItemId);
  const selectedItem =
    selectedItemResponse?.data ?? items.find((candidate) => candidate.id === watchedItemId) ?? null;

  const unitOptions = (selectedItemResponse?.data.unitOptions ?? []).filter(
    (option) =>
      option.isActive &&
      !option.isBase &&
      Number.isFinite(option.qtyPerUnit) &&
      option.qtyPerUnit > 0
  );
  const savedUnit =
    item?.itemId === watchedItemId && item.enteredUnitOptionId
      ? {
          id: "saved",
          qtyPerUnit: item.enteredQtyPerUnit!,
          displayLabel: item.enteredUnitLabel!,
        }
      : null;
  const displayUnitOptions = savedUnit
    ? [
        savedUnit,
        ...unitOptions.filter(
          (option) =>
            option.id !== item?.enteredUnitOptionId ||
            option.qtyPerUnit !== savedUnit.qtyPerUnit ||
            option.displayLabel !== savedUnit.displayLabel
        ),
      ]
    : unitOptions;
  const selectedUnit = displayUnitOptions.find((option) => option.id === unitOptionId);
  const quantityFactor = unitOptionId === "base" ? 1 : selectedUnit?.qtyPerUnit;

  useEffect(() => {
    if (!watchedItemId) {
      setUomLabel("");
      return;
    }

    setUomLabel(selectedItem?.uom || item?.uomName || "");
  }, [watchedItemId, selectedItem?.uom, item?.uomName]);

  const {
    data: batchLocationsResponse,
    isError: isBatchLocationsError,
    isLoading: isBatchLocationsLoading,
  } = useQuery<{
    data: StockAdjustmentBatchLocation[];
    duplicate?: boolean;
  }>({
    queryKey: [
      STOCK_ADJUSTMENT_BATCH_LOCATIONS_QUERY_KEY,
      watchedItemId,
      warehouseId,
      locationId,
      batchQuerySearch,
      batchEntryMode,
    ],
    queryFn: async () => {
      if (batchEntryMode === "new") {
        const response = await apiClient.get<{ exists: boolean }>("/api/inventory/batches", {
          params: {
            itemId: watchedItemId,
            warehouseId,
            locationId,
            exactBatchCode: batchQuerySearch,
          },
        });
        return { data: [], duplicate: response.exists };
      }
      return apiClient.get<{ data: StockAdjustmentBatchLocation[] }>(
        locationId ? "/api/inventory/batches" : "/api/inventory/batch-locations",
        {
          params: {
            itemId: watchedItemId,
            warehouseId,
            locationId: locationId || undefined,
            search: batchQuerySearch || undefined,
            limit: 5,
          },
        }
      );
    },
    enabled: Boolean(
      watchedItemId &&
      warehouseId &&
      (batchEntryMode === "existing" || (locationId && debouncedManualBatchCode))
    ),
  });

  const batchLocations = useMemo(
    () => batchLocationsResponse?.data || [],
    [batchLocationsResponse?.data]
  );

  const selectedBatchLocation =
    batchLocations.find((candidate) => candidate.id === watchedBatchSelectionId) ||
    (watchedBatchSelectionId
      ? {
          id: watchedBatchSelectionId,
          itemId: watchedItemId,
          warehouseId: warehouseId || "",
          locationId: form.getValues("batchWarehouseLocationId") || "",
          itemBatchId: form.getValues("itemBatchId") || "",
          batchLocationSku: form.getValues("batchLocationSku") || "",
          batchCode: form.getValues("batchCode") || "",
          receivedAt: form.getValues("batchReceivedAt") || "",
          qtyOnHand: form.getValues("currentQty"),
          qtyAvailable: form.getValues("currentQty"),
          qtyReserved: 0,
          locationCode: form.getValues("batchLocationCode") || null,
          locationName: form.getValues("batchLocationName") || null,
        }
      : null);

  const duplicateBatchCode =
    batchEntryMode === "new" &&
    Boolean(debouncedManualBatchCode) &&
    manualBatchCode.trim() === debouncedManualBatchCode &&
    batchLocationsResponse?.duplicate === true;

  const isNewBatchValidationPending =
    batchEntryMode === "new" &&
    Boolean(manualBatchCode.trim()) &&
    (manualBatchCode.trim() !== debouncedManualBatchCode || isBatchLocationsLoading);
  const isNewBatchValidationFailed =
    batchEntryMode === "new" &&
    Boolean(debouncedManualBatchCode) &&
    manualBatchCode.trim() === debouncedManualBatchCode &&
    isBatchLocationsError;

  const handleItemSelect = (itemId: string) => {
    const selectedItem = items.find((i) => i.id === itemId);
    if (selectedItem) {
      setUnitOptionId("base");
      setItemSearch("");
      setBatchSearch("");
      form.setValue("itemId", selectedItem.id);
      form.setValue("batchEntryMode", "existing");
      form.setValue("itemBatchLocationId", "");
      form.setValue("itemBatchId", "");
      form.setValue("batchLocationSku", "");
      form.setValue("batchCode", "");
      form.setValue("batchReceivedAt", "");
      form.setValue("batchWarehouseLocationId", "");
      form.setValue("batchLocationCode", "");
      form.setValue("batchLocationName", "");
      form.setValue("itemCode", selectedItem.code);
      form.setValue("itemName", selectedItem.name);
      form.setValue("uomId", selectedItem.uomId);
      form.setValue("uomName", selectedItem.uom);
      setQuantityInput("");
      setUomLabel(selectedItem.uom || "");
      form.setValue("unitCost", selectedItem.purchasePrice);
      form.setValue("currentQty", 0);
      form.setValue("adjustedQty", 0);
      form.setValue("adjustmentAmount", 0);
    }
  };

  const handleBatchSelect = (batchLocationId: string) => {
    const batchLocation = batchLocations.find((candidate) => candidate.id === batchLocationId);
    if (!batchLocation) return;

    setBatchSearch("");
    form.setValue("batchEntryMode", "existing");
    form.setValue(
      "itemBatchLocationId",
      locationId ? batchLocation.itemBatchLocationId || "" : batchLocation.id
    );
    form.setValue("itemBatchId", locationId ? batchLocation.itemBatchId : "");
    form.setValue("batchLocationSku", batchLocation.batchLocationSku);
    form.setValue("batchCode", batchLocation.batchCode);
    form.setValue("batchReceivedAt", batchLocation.receivedAt);
    form.setValue("batchWarehouseLocationId", batchLocation.locationId);
    form.setValue("batchLocationCode", batchLocation.locationCode || "");
    form.setValue("batchLocationName", batchLocation.locationName || "");
    form.setValue("currentQty", batchLocation.qtyOnHand);
    form.setValue("adjustedQty", batchLocation.qtyOnHand);
    form.setValue("adjustmentAmount", 0);
  };

  const handleBatchEntryModeChange = (value: string) => {
    // Re-selecting the active source must not clear the batch fields.
    if ((value !== "existing" && value !== "new") || value === batchEntryMode) {
      return;
    }

    setBatchSearch("");
    form.setValue("batchEntryMode", value);
    form.setValue("itemBatchLocationId", "");
    form.setValue("itemBatchId", "");
    form.setValue("batchLocationSku", "");
    form.setValue("batchCode", "");
    form.setValue("batchReceivedAt", value === "new" ? format(new Date(), "yyyy-MM-dd") : "");
    form.setValue("batchWarehouseLocationId", value === "new" ? locationId || "" : "");
    form.setValue("batchLocationCode", "");
    form.setValue("batchLocationName", "");
    form.setValue("currentQty", 0);
    form.setValue("adjustedQty", 0);
    form.setValue("adjustmentAmount", 0);

    if (value === "new") {
      form.setValue("adjustmentType", "add");
    }

    form.clearErrors(["itemBatchLocationId", "batchCode", "adjustmentType", "adjustmentAmount"]);
  };

  useEffect(() => {
    if (batchEntryMode !== "new" || !manualBatchCode.trim()) {
      form.clearErrors("batchCode");
      return;
    }

    if (duplicateBatchCode) {
      form.setError("batchCode", {
        type: "validate",
        message: tValidation("batchAlreadyExistsInWarehouse"),
      });
      return;
    }

    if (isNewBatchValidationFailed) {
      form.setError("batchCode", {
        type: "validate",
        message: tValidation("batchAvailabilityCheckFailed"),
      });
      return;
    }

    if (!isNewBatchValidationPending) {
      form.clearErrors("batchCode");
    }
  }, [
    batchEntryMode,
    duplicateBatchCode,
    form,
    isNewBatchValidationFailed,
    isNewBatchValidationPending,
    manualBatchCode,
    tValidation,
  ]);

  const onSubmit = (data: StockAdjustmentLineItemFormValues) => {
    if (!quantityFactor) return;
    if (data.batchEntryMode === "new" && isNewBatchValidationFailed) {
      form.setError("batchCode", {
        type: "validate",
        message: tValidation("batchAvailabilityCheckFailed"),
      });
      return;
    }

    if (data.batchEntryMode === "new" && duplicateBatchCode) {
      form.setError("batchCode", {
        type: "validate",
        message: tValidation("batchAlreadyExistsInWarehouse"),
      });
      return;
    }

    // Calculate final stock in base units
    const adjustmentInBaseUnits = data.adjustmentAmount || 0;

    // Apply sign based on adjustment type
    const signedAdjustment =
      data.adjustmentType === "remove" ? -adjustmentInBaseUnits : adjustmentInBaseUnits;

    // Calculate final stock in base units
    const finalStockInBaseUnits = data.currentQty + signedAdjustment;

    const submitData = {
      ...data,
      batchCode: data.batchEntryMode === "new" ? data.batchCode?.trim() : data.batchCode,
      enteredQty: Number((adjustmentInBaseUnits / (quantityFactor ?? 1)).toPrecision(15)),
      enteredUnitOptionId:
        unitOptionId === "base"
          ? null
          : unitOptionId === "saved"
            ? item!.enteredUnitOptionId!
            : unitOptionId,
      enteredUnitLabel: selectedUnit?.displayLabel || baseUnitLabel,
      enteredQtyPerUnit: quantityFactor ?? 1,
      adjustedQty: finalStockInBaseUnits, // Send final stock in BASE UNITS
    };

    if (onSave(submitData)) {
      onOpenChange(false);
    }
  };

  const currentQty = form.watch("currentQty") || 0;
  const adjustmentAmount = form.watch("adjustmentAmount") || 0; // This is always positive
  // Show the typed text while it still matches the form value so typing is never reformatted
  // (no leading "0", "0." survives); resets and unit changes fall back to the form value.
  const enteredQuantity = Number((adjustmentAmount / (quantityFactor ?? 1)).toPrecision(15));
  const quantityInputValue =
    Math.abs((parseFloat(quantityInput) || 0) - enteredQuantity) < 1e-9
      ? quantityInput
      : enteredQuantity === 0
        ? ""
        : String(enteredQuantity);
  const adjustmentType = form.watch("adjustmentType") || "add";
  const unitCost = form.watch("unitCost") || 0;
  const isItemSelected = Boolean(form.watch("itemId"));
  const isBatchSelected =
    batchEntryMode === "existing"
      ? Boolean(watchedBatchSelectionId)
      : Boolean(locationId && manualBatchCode.trim() && !duplicateBatchCode);

  // Calculate adjustment in base units (with sign based on type)
  const adjustmentInBaseUnits = adjustmentType === "remove" ? -adjustmentAmount : adjustmentAmount;

  // Calculate new stock level
  const newStockQty = currentQty + adjustmentInBaseUnits;
  const exceedsOnHand = newStockQty < 0;

  // Calculate value (in base units)
  const totalValue = adjustmentInBaseUnits * unitCost;
  const displayTotalValue = Math.abs(totalValue) < 0.005 ? 0 : totalValue;

  const baseUnitLabel = uomLabel || t("units");
  const formatQty = (value: number) =>
    value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const toneClass = (value: number) =>
    value > 0 ? "text-green-700" : value < 0 ? "text-red-700" : "text-foreground";
  const stockBarMax = Math.max(currentQty, newStockQty, 0);
  const stockBars = [
    { key: "before", label: t("before"), value: currentQty, barClass: "bg-muted-foreground/40" },
    {
      key: "after",
      label: t("after"),
      value: newStockQty,
      barClass: adjustmentInBaseUnits < 0 ? "bg-red-600" : "bg-green-600",
    },
  ];
  const adjustmentDirections = [
    {
      value: "add",
      label: t("increaseStock"),
      hint: t("increaseStockHint"),
      Icon: Plus,
      iconClass: "bg-green-100 text-green-700",
      selectedClass: "border-green-600 bg-green-50 ring-1 ring-green-600",
    },
    {
      value: "remove",
      label: t("decreaseStock"),
      hint: t("decreaseStockHint"),
      Icon: Minus,
      iconClass: "bg-red-100 text-red-700",
      selectedClass: "border-red-600 bg-red-50 ring-1 ring-red-600",
    },
  ] as const;

  const batchSourceToggle = (
    <SegmentedControl
      aria-label={t("batchEntryModeLabel")}
      className="shrink-0 whitespace-nowrap"
      value={batchEntryMode}
      onChange={handleBatchEntryModeChange}
      options={[
        { value: "existing", label: t("existingBatchMode"), disabled: !isItemSelected },
        {
          value: "new",
          label: t("newBatchMode"),
          disabled: !isItemSelected || !locationId,
        },
      ]}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Fixed height from md up so switching batch source (and preview states) never resizes
          and re-centres the dialog; the viewport clamp has no preset in the Tailwind scale. */}
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 md:h-[min(90vh,52rem)]">
        <DialogHeader className="px-6 pb-5 pr-12 pt-6">
          <DialogTitle className="text-xl">
            {mode === "edit" ? t("editTitle") : t("createTitle")}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit" ? t("editDescription") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t md:flex-row md:overflow-hidden">
              <div className="min-w-0 flex-1 space-y-5 p-6 md:overflow-y-auto">
                <FormField
                  control={form.control}
                  name="itemId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("itemLabel")} <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <AsyncSearchCombobox
                          value={field.value || ""}
                          onValueChange={(value) => {
                            field.onChange(value);
                            void handleItemSelect(value);
                          }}
                          searchValue={itemSearch}
                          onSearchValueChange={setItemSearch}
                          options={items.filter((entry) => entry.isActive)}
                          selectedOption={selectedItem}
                          getOptionValue={(entry) => entry.id}
                          getOptionLabel={(entry) => `${entry.code} - ${entry.name}`}
                          getOptionSearchValue={(entry) => `${entry.code} ${entry.name}`}
                          renderSelectedOption={(entry) => (
                            <span className="flex flex-col gap-0.5">
                              <span className="truncate font-medium">{entry.name}</span>
                              <span className="text-xs font-normal tabular-nums text-muted-foreground">
                                {entry.code}
                              </span>
                            </span>
                          )}
                          placeholder={t("chooseItem")}
                          searchPlaceholder={t("searchByCodeOrName")}
                          emptyMessage={t("chooseItem")}
                          isLoading={isItemsLoading}
                          buttonClassName="h-auto min-h-14 py-2"
                          renderOption={(entry, selected) => (
                            <div className="flex w-full items-start gap-2">
                              <Check
                                className={cn(
                                  "mt-0.5 h-4 w-4 shrink-0",
                                  selected ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium">{entry.name}</div>
                                <div className="text-xs tabular-nums text-muted-foreground">
                                  {entry.code}
                                </div>
                              </div>
                            </div>
                          )}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {batchEntryMode === "existing" ? (
                  <FormField
                    control={form.control}
                    name="itemBatchLocationId"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between gap-3">
                          <FormLabel>
                            {t("batchLabel")} <span className="text-destructive">*</span>
                          </FormLabel>
                          {batchSourceToggle}
                        </div>
                        <FormControl>
                          <AsyncSearchCombobox
                            value={watchedBatchSelectionId || ""}
                            onValueChange={(value) => {
                              field.onChange(value);
                              handleBatchSelect(value);
                            }}
                            searchValue={batchSearch}
                            onSearchValueChange={setBatchSearch}
                            options={batchLocations}
                            selectedOption={selectedBatchLocation}
                            getOptionValue={(entry) => entry.id}
                            getOptionLabel={(entry) => entry.batchCode || entry.batchLocationSku}
                            getOptionSearchValue={(entry) =>
                              `${entry.batchCode} ${entry.batchLocationSku} ${entry.locationCode || ""}`
                            }
                            renderSelectedOption={(entry) => (
                              <span className="flex items-center gap-3">
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                  <span className="truncate font-semibold">
                                    {entry.batchCode || entry.batchLocationSku}
                                  </span>
                                  <span className="truncate text-xs font-normal text-muted-foreground">
                                    {entry.locationCode ||
                                      entry.locationName ||
                                      t("unassignedLocation")}
                                    {entry.receivedAt
                                      ? ` · ${t("receivedOn", {
                                          date: formatter.dateTime(new Date(entry.receivedAt), {
                                            dateStyle: "medium",
                                          }),
                                        })}`
                                      : null}
                                  </span>
                                </span>
                                <span className="flex shrink-0 flex-col items-end gap-0.5">
                                  <span className="font-semibold tabular-nums">
                                    {formatQty(entry.qtyOnHand)}
                                  </span>
                                  <span className="text-xs font-normal text-muted-foreground">
                                    {t("onHandUnit", { unit: baseUnitLabel })}
                                  </span>
                                </span>
                              </span>
                            )}
                            placeholder={
                              isItemSelected ? t("chooseBatch") : t("chooseItemBeforeBatch")
                            }
                            searchPlaceholder={t("searchByBatchOrQr")}
                            emptyMessage={t("noBatches")}
                            loadingMessage={t("loadingBatches")}
                            isLoading={isBatchLocationsLoading}
                            disabled={!isItemSelected}
                            buttonClassName="h-auto min-h-14 py-2"
                            renderOption={(entry, selected) => (
                              <div className="flex w-full items-start gap-2">
                                <Check
                                  className={`mt-0.5 h-4 w-4 ${
                                    selected ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="font-medium">{entry.batchCode}</span>
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {t("batchOptionMeta", {
                                      qty: formatQty(entry.qtyOnHand),
                                      location:
                                        entry.locationCode ||
                                        entry.locationName ||
                                        t("unassignedLocation"),
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}
                          />
                        </FormControl>
                        {isItemSelected && !locationId ? (
                          <p className="text-xs text-muted-foreground">
                            {t("newBatchLocationRequired")}
                          </p>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium leading-none">
                        {t("batchLabel")} <span className="text-destructive">*</span>
                      </span>
                      {batchSourceToggle}
                    </div>
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="batchCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("manualBatchCodeLabel")}</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  onChange={(event) => {
                                    field.onChange(event.target.value);
                                    form.clearErrors("batchCode");
                                    form.setValue("itemBatchLocationId", "");
                                    form.setValue("itemBatchId", "");
                                    form.setValue("batchLocationSku", "");
                                    form.setValue("batchWarehouseLocationId", locationId || "");
                                    form.setValue("batchLocationCode", "");
                                    form.setValue("batchLocationName", "");
                                    form.setValue("currentQty", 0);
                                    form.setValue("adjustedQty", 0);
                                  }}
                                  placeholder={t("manualBatchCodePlaceholder")}
                                  className="bg-background"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="batchReceivedAt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("receivedDateLabel")}</FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  {...field}
                                  value={field.value || ""}
                                  className="bg-background"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{t("manualBatchCodeHint")}</p>
                      <p className="text-xs text-muted-foreground">{t("receivedDateHint")}</p>
                    </div>
                  </div>
                )}

                <div className="border-t" />

                <FormField
                  control={form.control}
                  name="adjustmentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("adjustment")} <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <div
                          role="group"
                          aria-label={t("adjustment")}
                          className="grid gap-3 sm:grid-cols-2"
                        >
                          {adjustmentDirections.map((direction) => {
                            const isLockedForNewBatch =
                              direction.value === "remove" && batchEntryMode === "new";
                            const isSelected = field.value === direction.value;
                            const Icon = isLockedForNewBatch ? Lock : direction.Icon;

                            return (
                              <button
                                key={direction.value}
                                type="button"
                                aria-pressed={isSelected}
                                disabled={!isBatchSelected || isLockedForNewBatch}
                                onClick={() => field.onChange(direction.value)}
                                className={cn(
                                  "flex min-h-14 items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-background",
                                  isSelected && isBatchSelected && direction.selectedClass,
                                  isLockedForNewBatch && "border-dashed"
                                )}
                              >
                                <span
                                  className={cn(
                                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                                    isLockedForNewBatch
                                      ? "bg-muted text-muted-foreground"
                                      : direction.iconClass
                                  )}
                                >
                                  <Icon className="h-4 w-4" />
                                </span>
                                <span className="flex flex-col gap-0.5">
                                  <span className="text-sm font-semibold">{direction.label}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {isLockedForNewBatch
                                      ? t("newBatchIncreaseOnlyHint")
                                      : direction.hint}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="adjustmentAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("quantityLabel")} <span className="text-destructive">*</span>
                        </FormLabel>
                        <div className="flex">
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...field}
                              value={quantityInputValue}
                              onChange={(e) => {
                                setQuantityInput(e.target.value);
                                field.onChange(
                                  Number(
                                    (
                                      (parseFloat(e.target.value) || 0) * (quantityFactor ?? NaN)
                                    ).toPrecision(15)
                                  )
                                );
                              }}
                              placeholder={t("quantityPlaceholder")}
                              className={cn(
                                "h-11 rounded-r-none text-right text-base font-semibold tabular-nums",
                                exceedsOnHand && "border-destructive focus-visible:ring-destructive"
                              )}
                              disabled={!isBatchSelected}
                            />
                          </FormControl>
                          <Select
                            value={unitOptionId}
                            disabled={!isBatchSelected}
                            onValueChange={(value) => {
                              const factor =
                                value === "base"
                                  ? 1
                                  : displayUnitOptions.find((option) => option.id === value)
                                      ?.qtyPerUnit;
                              if (!factor || !quantityFactor) return;
                              const enteredQuantity =
                                (form.getValues("adjustmentAmount") || 0) / quantityFactor;
                              setUnitOptionId(value);
                              form.setValue(
                                "adjustmentAmount",
                                Number((enteredQuantity * factor).toPrecision(15)),
                                { shouldValidate: true }
                              );
                            }}
                          >
                            <SelectTrigger
                              aria-label={tUnits("moveUnitLabel")}
                              className={cn(
                                "h-11 w-auto shrink-0 gap-2 rounded-l-none border-l-0 bg-muted/40 font-semibold",
                                exceedsOnHand && "border-destructive"
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="base">{baseUnitLabel}</SelectItem>
                              {displayUnitOptions.map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.displayLabel}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-xs text-muted-foreground" aria-live="polite">
                          {tUnits("moveTotalQuantity", {
                            quantity: formatQty(adjustmentAmount),
                            unit: baseUnitLabel,
                          })}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unitCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("unitCostLabel")} ({baseUnitLabel}){" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                              {currencySymbol}
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              placeholder={t("quantityPlaceholder")}
                              className="h-11 pl-8 pr-4 text-right text-base font-semibold tabular-nums"
                              disabled={!isItemSelected}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <aside
                aria-label={t("stockPreview")}
                className="space-y-5 border-t bg-muted/40 p-6 md:w-80 md:shrink-0 md:overflow-y-auto md:border-l md:border-t-0"
              >
                {isBatchSelected ? (
                  <>
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-muted-foreground">
                        {t("newStockLevel")}
                      </p>
                      <p className="flex items-baseline gap-2" aria-live="polite">
                        <span
                          className={cn(
                            "text-4xl font-bold tabular-nums tracking-tight",
                            exceedsOnHand && "text-red-700"
                          )}
                        >
                          {formatQty(newStockQty)}
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">
                          {baseUnitLabel}
                        </span>
                      </p>
                    </div>

                    <div className="space-y-2.5" aria-hidden="true">
                      {stockBars.map((bar) => (
                        <div key={bar.key} className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{bar.label}</span>
                            <span className="tabular-nums">{formatQty(bar.value)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-border">
                            {/* Inline width: the bar length is a live ratio, not a scale value. */}
                            <div
                              className={cn("h-full rounded-full transition-all", bar.barClass)}
                              style={{
                                width: `${
                                  stockBarMax > 0 ? (Math.max(bar.value, 0) / stockBarMax) * 100 : 0
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <dl className="space-y-2.5 border-t pt-4 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">{t("currentStock")}</dt>
                        <dd className="tabular-nums">{formatQty(currentQty)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">{t("change")}</dt>
                        <dd
                          className={cn(
                            "font-semibold tabular-nums",
                            toneClass(adjustmentInBaseUnits)
                          )}
                        >
                          {adjustmentInBaseUnits > 0 ? "+" : ""}
                          {formatQty(adjustmentInBaseUnits)} {baseUnitLabel}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 font-semibold">
                        <dt>{t("newStock")}</dt>
                        <dd className="tabular-nums">{formatQty(newStockQty)}</dd>
                      </div>
                    </dl>

                    <div className="space-y-1 border-t pt-4">
                      <p className="text-sm font-semibold text-muted-foreground">
                        {t("valueImpact")}
                      </p>
                      <p
                        className={cn(
                          "text-xl font-bold tabular-nums",
                          toneClass(displayTotalValue)
                        )}
                      >
                        {displayTotalValue < 0
                          ? `(${formatCurrency(Math.abs(displayTotalValue))})`
                          : formatCurrency(displayTotalValue)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("valueImpactFormula", {
                          quantity: formatQty(Math.abs(adjustmentInBaseUnits)),
                          uom: baseUnitLabel,
                          unitCost: formatCurrency(unitCost),
                        })}
                      </p>
                    </div>

                    {exceedsOnHand ? (
                      <div
                        role="alert"
                        className="flex gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                      >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          {t("exceedsOnHand", {
                            available: formatQty(currentQty),
                            excess: formatQty(-newStockQty),
                            unit: baseUnitLabel,
                          })}
                        </span>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-primary">
                      <Package className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-semibold">{t("stockPreview")}</p>
                    <p className="max-w-56 text-sm text-muted-foreground">{t("previewEmpty")}</p>
                  </div>
                )}
              </aside>
            </div>

            <DialogFooter className="items-center gap-3 border-t px-6 py-4 sm:justify-between sm:space-x-0">
              <p className="hidden text-xs text-muted-foreground sm:block">{t("draftSaveHint")}</p>
              <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !quantityFactor ||
                    exceedsOnHand ||
                    isNewBatchValidationPending ||
                    isNewBatchValidationFailed ||
                    Boolean(duplicateBatchCode)
                  }
                >
                  {mode === "edit" ? t("updateAction") : t("createAction")}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
