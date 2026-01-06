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
import { Textarea } from "@/components/ui/textarea";
import { useItems } from "@/hooks/useItems";
import { useCurrency } from "@/hooks/useCurrency";
import { PackageSelector } from "@/components/inventory/PackageSelector";
import { useActivePackages } from "@/hooks/useItemPackages";

const lineItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  itemCode: z.string().optional(),
  itemName: z.string().optional(),
  description: z.string().default(""),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  packagingId: z.string().nullable().optional(),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
  uomId: z.string().min(1, "Unit of measure is required"),
  discount: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  lineTotal: z.number().optional(),
});

export type LineItemFormValues = z.infer<typeof lineItemSchema> & {
  packagingName?: string;
  lineTotal?: number;
};

interface InvoiceLineItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: LineItemFormValues) => void;
  item?: LineItemFormValues | null;
  mode?: "add" | "edit";
}

export function InvoiceLineItemDialog({
  open,
  onOpenChange,
  onSave,
  item,
  mode = "add",
}: InvoiceLineItemDialogProps) {
  const { data: itemsData } = useItems({ limit: 1000 });
  const items = itemsData?.data || [];
  const { formatCurrency } = useCurrency();

  const form = useForm<LineItemFormValues>({
    resolver: zodResolver(lineItemSchema),
    defaultValues: {
      itemId: "",
      itemCode: "",
      itemName: "",
      description: "",
      quantity: 1,
      packagingId: null,
      unitPrice: 0,
      uomId: "",
      discount: 0,
      taxRate: 0,
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
        description: "",
        quantity: 1,
        packagingId: null,
        unitPrice: 0,
        uomId: "",
        discount: 0,
        taxRate: 0,
      });
    }
  }, [open, item, form]);

  const handleItemSelect = async (itemId: string) => {
    const selectedItem = items.find((i) => i.id === itemId);
    if (selectedItem) {
      form.setValue("itemId", selectedItem.id);
      form.setValue("itemCode", selectedItem.code);
      form.setValue("itemName", selectedItem.name);
      form.setValue("description", selectedItem.description);
      form.setValue("unitPrice", selectedItem.listPrice);
      form.setValue("uomId", selectedItem.uomId);

      try {
        const response = await fetch(`/api/items/${itemId}/packages`);
        if (response.ok) {
          const packagesData = await response.json();
          const basePackage = packagesData.data?.find((pkg: any) => pkg.isBasePackage);
          if (basePackage) {
            form.setValue("packagingId", basePackage.id);
          }
        }
      } catch (error) {
        // If fetching packages fails, leave packagingId as null
      }
    }
  };

  const onSubmit = (data: LineItemFormValues) => {
    onSave({
      ...data,
      lineTotal,
      packagingName: selectedPackage?.packName,
    });
    onOpenChange(false);
  };

  const quantity = form.watch("quantity");
  const unitPrice = form.watch("unitPrice");
  const discount = form.watch("discount");
  const taxRate = form.watch("taxRate");
  const itemId = form.watch("itemId");
  const packagingId = form.watch("packagingId");
  const { data: packages } = useActivePackages(itemId);
  const selectedPackage = packages?.find((pkg) => pkg.id === packagingId);
  const conversionFactor = selectedPackage?.qtyPerPack ?? 1;
  const normalizedQty = (quantity || 0) * conversionFactor;

  const lineSubtotal = normalizedQty * (unitPrice || 0);
  const discountAmount = (lineSubtotal * (discount || 0)) / 100;
  const taxableAmount = lineSubtotal - discountAmount;
  const taxAmount = (taxableAmount * (taxRate || 0)) / 100;
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

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Package selector */}
            <FormField
              control={form.control}
              name="packagingId"
              render={({ field }) => (
                <FormItem>
                  {itemId ? (
                    <PackageSelector
                      itemId={itemId}
                      value={field.value}
                      onChange={field.onChange}
                      quantity={form.watch("quantity")}
                      label="Package"
                      required={false}
                    />
                  ) : (
                    <>
                      <FormLabel>Package</FormLabel>
                      <div className="w-full rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                        Select an item to choose a package.
                      </div>
                    </>
                  )}
                </FormItem>
              )}
            />

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
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price *</FormLabel>
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
                name="discount"
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
                name="taxRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Rate %</FormLabel>
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
