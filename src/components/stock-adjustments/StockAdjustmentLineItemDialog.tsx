"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { z } from "zod";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { STOCK_ADJUSTMENT_BATCH_LOCATIONS_QUERY_KEY } from "@/hooks/queryKeys";
import { useItem, useItems } from "@/hooks/useItems";
import { useCurrency } from "@/hooks/useCurrency";
import { apiClient } from "@/lib/api";
import type { StockAdjustmentBatchLocation } from "@/types/stock-adjustment";

const createLineItemSchema = (
  tValidation: (
    key:
      | "itemRequired"
      | "batchRequired"
      | "uomRequired"
      | "currentQtyMin"
      | "adjustedQtyMin"
      | "unitCostMin"
      | "newBatchIncreaseOnly"
      | "newBatchPositiveQuantity"
      | "batchAlreadyExistsAtLocation"
      | "batchAvailabilityCheckFailed"
  ) => string
) =>
  z
    .object({
      itemId: z.string().min(1, tValidation("itemRequired")),
      batchEntryMode: z.enum(["existing", "new"]),
      itemBatchLocationId: z.string().optional(),
      batchLocationSku: z.string().optional(),
      batchCode: z.string().optional(),
      batchReceivedAt: z.string().optional(),
      batchWarehouseLocationId: z.string().optional(),
      batchLocationCode: z.string().optional(),
      batchLocationName: z.string().optional(),
      itemCode: z.string().optional(),
      itemName: z.string().optional(),
      uomId: z.string().min(1, tValidation("uomRequired")),
      uomName: z.string().optional(),
      currentQty: z.number().min(0, tValidation("currentQtyMin")),
      adjustedQty: z.number().min(0, tValidation("adjustedQtyMin")),
      unitCost: z.number().min(0, tValidation("unitCostMin")),
      adjustmentAmount: z.number().optional(), // User input: the delta (always positive)
      adjustmentType: z.enum(["add", "remove"]).optional(), // Whether to add or remove
    })
    .superRefine((value, ctx) => {
      if (value.batchEntryMode === "existing" && !value.itemBatchLocationId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tValidation("batchRequired"),
          path: ["itemBatchLocationId"],
        });
      }

      if (value.batchEntryMode === "new" && !value.batchCode?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tValidation("batchRequired"),
          path: ["batchCode"],
        });
      }

      if (value.batchEntryMode === "new" && value.adjustmentType !== "add") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tValidation("newBatchIncreaseOnly"),
          path: ["adjustmentType"],
        });
      }

      if (
        value.batchEntryMode === "new" &&
        (!value.adjustmentAmount || value.adjustmentAmount <= 0)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tValidation("newBatchPositiveQuantity"),
          path: ["adjustmentAmount"],
        });
      }

      const signedAdjustment =
        value.adjustmentType === "remove"
          ? -(value.adjustmentAmount || 0)
          : value.adjustmentAmount || 0;

      if (value.currentQty + signedAdjustment < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tValidation("adjustedQtyMin"),
          path: ["adjustmentAmount"],
        });
      }
    });

