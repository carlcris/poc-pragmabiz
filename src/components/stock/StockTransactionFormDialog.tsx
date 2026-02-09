"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { useCreateStockTransaction } from "@/hooks/useStockTransactions";
import { useCreateStockTransfer } from "@/hooks/useStockTransfers";
import { useItems } from "@/hooks/useItems";
import { useItemsEnhanced } from "@/hooks/useItemsEnhanced";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useCurrency } from "@/hooks/useCurrency";
import { stockTransactionFormSchema } from "@/lib/validations/stock-transaction";
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

const TRANSACTION_TYPES = [
  { value: "in", label: "Stock In" },
  { value: "out", label: "Stock Out" },
  { value: "transfer", label: "Transfer" },
  { value: "adjustment", label: "Adjustment" },
] as const;

const REASONS = {
  in: ["Purchase receipt", "Production output", "Customer return", "Other"],
  out: ["Sales order", "Production consumption", "Damage/Loss", "Other"],
  transfer: ["Stock rebalancing", "Customer request", "Warehouse consolidation", "Other"],
  adjustment: ["Physical count adjustment", "Damaged goods", "System correction", "Other"],
};

export function StockTransactionFormDialog({
  open,
  onOpenChange,
}: StockTransactionFormDialogProps) {
  const createTransaction = useCreateStockTransaction();
  const createTransfer = useCreateStockTransfer();

  // Fetch basic items (for uomId)
  const { data: basicItemsData } = useItems({ limit: 1000 });
  const basicItems = useMemo(() => basicItemsData?.data || [], [basicItemsData]);

  const { data: warehousesData } = useWarehouses({ limit: 1000 });
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
  const { data: enhancedItemsData } = useItemsEnhanced({
    limit: 1000,
    warehouseId: selectedWarehouseId || undefined,
  });
  const enhancedItems = enhancedItemsData?.data || [];

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
        toast.error("Invalid item selected or item has no unit of measure");
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
        toast.success("Stock transfer created successfully. Driver must confirm receipt.");
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
        toast.success("Stock transaction created successfully");
      }

      onOpenChange(false);
      form.reset();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create stock transaction";
      toast.error(errorMessage);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Stock Transaction</DialogTitle>
          <DialogDescription>Record a new inventory movement or adjustment</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="transactionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Date *</FormLabel>
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
                    <FormLabel>Transaction Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TRANSACTION_TYPES.map((type) => (
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
                      {transactionType === "transfer" ? "From Warehouse *" : "Warehouse *"}
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select warehouse" />
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
                      <FormLabel>To Warehouse *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select destination" />
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
                      <FormLabel>From Location</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!selectedWarehouseId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                selectedWarehouseId ? "Select location" : "Select warehouse first"
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
                      <FormLabel>To Location</FormLabel>
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
                                  ? "Select location"
                                  : "Select destination warehouse"
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
                      {transactionType === "in" ? "Destination Location" : "Source Location"}
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
                              selectedWarehouseId ? "Select location" : "Select warehouse first"
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
                    <FormLabel>Item *</FormLabel>
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
                              ? "Select warehouse first..."
                              : selectedItem
                                ? `${selectedItem.code} - ${selectedItem.name}`
                                : "Search item..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[600px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search by code or name..." />
                          <CommandList className="max-h-[300px] overflow-y-auto">
                            <CommandEmpty>No item found.</CommandEmpty>
                            <CommandGroup>
                              {enhancedItems
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
                                            Stock: {item.available.toFixed(2)} {item.uom}
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
                  <FormLabel>Quantity *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0"
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
                  <FormLabel>Reference Number</FormLabel>
                  <FormControl>
                    <Input placeholder="PO-2024-001, SO-2024-001, etc." {...field} />
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
                  <FormLabel>Reason *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REASONS[transactionType]?.map((reason) => (
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input placeholder="Additional notes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTransaction.isPending}>
                {createTransaction.isPending ? "Creating..." : "Create Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
