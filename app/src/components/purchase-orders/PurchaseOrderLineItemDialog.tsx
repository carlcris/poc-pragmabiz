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
import { PackageSelector } from "@/components/inventory/PackageSelector";
import { useActivePackages } from "@/hooks/useItemPackages";

const lineItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  itemCode: z.string().optional(),
  itemName: z.string().optional(),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  packagingId: z.string().nullable().optional(), // null = use base package
  rate: z.number().min(0, "Rate cannot be negative"),
  uomId: z.string().min(1, "Unit of measure is required"),
  discountPercent: z.number().min(0).max(100).default(0),
  taxPercent: z.number().min(0).max(100).default(0),
});

export type PurchaseOrderLineItemFormValues = z.infer<typeof lineItemSchema> & {
  packagingName?: string;
  lineTotal?: number;
};

interface PurchaseOrderLineItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: PurchaseOrderLineItemFormValues) => void;
  item?: PurchaseOrderLineItemFormValues | null;
  mode?: "add" | "edit";
}

export function PurchaseOrderLineItemDialog({
  open,
  onOpenChange,
  onSave,
  item,
  mode = "add",
}: PurchaseOrderLineItemDialogProps) {
  const { data: itemsData } = useItems({ limit: 1000 });
  const items = itemsData?.data || [];
  const { formatCurrency } = useCurrency();

  const form = useForm<PurchaseOrderLineItemFormValues>({
    resolver: zodResolver(lineItemSchema),
    defaultValues: {
      itemId: "",
      itemCode: "",
      itemName: "",
      quantity: 1,
      packagingId: null,
      rate: 0,
      uomId: "",
      discountPercent: 0,
      taxPercent: 0,
    },
  });

  useEffect(() => {
    if (open && item) {
      form.reset(item);
    } else if (open) {
      form.reset({
        itemId: "",
        itemCode: "",
        itemName: "",
        quantity: 1,
        packagingId: null,
        rate: 0,
        uomId: "",
        discountPercent: 0,
        taxPercent: 0,
      });
    }
  }, [open, item, form]);

  const handleItemSelect = (itemId: string) => {
    const selectedItem = items.find((i) => i.id === itemId);
    if (selectedItem) {
      form.setValue("itemId", selectedItem.id);
      form.setValue("itemCode", selectedItem.code);
      form.setValue("itemName", selectedItem.name);
      // Use cost price for purchase orders (if available)
      form.setValue("rate", selectedItem.costPrice || selectedItem.listPrice);
      form.setValue("uomId", selectedItem.uomId);
    }
  };

  const onSubmit = (data: PurchaseOrderLineItemFormValues) => {
    onSave({
      ...data,
      lineTotal,
      packagingName: selectedPackage?.packName,
    });
    onOpenChange(false);
  };

  const quantity = form.watch("quantity");
  const rate = form.watch("rate");
  const discountPercent = form.watch("discountPercent");
  const taxPercent = form.watch("taxPercent");
  const itemId = form.watch("itemId");
  const packagingId = form.watch("packagingId");
  const { data: packages } = useActivePackages(itemId);
  const selectedPackage = packages?.find((pkg) => pkg.id === packagingId);
  const conversionFactor = selectedPackage?.qtyPerPack ?? 1;
  const normalizedQty = (quantity || 0) * conversionFactor;

  const lineSubtotal = normalizedQty * (rate || 0);
  const discountAmount = (lineSubtotal * (discountPercent || 0)) / 100;
  const taxableAmount = lineSubtotal - discountAmount;
  const taxAmount = (taxableAmount * (taxPercent || 0)) / 100;
  const lineTotal = taxableAmount + taxAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit Line Item" : "Add Line Item"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update the line item details."
              : "Fill in the details for the new line item."}
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

            {/* Package selector */}
            {form.watch("itemId") && (
              <FormField
                control={form.control}
                name="packagingId"
                render={({ field }) => (
                  <FormItem>
                    <PackageSelector
                      itemId={form.watch("itemId")}
                      value={field.value}
                      onChange={field.onChange}
                      quantity={form.watch("quantity")}
                      label="Package"
                      required={false}
                    />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
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

              <FormField
                control={form.control}
                name="rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate *</FormLabel>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="discountPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount %</FormLabel>
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

              <FormField
                control={form.control}
                name="taxPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax %</FormLabel>
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

            <div className="rounded-md bg-muted p-4">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-medium">
                    {formatCurrency(lineSubtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Discount:</span>
                  <span className="font-medium">
                    -{formatCurrency(discountAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span className="font-medium">{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>Line Total:</span>
                  <span>{formatCurrency(lineTotal)}</span>
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
