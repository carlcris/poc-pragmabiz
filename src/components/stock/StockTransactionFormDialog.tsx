"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { useCreateStockTransaction } from "@/hooks/useStockTransactions";
import { useCreateStockTransfer } from "@/hooks/useStockTransfers";
import { useItems } from "@/hooks/useItems";
import { useItemsStock } from "@/hooks/useItemsStock";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useCurrency } from "@/hooks/useCurrency";
import { createStockTransactionFormSchema } from "@/lib/validations/stock-transaction";
import type { z } from "zod";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { WarehouseLocation } from "@/types/inventory-location";

interface StockTransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockTransactionFormDialog({
  open,
  onOpenChange,
}: StockTransactionFormDialogProps) {
  const t = useTranslations("stockTransactionForm");
  const tPage = useTranslations("stockTransactionsPage");
  const tValidation = useTranslations("stockTransactionValidation");
  const locale = useLocale();
  const createTransaction = useCreateStockTransaction();
  const createTransfer = useCreateStockTransfer();
  const stockTransactionFormSchema = createStockTransactionFormSchema((key) => tValidation(key));
  const transactionTypes = useMemo(
    () =>
      [
        { value: "in", label: tPage("stockIn") },
        { value: "out", label: tPage("stockOut") },
        { value: "transfer", label: tPage("transfer") },
        { value: "adjustment", label: tPage("adjustment") },
      ] as const,
    [tPage]
  );
  const reasons = useMemo(
    () => ({
      in: [
        t("reasonPurchaseReceipt"),
        t("reasonProductionOutput"),
        t("reasonCustomerReturn"),
        t("reasonOther"),
      ],
      out: [
        t("reasonSalesOrder"),
        t("reasonProductionConsumption"),
        t("reasonDamageLoss"),
        t("reasonOther"),
      ],
      transfer: [
        t("reasonStockRebalancing"),
        t("reasonCustomerRequest"),
        t("reasonWarehouseConsolidation"),
        t("reasonOther"),
      ],
      adjustment: [
        t("reasonPhysicalCountAdjustment"),
        t("reasonDamagedGoods"),
        t("reasonSystemCorrection"),
        t("reasonOther"),
      ],
    }),
    [t]
  );

  // Fetch basic items (for uomId)
  const { data: basicItemsData } = useItems({ limit: 50 });
  const basicItems = useMemo(() => basicItemsData?.data || [], [basicItemsData]);

  const { data: warehousesData } = useWarehouses({ limit: 50 });
  const { formatCurrency } = useCurrency();

  const warehouses = warehousesData?.data?.filter((wh) => wh.isActive) || [];
  type StockTransactionFormInput = z.input<typeof stockTransactionFormSchema>;

  // Item combobox state
  const [itemOpen, setItemOpen] = useState(false);

  const form = useForm<StockTransactionFormInput>({
    resolver: zodResolver(stockTransactionFormSchema),
    defaultValues: {
      transactionDate: new Date().toISOString().slice(0, 16),
      transactionType: "in",
      itemId: "",
      warehouseId: "",
      toWarehouseId: "",
      fromLocationId: "",
      toLocationId: "",
      quantity: 1,
      uomId: "",
      referenceType: "",
      referenceId: "",
      referenceNumber: "",
      reason: "",
      notes: "",
    },
  });

  const transactionType = form.watch("transactionType");
  const selectedWarehouseId = form.watch("warehouseId");
  const selectedToWarehouseId = form.watch("toWarehouseId");
  const selectedItemId = form.watch("itemId");

  // Fetch items with stock information filtered by selected warehouse
  const { data: stockItemsData } = useItemsStock({
    limit: 50,
    warehouseId: selectedWarehouseId || undefined,
  });
  const stockItems = stockItemsData?.data || [];

  const { data: fromLocationsData } = useQuery<{ data: WarehouseLocation[] }>({
    queryKey: ["warehouse-locations", selectedWarehouseId],
    queryFn: () => apiClient.get(`/api/warehouses/${selectedWarehouseId}/locations`),
    enabled: !!selectedWarehouseId,
  });

  const { data: toLocationsData } = useQuery<{ data: WarehouseLocation[] }>({
    queryKey: ["warehouse-locations", selectedToWarehouseId],
    queryFn: () => apiClient.get(`/api/warehouses/${selectedToWarehouseId}/locations`),
    enabled: !!selectedToWarehouseId,
  });

  const fromLocations = useMemo(
    () => (fromLocationsData?.data || []).filter((location) => location.isActive),
    [fromLocationsData]
  );

  const toLocations = useMemo(
    () => (toLocationsData?.data || []).filter((location) => location.isActive),
    [toLocationsData]
  );

  useEffect(() => {
    // Reset destination warehouse when transaction type changes
    if (transactionType !== "transfer") {
      form.setValue("toWarehouseId", "");
      form.setValue("toLocationId", "");
    }
    if (transactionType === "in") {
      form.setValue("fromLocationId", "");
    }
    if (transactionType === "out" || transactionType === "adjustment") {
      form.setValue("toLocationId", "");
    }
  }, [transactionType, form]);

  useEffect(() => {
    // Clear selected item when warehouse changes
    if (selectedWarehouseId) {
      form.setValue("itemId", "");
      form.setValue("fromLocationId", "");
      form.setValue("toLocationId", "");
    }
  }, [selectedWarehouseId, form]);

  useEffect(() => {
    if (!selectedToWarehouseId) {
      form.setValue("toLocationId", "");
    }
  }, [selectedToWarehouseId, form]);

  useEffect(() => {
    // Set uomId when item changes
    if (selectedItemId) {
      const selectedItem = basicItems.find((item) => item.id === selectedItemId);
      if (selectedItem?.uomId) {
        form.setValue("uomId", selectedItem.uomId);
      }
    }
  }, [selectedItemId, form, basicItems]);

  const onSubmit = async (values: StockTransactionFormInput) => {
    try {
      const parsed = stockTransactionFormSchema.parse(values);
      // Find the selected item to get its UOM
      const selectedItem = basicItems.find((item) => item.id === parsed.itemId);
      if (!selectedItem || !selectedItem.uomId) {
        toast.error(t("invalidItem"));
        return;
      }

      // Check if this is a transfer to a van warehouse
      const isSameWarehouse =
        parsed.transactionType === "transfer" &&
        parsed.toWarehouseId &&
        parsed.warehouseId === parsed.toWarehouseId;
      const isTransferToVan =
        parsed.transactionType === "transfer" &&
        parsed.toWarehouseId &&
        warehouses.find((w) => w.id === parsed.toWarehouseId)?.isVan;

      if (isTransferToVan && !isSameWarehouse) {
        // Create a pending stock transfer for van (requires driver confirmation)
        const transferData = {
          fromWarehouseId: parsed.warehouseId,
          toWarehouseId: parsed.toWarehouseId!,
          transferDate: parsed.transactionDate,
          notes: parsed.reason,
          fromLocationId: parsed.fromLocationId || undefined,
          toLocationId: parsed.toLocationId || undefined,
          items: [
            {
              itemId: parsed.itemId,
              code: selectedItem.code,
              name: selectedItem.name,
              quantity: parsed.quantity,
              uomId: parsed.uomId,
              uomName: selectedItem.uom,
            },
          ],
        };

        await createTransfer.mutateAsync(transferData);
        toast.success(`${t("transferCreated")}. ${t("transferCreatedDescription")}`);
      } else {
        // Create immediate stock transaction (non-van transfer or other transaction types)
        const requestData = {
          transactionDate: parsed.transactionDate,
          transactionType: parsed.transactionType,
          warehouseId: parsed.warehouseId,
          toWarehouseId: parsed.toWarehouseId || undefined,
          fromLocationId: parsed.fromLocationId || undefined,
          toLocationId: parsed.toLocationId || undefined,
          referenceType: parsed.referenceType || undefined,
          referenceId: parsed.referenceId || undefined,
          referenceNumber: parsed.referenceNumber || undefined,
          notes: parsed.reason,
          items: [
            {
              itemId: parsed.itemId,
              quantity: parsed.quantity,
              uomId: parsed.uomId,
              notes: parsed.notes || undefined,
            },
          ],
        };

        await createTransaction.mutateAsync(requestData);
        toast.success(t("createSuccess"));
      }

      onOpenChange(false);
      form.reset();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("createError");
      toast.error(errorMessage);
    }
  };

  const isSubmitting = createTransaction.isPending || createTransfer.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="transactionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("transactionDateLabel")}</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="transactionType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("transactionTypeLabel")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectType")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {transactionTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="warehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {transactionType === "transfer"
                        ? t("fromWarehouseLabel")
                        : t("warehouseLabel")}
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectWarehouse")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.code} - {warehouse.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {transactionType === "transfer" && (
                <FormField
                  control={form.control}
                  name="toWarehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("toWarehouseLabel")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("selectDestinationWarehouse")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {warehouses.map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id}>
                              {warehouse.code} - {warehouse.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {transactionType === "transfer" ? (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fromLocationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fromLocationLabel")}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!selectedWarehouseId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                selectedWarehouseId
                                  ? t("selectLocation")
                                  : t("selectWarehouseFirst")
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {fromLocations.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.code} {location.name ? `- ${location.name}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="toLocationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("toLocationLabel")}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!selectedToWarehouseId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                selectedToWarehouseId
                                  ? t("selectLocation")
                                  : t("selectDestinationWarehouseFirst")
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {toLocations.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.code} {location.name ? `- ${location.name}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : (
              <FormField
                control={form.control}
                name={transactionType === "in" ? "toLocationId" : "fromLocationId"}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {transactionType === "in"
                        ? t("destinationLocationLabel")
                        : t("sourceLocationLabel")}
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!selectedWarehouseId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              selectedWarehouseId ? t("selectLocation") : t("selectWarehouseFirst")
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {fromLocations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.code} {location.name ? `- ${location.name}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="itemId"
              render={({ field }) => {
                const selectedItem = basicItems.find((i) => i.id === field.value);
                const isDisabled = !selectedWarehouseId;
                return (
                    <FormItem className="flex flex-col">
                    <FormLabel>{t("itemLabel")}</FormLabel>
                    <Popover
                      open={itemOpen}
                      onOpenChange={(open) => !isDisabled && setItemOpen(open)}
                    >
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={itemOpen}
                            disabled={isDisabled}
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {isDisabled
                              ? t("selectWarehouseFirstItem")
                              : selectedItem
                                ? `${selectedItem.code} - ${selectedItem.name}`
                                : t("searchItem")}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[600px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder={t("searchItemByCodeOrName")} />
                          <CommandList className="max-h-[300px] overflow-y-auto">
                            <CommandEmpty>{t("noItemFound")}</CommandEmpty>
                            <CommandGroup>
                              {stockItems
                                .filter((i) => i.isActive)
                                .map((item) => (
                                  <CommandItem
                                    key={item.id}
                                    value={`${item.code} ${item.name}`}
                                    onSelect={() => {
                                      field.onChange(item.id);
                                      setItemOpen(false);
                                    }}
                                    className="flex items-center justify-between py-2"
                                  >
                                    <div className="flex min-w-0 flex-1 items-start">
                                      <Check
                                        className={cn(
                                          "mr-2 mt-1 h-4 w-4 flex-shrink-0",
                                          field.value === item.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">{item.code}</span>
                                          <span className="truncate text-sm">{item.name}</span>
                                        </div>
                                        <div className="mt-0.5 text-xs text-muted-foreground">
                                          <span
                                            className={cn(
                                              item.available <= 0
                                                ? "font-medium text-red-600"
                                                : item.available <= item.reorderPoint
                                                  ? "text-orange-600"
                                                  : ""
                                            )}
                                          >
                                            {t("stockLabel")}:{" "}
                                            {item.available.toLocaleString(locale, {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })}{" "}
                                            {item.uom}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="ml-4 flex-shrink-0">
                                      <span className="text-sm font-semibold">
                                        {formatCurrency(item.listPrice)}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("quantityLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={t("quantityPlaceholder")}
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="referenceNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("referenceNumberLabel")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("referenceNumberPlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("reasonLabel")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectReason")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {reasons[transactionType]?.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("notesLabel")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("notesPlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("creating") : t("createAction")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
