"use client";

import { useEffect, useState } from "react";
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
import { PackageSelector } from "@/components/inventory/PackageSelector";

const lineItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  itemCode: z.string().optional(),
  itemName: z.string().optional(),
  uomId: z.string().min(1, "Unit of measure is required"),
  currentQty: z.number().min(0, "Current quantity cannot be negative"),
  adjustedQty: z.number().min(0, "Adjusted quantity cannot be negative"), // This will store the FINAL quantity
  packagingId: z.string().nullable().optional(), // null = use base package
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
  onItemSelect?: (
    itemId: string,
    warehouseId: string,
    locationId?: string
  ) => Promise<number>;
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
  const items = itemsData?.data || [];
  const { formatCurrency } = useCurrency();

  // Track package info for conversion display
  const [packageInfo, setPackageInfo] = useState<{
    name: string;
    conversionFactor: number;
    baseUom: string;
  } | null>(null);

  const form = useForm<StockAdjustmentLineItemFormValues>({
    resolver: zodResolver(lineItemSchema),
    defaultValues: {
      itemId: "",
      itemCode: "",
      itemName: "",
      uomId: "",
      currentQty: 0,
      adjustedQty: 0,
      packagingId: null,
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
        packagingId: null,
        unitCost: 0,
        adjustmentAmount: 0,
        adjustmentType: "add",
      });
      setPackageInfo(null);
    }
  }, [open, item, form]);

  const handleItemSelect = async (itemId: string) => {
    const selectedItem = items.find((i) => i.id === itemId);
    if (selectedItem) {
      form.setValue("itemId", selectedItem.id);
      form.setValue("itemCode", selectedItem.code);
      form.setValue("itemName", selectedItem.name);
      form.setValue("uomId", selectedItem.uomId);
      form.setValue("unitCost", selectedItem.standardCost);

      // Fetch item packages and set default to base package
      try {
        const response = await fetch(`/api/items/${itemId}/packages`);
        if (response.ok) {
          const packagesData = await response.json();
          const basePackage = packagesData.data?.find((pkg: any) => pkg.isBasePackage);
          if (basePackage) {
            form.setValue("packagingId", basePackage.id);

            // Set package info for display
            setPackageInfo({
              name: basePackage.packageName,
              conversionFactor: basePackage.qtyPerPack,
              baseUom: basePackage.uomCode || "Unit",
            });
          }
        }
      } catch (error) {
        // If fetching packages fails, leave packagingId as null
        setPackageInfo(null);
      }

      // Fetch current stock quantity if warehouse is selected
      if (warehouseId && onItemSelect) {
        const currentQty = await onItemSelect(itemId, warehouseId, locationId);
        form.setValue("currentQty", currentQty);
        // Don't default adjustedQty - user will enter adjustment amount
      }
    }
  };

  // Update package info when packaging changes
  const handlePackageChange = async (packagingId: string | null) => {
    const itemId = form.watch("itemId");
    if (!itemId) return;

    try {
      const response = await fetch(`/api/items/${itemId}/packages`);
      if (response.ok) {
        const packagesData = await response.json();
        const selectedPackage = packagesData.data?.find((pkg: any) => pkg.id === packagingId);
        if (selectedPackage) {
          setPackageInfo({
            name: selectedPackage.packageName,
            conversionFactor: selectedPackage.qtyPerPack,
            baseUom: selectedPackage.uomCode || "Unit",
          });
        } else {
          setPackageInfo(null);
        }
      }
    } catch (error) {
      setPackageInfo(null);
    }
  };

  const onSubmit = (data: StockAdjustmentLineItemFormValues) => {
    // Calculate final stock in BASE UNITS
    const conversionFactor = packageInfo?.conversionFactor || 1;

    // Convert adjustment amount to base units
    const adjustmentInBaseUnits = (data.adjustmentAmount || 0) * conversionFactor;

    // Apply sign based on adjustment type
    const signedAdjustment = data.adjustmentType === "remove"
      ? -adjustmentInBaseUnits
      : adjustmentInBaseUnits;

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

  // Calculate adjustment in base units (with sign based on type)
  const conversionFactor = packageInfo?.conversionFactor || 1;
  const absAdjustmentInBaseUnits = adjustmentAmount * conversionFactor;
  const adjustmentInBaseUnits = adjustmentType === "remove" ? -absAdjustmentInBaseUnits : absAdjustmentInBaseUnits;

  // Calculate new stock level
  const newStockQty = currentQty + adjustmentInBaseUnits;

  // Calculate difference and value (in base units)
  const difference = adjustmentInBaseUnits;
  const totalValue = difference * unitCost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit Adjustment Item" : "Add Adjustment Item"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update the adjustment item details."
              : "Fill in the details for the new adjustment item."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="itemId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item *</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleItemSelect(value);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an item" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {items
                        .filter((i) => i.isActive)
                        .map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.code} - {item.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Compact Package and Current Stock Row - Always visible */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="packagingId"
                render={({ field }) => (
                  <FormItem>
                    <PackageSelector
                      itemId={form.watch("itemId") || ""}
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value);
                        handlePackageChange(value);
                      }}
                      quantity={adjustmentAmount !== 0 ? Math.abs(adjustmentAmount) : undefined}
                      label="Package"
                      required={false}
                    />
                  </FormItem>
                )}
              />

              <div>
                <label className="text-sm font-medium mb-1.5 block">Current Stock</label>
                <div className="rounded-md bg-muted/50 p-2.5 border h-10 flex items-center justify-end">
                  <span className="font-semibold">
                    {currentQty.toFixed(4)} <span className="text-xs text-muted-foreground">{packageInfo?.baseUom || "units"}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Adjustment Type and Quantity */}
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="adjustmentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adjustment Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select adjustment type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="add">
                          <span className="flex items-center gap-2">
                            <span className="text-green-600">+</span>
                            Add Stock
                          </span>
                        </SelectItem>
                        <SelectItem value="remove">
                          <span className="flex items-center gap-2">
                            <span className="text-red-600">−</span>
                            Remove Stock
                          </span>
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
                    <FormLabel className="flex items-center justify-between">
                      <span>Quantity</span>
                      {packageInfo && packageInfo.conversionFactor !== 1 && adjustmentAmount !== 0 && (
                        <span className="text-xs font-normal text-blue-600 dark:text-blue-400">
                          ≈ {adjustmentInBaseUnits > 0 ? "+" : ""}{adjustmentInBaseUnits.toFixed(4)} {packageInfo.baseUom}
                        </span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                          placeholder="Enter quantity"
                          className="pr-16"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {packageInfo?.name || "units"}
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
                  <FormLabel>Unit Cost *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Summary Display - Always visible */}
            <div className="space-y-3">
              <div className="rounded-md border-2 border-primary/20 bg-primary/5 p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">New Stock Level:</span>
                    <span className="text-2xl font-bold">
                      {newStockQty.toFixed(4)} {packageInfo?.baseUom || "units"}
                    </span>
                  </div>

                  <div className="pt-2 border-t space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Current:</span>
                      <span>{currentQty.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Adjustment:</span>
                      <span className={adjustmentInBaseUnits > 0 ? "text-green-600 font-medium" : adjustmentInBaseUnits < 0 ? "text-red-600 font-medium" : ""}>
                        {adjustmentInBaseUnits > 0 ? "+" : ""}
                        {adjustmentInBaseUnits.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium pt-1 border-t">
                      <span>New:</span>
                      <span>{newStockQty.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-md bg-muted p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Value Impact:</span>
                  <span
                    className={`text-lg font-bold ${
                      totalValue > 0
                        ? "text-green-600"
                        : totalValue < 0
                        ? "text-red-600"
                        : ""
                    }`}
                  >
                    {totalValue > 0 ? "+" : ""}
                    {formatCurrency(totalValue)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.abs(adjustmentInBaseUnits).toFixed(4)} {packageInfo?.baseUom || "units"} × {formatCurrency(unitCost)}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {mode === "edit" ? "Update Item" : "Add Item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
