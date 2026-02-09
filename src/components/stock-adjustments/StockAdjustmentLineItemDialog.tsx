"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useItems } from "@/hooks/useItems";
import { useCurrency } from "@/hooks/useCurrency";

const lineItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  itemCode: z.string().optional(),
  itemName: z.string().optional(),
  uomId: z.string().min(1, "Unit of measure is required"),
  currentQty: z.number().min(0, "Current quantity cannot be negative"),
  adjustedQty: z.number().min(0, "Adjusted quantity cannot be negative"), // This will store the FINAL quantity
  unitCost: z.number().min(0, "Unit cost cannot be negative"),
  adjustmentAmount: z.number().optional(), // User input: the delta (always positive)
  adjustmentType: z.enum(["add", "remove"]).optional(), // Whether to add or remove
});

export type StockAdjustmentLineItemFormValues = z.infer<typeof lineItemSchema>;

interface StockAdjustmentLineItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: StockAdjustmentLineItemFormValues) => void;
  item?: StockAdjustmentLineItemFormValues | null;
  mode?: "add" | "edit";
  warehouseId?: string;
  locationId?: string;
  onItemSelect?: (itemId: string, warehouseId: string, locationId?: string) => Promise<number>;
}

export function StockAdjustmentLineItemDialog({
  open,
  onOpenChange,
  onSave,
  item,
  mode = "add",
  warehouseId,
  locationId,
  onItemSelect,
}: StockAdjustmentLineItemDialogProps) {
  const { data: itemsData } = useItems({ limit: 1000 });
  const items = useMemo(() => itemsData?.data || [], [itemsData?.data]);
  const { formatCurrency } = useCurrency();
  const [uomLabel, setUomLabel] = useState<string>("");
  const [itemSearch, setItemSearch] = useState("");

  const form = useForm<StockAdjustmentLineItemFormValues>({
    resolver: zodResolver(lineItemSchema),
    defaultValues: {
      itemId: "",
      itemCode: "",
      itemName: "",
      uomId: "",
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
      form.reset(item);
    } else if (open) {
      form.reset({
        itemId: "",
        itemCode: "",
        itemName: "",
        uomId: "",
        currentQty: 0,
        adjustedQty: 0,
        unitCost: 0,
        adjustmentAmount: 0,
        adjustmentType: "add",
      });
    }
  }, [open, item, form]);

  const watchedItemId = form.watch("itemId");

  useEffect(() => {
    if (!watchedItemId) {
      setUomLabel("");
      return;
    }
    const selectedItem = items.find((candidate) => candidate.id === watchedItemId);
    setUomLabel(selectedItem?.uom || "");
  }, [watchedItemId, items]);

  const handleItemSelect = async (itemId: string) => {
    const selectedItem = items.find((i) => i.id === itemId);
    if (selectedItem) {
      setItemSearch("");
      form.setValue("itemId", selectedItem.id);
      form.setValue("itemCode", selectedItem.code);
      form.setValue("itemName", selectedItem.name);
      form.setValue("uomId", selectedItem.uomId);
      setUomLabel(selectedItem.uom || "");
      form.setValue("unitCost", selectedItem.standardCost);

      // Fetch current stock quantity if warehouse is selected
      if (warehouseId && onItemSelect) {
        const currentQty = await onItemSelect(itemId, warehouseId, locationId);
        form.setValue("currentQty", currentQty);
        // Don't default adjustedQty - user will enter adjustment amount
      }
    }
  };

  const onSubmit = (data: StockAdjustmentLineItemFormValues) => {
    // Calculate final stock in base units
    const adjustmentInBaseUnits = data.adjustmentAmount || 0;

    // Apply sign based on adjustment type
    const signedAdjustment =
      data.adjustmentType === "remove" ? -adjustmentInBaseUnits : adjustmentInBaseUnits;

    // Calculate final stock in base units
    const finalStockInBaseUnits = data.currentQty + signedAdjustment;

    const submitData = {
      ...data,
      adjustedQty: finalStockInBaseUnits, // Send final stock in BASE UNITS
    };

    onSave(submitData);
    onOpenChange(false);
  };

  const currentQty = form.watch("currentQty") || 0;
  const adjustmentAmount = form.watch("adjustmentAmount") || 0; // This is always positive
  const adjustmentType = form.watch("adjustmentType") || "add";
  const unitCost = form.watch("unitCost") || 0;
  const isItemSelected = Boolean(form.watch("itemId"));

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
            {mode === "edit" ? "Edit Stock Adjustment" : "New Stock Adjustment"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update the adjustment details below"
              : "Adjust inventory levels for a specific item"}
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
                <h3 className="text-base font-semibold text-gray-900">Select Item</h3>
              </div>

              <FormField
                control={form.control}
                name="itemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Inventory Item <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        handleItemSelect(value);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Choose an item to adjust" />
                        </SelectTrigger>
                      </FormControl>
                    <SelectContent>
                      <div className="p-2">
                        <Input
                          placeholder="Search by code or name..."
                          value={itemSearch}
                          onChange={(e) => setItemSearch(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      {items
                        .filter((i) => i.isActive)
                        .filter((item) => {
                          if (!itemSearch.trim()) return true;
                          const term = itemSearch.trim().toLowerCase();
                          return (
                            item.code.toLowerCase().includes(term) ||
                            item.name.toLowerCase().includes(term)
                          );
                        })
                        .map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-gray-500">{item.code}</span>
                              <span>•</span>
                              <span>{item.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Current Stock Display */}
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Current Stock on Hand</span>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      {currentQty.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">{uomLabel || "units"}</p>
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
                <h3 className="text-base font-semibold text-gray-900">Adjustment Details</h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="adjustmentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Type <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!isItemSelected}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11" disabled={!isItemSelected}>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="add">
                            <div className="flex items-center gap-2 py-1">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                                <span className="text-sm font-bold text-green-700">+</span>
                              </div>
                              <div>
                                <p className="font-medium">Increase Stock</p>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="remove">
                            <div className="flex items-center gap-2 py-1">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100">
                                <span className="text-sm font-bold text-red-700">−</span>
                              </div>
                              <div>
                                <p className="font-medium">Decrease Stock</p>
                              </div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
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
                        Quantity <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="h-11 pr-20 text-right text-base font-semibold"
                            disabled={!isItemSelected}
                          />
                          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                            {uomLabel || "units"}
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
                      Unit Cost <span className="text-red-500">*</span>
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
                          placeholder="0.00"
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
                <h3 className="text-base font-semibold text-gray-900">Summary</h3>
              </div>

              <div className={`space-y-3 ${isItemSelected ? "" : "opacity-60"}`}>
                {/* New Stock Level Card */}
                <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">New Stock Level</span>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-purple-900">
                          {newStockQty.toFixed(2)}
                        </p>
                        <p className="text-xs font-medium text-purple-600">
                          {uomLabel || "units"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-purple-200 pt-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Current Stock</span>
                        <span className="font-semibold text-gray-900">
                          {currentQty.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Adjustment</span>
                        <span
                          className={`font-bold ${
                            adjustmentInBaseUnits > 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {adjustmentInBaseUnits > 0 ? "+" : ""}
                          {adjustmentInBaseUnits.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-purple-200 pt-2 text-sm">
                        <span className="font-semibold text-gray-700">New Stock</span>
                        <span className="font-bold text-purple-900">
                          {newStockQty.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Value Impact Card */}
                <div className="rounded-lg bg-gray-50 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Value Impact</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {Math.abs(adjustmentInBaseUnits).toFixed(2)} {uomLabel || "units"} ×{" "}
                        {formatCurrency(unitCost)}
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
                Cancel
              </Button>
              <Button
                type="submit"
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
              >
                {mode === "edit" ? "Update Adjustment" : "Add Adjustment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
