"use client";

import { useEffect } from "react";
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
  adjustedQty: z.number().min(0, "Adjusted quantity cannot be negative"),
  unitCost: z.number().min(0, "Unit cost cannot be negative"),
});

export type StockAdjustmentLineItemFormValues = z.infer<typeof lineItemSchema>;

interface StockAdjustmentLineItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: StockAdjustmentLineItemFormValues) => void;
  item?: StockAdjustmentLineItemFormValues | null;
  mode?: "add" | "edit";
  warehouseId?: string;
  onItemSelect?: (itemId: string, warehouseId: string) => Promise<number>;
}

export function StockAdjustmentLineItemDialog({
  open,
  onOpenChange,
  onSave,
  item,
  mode = "add",
  warehouseId,
  onItemSelect,
}: StockAdjustmentLineItemDialogProps) {
  const { data: itemsData } = useItems({ limit: 1000 });
  const items = itemsData?.data || [];
  const { formatCurrency } = useCurrency();

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
      });
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

      // Fetch current stock quantity if warehouse is selected
      if (warehouseId && onItemSelect) {
        const currentQty = await onItemSelect(itemId, warehouseId);
        form.setValue("currentQty", currentQty);
        form.setValue("adjustedQty", currentQty);
      }
    }
  };

  const onSubmit = (data: StockAdjustmentLineItemFormValues) => {
    onSave(data);
    onOpenChange(false);
  };

  const currentQty = form.watch("currentQty") || 0;
  const adjustedQty = form.watch("adjustedQty") || 0;
  const unitCost = form.watch("unitCost") || 0;

  // Calculate difference and value
  const difference = adjustedQty - currentQty;
  const totalValue = difference * unitCost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="currentQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                        disabled
                        className="bg-muted"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="adjustedQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adjusted Quantity *</FormLabel>
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

            {/* Summary Display */}
            <div className="rounded-md bg-muted p-4">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Difference:</span>
                  <span
                    className={`font-medium ${
                      difference > 0
                        ? "text-green-600"
                        : difference < 0
                        ? "text-red-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    {difference > 0 ? "+" : ""}
                    {difference.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>Total Value:</span>
                  <span
                    className={
                      totalValue > 0
                        ? "text-green-600"
                        : totalValue < 0
                        ? "text-red-600"
                        : ""
                    }
                  >
                    {formatCurrency(totalValue)}
                  </span>
                </div>
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