type LineItemSchema = ReturnType<typeof createLineItemSchema>;
export type StockAdjustmentLineItemFormValues = z.infer<LineItemSchema>;

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
  const locale = useLocale();
  const [itemSearch, setItemSearch] = useState("");
  const [batchSearch, setBatchSearch] = useState("");
  const debouncedItemSearch = useDebouncedValue(itemSearch.trim());
  const debouncedBatchSearch = useDebouncedValue(batchSearch.trim());
  const { data: itemsData, isLoading: isItemsLoading } = useItems({
    search: debouncedItemSearch || undefined,
    limit: 5,
  });
  const items = useMemo(() => itemsData?.data || [], [itemsData?.data]);
  const { formatCurrency } = useCurrency();
  const [uomLabel, setUomLabel] = useState<string>("");
  const lineItemSchema = createLineItemSchema((key) => tValidation(key));

  const form = useForm<StockAdjustmentLineItemFormValues>({
    resolver: zodResolver(lineItemSchema),
    defaultValues: {
      itemId: "",
      batchEntryMode: "existing",
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
    if (open && item) {
      const adjustmentDifference = item.adjustedQty - item.currentQty;
      form.reset({
        ...item,
        batchEntryMode: item.itemBatchLocationId ? "existing" : "new",
        adjustmentAmount: Math.abs(adjustmentDifference),
        adjustmentType: adjustmentDifference < 0 ? "remove" : "add",
      });
    } else if (open) {
      form.reset({
        itemId: "",
        batchEntryMode: "existing",
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
  const watchedBatchLocationId = form.watch("itemBatchLocationId");
  const manualBatchCode = form.watch("batchCode") || "";
  const debouncedManualBatchCode = useDebouncedValue(manualBatchCode.trim());
  const batchQuerySearch =
    batchEntryMode === "new" ? debouncedManualBatchCode : debouncedBatchSearch;
  const { data: selectedItemResponse } = useItem(watchedItemId);
  const selectedItem =
    items.find((candidate) => candidate.id === watchedItemId) ?? selectedItemResponse?.data ?? null;

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
  }>({
    queryKey: [
      STOCK_ADJUSTMENT_BATCH_LOCATIONS_QUERY_KEY,
      watchedItemId,
      warehouseId,
      locationId,
      batchQuerySearch,
    ],
    queryFn: () =>
      apiClient.get("/api/inventory/batch-locations", {
        params: {
          itemId: watchedItemId,
          warehouseId,
          locationId: locationId || undefined,
          search: batchEntryMode === "existing" ? batchQuerySearch || undefined : undefined,
          exactBatchCode: batchEntryMode === "new" ? batchQuerySearch || undefined : undefined,
          limit: 5,
        },
      }),
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
    batchLocations.find((candidate) => candidate.id === watchedBatchLocationId) ||
    (item && item.itemBatchLocationId && item.itemBatchLocationId === watchedBatchLocationId
      ? {
          id: item.itemBatchLocationId,
          itemId: item.itemId,
          warehouseId: warehouseId || "",
          locationId: "",
          itemBatchId: "",
          batchLocationSku: item.batchLocationSku || "",
          batchCode: item.batchCode || "",
          receivedAt: item.batchReceivedAt || "",
          batchWarehouseLocationId: item.batchWarehouseLocationId || "",
          qtyOnHand: item.currentQty,
          qtyAvailable: item.currentQty,
          qtyReserved: 0,
          locationCode: item.batchLocationCode || null,
          locationName: item.batchLocationName || null,
        }
      : null);

  const duplicateBatchLocation =
    batchEntryMode === "new" &&
    debouncedManualBatchCode &&
    manualBatchCode.trim() === debouncedManualBatchCode
      ? batchLocations.find(
          (candidate) => candidate.batchCode.trim() === debouncedManualBatchCode
        ) || null
      : null;

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
      setItemSearch("");
      setBatchSearch("");
      form.setValue("itemId", selectedItem.id);
      form.setValue("batchEntryMode", "existing");
      form.setValue("itemBatchLocationId", "");
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
    form.setValue("itemBatchLocationId", batchLocation.id);
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
    if (value !== "existing" && value !== "new") {
      return;
    }

    setBatchSearch("");
    form.setValue("batchEntryMode", value);
    form.setValue("itemBatchLocationId", "");
    form.setValue("batchLocationSku", "");
    form.setValue("batchCode", "");
    form.setValue("batchReceivedAt", "");
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

    if (duplicateBatchLocation) {
      form.setError("batchCode", {
        type: "validate",
        message: tValidation("batchAlreadyExistsAtLocation"),
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
    duplicateBatchLocation,
    form,
    isNewBatchValidationFailed,
    isNewBatchValidationPending,
    manualBatchCode,
    tValidation,
  ]);

  const onSubmit = (data: StockAdjustmentLineItemFormValues) => {
    if (data.batchEntryMode === "new" && isNewBatchValidationFailed) {
      form.setError("batchCode", {
        type: "validate",
        message: tValidation("batchAvailabilityCheckFailed"),
      });
      return;
    }

    if (data.batchEntryMode === "new" && duplicateBatchLocation) {
      form.setError("batchCode", {
        type: "validate",
        message: tValidation("batchAlreadyExistsAtLocation"),
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
      adjustedQty: finalStockInBaseUnits, // Send final stock in BASE UNITS
    };

    if (onSave(submitData)) {
      onOpenChange(false);
    }
  };

  const currentQty = form.watch("currentQty") || 0;
  const adjustmentAmount = form.watch("adjustmentAmount") || 0; // This is always positive
  const adjustmentType = form.watch("adjustmentType") || "add";
  const unitCost = form.watch("unitCost") || 0;
  const isItemSelected = Boolean(form.watch("itemId"));
  const isBatchSelected =
    batchEntryMode === "existing"
      ? Boolean(form.watch("itemBatchLocationId"))
      : Boolean(locationId && manualBatchCode.trim() && !duplicateBatchLocation);

  // Calculate adjustment in base units (with sign based on type)
  const absAdjustmentInBaseUnits = adjustmentAmount;
  const adjustmentInBaseUnits =
    adjustmentType === "remove" ? -absAdjustmentInBaseUnits : absAdjustmentInBaseUnits;

  // Calculate new stock level
  const newStockQty = currentQty + adjustmentInBaseUnits;

  // Calculate difference and value (in base units)
  const difference = adjustmentInBaseUnits;
  const totalValue = difference * unitCost;
  const displayTotalValue = Math.abs(totalValue) < 0.005 ? 0 : totalValue;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl">
            {mode === "edit" ? t("editTitle") : t("createTitle")}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit" ? t("editDescription") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-2">
            {/* Item Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                  <span className="text-lg font-bold text-purple-700">1</span>
                </div>
                <h3 className="text-base font-semibold text-gray-900">{t("selectItemStep")}</h3>
              </div>

              <FormField
                control={form.control}
                name="itemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      {t("itemLabel")} <span className="text-red-500">*</span>
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
                        placeholder={t("chooseItem")}
                        searchPlaceholder={t("searchByCodeOrName")}
                        emptyMessage={t("chooseItem")}
                        isLoading={isItemsLoading}
                        renderOption={(entry, selected) => (
                          <div className="flex items-center gap-2">
                            <Check
                              className={`h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`}
                            />
                            <span className="font-mono text-xs text-gray-500">{entry.code}</span>
                            <span>•</span>
                            <span>{entry.name}</span>
                          </div>
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  {t("batchEntryModeLabel")}
                </Label>
                <Tabs value={batchEntryMode} onValueChange={handleBatchEntryModeChange}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="existing" disabled={!isItemSelected}>
                      {t("existingBatchMode")}
                    </TabsTrigger>
                    <TabsTrigger value="new" disabled={!isItemSelected || !locationId}>
                      {t("newBatchMode")}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                {isItemSelected && !locationId ? (
                  <p className="text-xs text-muted-foreground">{t("newBatchLocationRequired")}</p>
                ) : null}
              </div>

              {batchEntryMode === "existing" ? (
                <FormField
                  control={form.control}
                  name="itemBatchLocationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        {t("batchLabel")} <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <AsyncSearchCombobox
                          value={field.value || ""}
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
                          placeholder={
                            isItemSelected ? t("chooseBatch") : t("chooseItemBeforeBatch")
                          }
                          searchPlaceholder={t("searchByBatchOrQr")}
                          emptyMessage={t("noBatches")}
                          loadingMessage={t("loadingBatches")}
                          isLoading={isBatchLocationsLoading}
                          disabled={!isItemSelected}
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
                                    qty: entry.qtyOnHand.toLocaleString(locale, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    }),
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="batchCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        {t("manualBatchCodeLabel")} <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          onChange={(event) => {
                            field.onChange(event.target.value);
                            form.clearErrors("batchCode");
                            form.setValue("itemBatchLocationId", "");
                            form.setValue("batchLocationSku", "");
                            form.setValue("batchReceivedAt", "");
                            form.setValue("batchWarehouseLocationId", locationId || "");
                            form.setValue("batchLocationCode", "");
                            form.setValue("batchLocationName", "");
                            form.setValue("currentQty", 0);
                            form.setValue("adjustedQty", 0);
                          }}
                          placeholder={t("manualBatchCodePlaceholder")}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">{t("manualBatchCodeHint")}</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Current Stock Display */}
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">
                    {t("currentStockOnHand")}
                  </span>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      {currentQty.toLocaleString(locale, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-xs text-gray-500">{uomLabel || t("units")}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Adjustment Type & Amount */}
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                  <span className="text-lg font-bold text-purple-700">2</span>
                </div>
                <h3 className="text-base font-semibold text-gray-900">
                  {t("adjustmentDetailsStep")}
                </h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="adjustmentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        {t("typeLabel")} <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!isBatchSelected || batchEntryMode === "new"}
                      >
                        <FormControl>
                          <SelectTrigger
                            className="h-11"
                            disabled={!isBatchSelected || batchEntryMode === "new"}
                          >
                            <SelectValue placeholder={t("selectType")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="add">
                            <div className="flex items-center gap-2 py-1">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                                <span className="text-sm font-bold text-green-700">+</span>
                              </div>
                              <div>
                                <p className="font-medium">{t("increaseStock")}</p>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="remove">
                            <div className="flex items-center gap-2 py-1">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100">
                                <span className="text-sm font-bold text-red-700">−</span>
                              </div>
                              <div>
                                <p className="font-medium">{t("decreaseStock")}</p>
                              </div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {batchEntryMode === "new" ? (
                        <p className="text-xs text-muted-foreground">
                          {t("newBatchIncreaseOnlyHint")}
                        </p>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="adjustmentAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        {t("quantityLabel")} <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            placeholder={t("quantityPlaceholder")}
                            className="h-11 pr-20 text-right text-base font-semibold"
                            disabled={!isBatchSelected}
                          />
                          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                            {uomLabel || t("units")}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="unitCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      {t("unitCostLabel")} <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                          ¥
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          placeholder={t("quantityPlaceholder")}
                          className="h-11 pl-8 pr-4 text-right text-base font-semibold"
                          disabled={!isItemSelected}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Summary Section */}
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                  <span className="text-lg font-bold text-purple-700">3</span>
                </div>
                <h3 className="text-base font-semibold text-gray-900">{t("summaryStep")}</h3>
              </div>

              <div className={`space-y-3 ${isBatchSelected ? "" : "opacity-60"}`}>
                {/* New Stock Level Card */}
                <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        {t("newStockLevel")}
                      </span>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-purple-900">
                          {newStockQty.toLocaleString(locale, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                        <p className="text-xs font-medium text-purple-600">
                          {uomLabel || t("units")}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-purple-200 pt-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{t("currentStock")}</span>
                        <span className="font-semibold text-gray-900">
                          {currentQty.toLocaleString(locale, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{t("adjustment")}</span>
                        <span
                          className={`font-bold ${
                            adjustmentInBaseUnits > 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {adjustmentInBaseUnits > 0 ? "+" : ""}
                          {adjustmentInBaseUnits.toLocaleString(locale, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-purple-200 pt-2 text-sm">
                        <span className="font-semibold text-gray-700">{t("newStock")}</span>
                        <span className="font-bold text-purple-900">
                          {newStockQty.toLocaleString(locale, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Value Impact Card */}
                <div className="rounded-lg bg-gray-50 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{t("valueImpact")}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {t("valueImpactFormula", {
                          quantity: Math.abs(adjustmentInBaseUnits).toLocaleString(locale, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }),
                          uom: uomLabel || t("units"),
                          unitCost: formatCurrency(unitCost),
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-2xl font-bold ${
                          displayTotalValue > 0
                            ? "text-green-600"
                            : displayTotalValue < 0
                              ? "text-red-600"
                              : "text-gray-600"
                        }`}
                      >
                        {displayTotalValue < 0
                          ? `(${formatCurrency(Math.abs(displayTotalValue))})`
                          : formatCurrency(displayTotalValue)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t pt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} size="lg">
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={
                  isNewBatchValidationPending ||
                  isNewBatchValidationFailed ||
                  Boolean(duplicateBatchLocation)
                }
                className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
              >
                {mode === "edit" ? t("updateAction") : t("createAction")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
