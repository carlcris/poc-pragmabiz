"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useItems } from "@/hooks/useItems";
import { useCurrency } from "@/hooks/useCurrency";

const lineItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  itemCode: z.string().optional(),
  itemName: z.string().optional(),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  rate: z.number().min(0, "Rate cannot be negative"),
  uomId: z.string().min(1, "Unit of measure is required"),
  discountPercent: z.number().min(0).max(100).default(0),
  taxPercent: z.number().min(0).max(100).default(0),
});

type PurchaseOrderLineItemInput = z.input<typeof lineItemSchema>;
export type PurchaseOrderLineItemFormValues = z.output<typeof lineItemSchema> & {
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
  const { data: itemsData } = useItems({ limit: 50, includeStock: true });
  const items = itemsData?.data || [];
  const { formatCurrency } = useCurrency();
  const [itemOpen, setItemOpen] = useState(false);

  const form = useForm<PurchaseOrderLineItemInput>({
    resolver: zodResolver(lineItemSchema),
    defaultValues: {
      itemId: "",
      itemCode: "",
      itemName: "",
      quantity: 1,
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
      form.setValue("rate", selectedItem.standardCost || selectedItem.listPrice);
      form.setValue("uomId", selectedItem.uomId);
    }
  };

  const onSubmit = (data: PurchaseOrderLineItemInput) => {
    const parsed = lineItemSchema.parse(data);
    onSave({
      ...parsed,
      lineTotal,
    });
    onOpenChange(false);
  };

  const quantity = form.watch("quantity");
  const rate = form.watch("rate");
  const discountPercent = form.watch("discountPercent");
  const taxPercent = form.watch("taxPercent");
  const lineSubtotal = (quantity || 0) * (rate || 0);
  const discountAmount = (lineSubtotal * (discountPercent || 0)) / 100;
  const taxableAmount = lineSubtotal - discountAmount;
  const taxAmount = (taxableAmount * (taxPercent || 0)) / 100;
  const lineTotal = taxableAmount + taxAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit Line Item" : "Add Line Item"}</DialogTitle>
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
                <FormItem className="flex flex-col">
                  <FormLabel>Item *</FormLabel>
                  <Popover open={itemOpen} onOpenChange={setItemOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={itemOpen}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? (() => {
                                const selectedItem = items.find((i) => i.id === field.value);
                                return selectedItem
                                  ? `${selectedItem.code} - ${selectedItem.name}`
                                  : "Select an item";
                              })()
                            : "Search item..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[520px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search by code or name..." />
                        <CommandList className="max-h-[260px] overflow-y-auto">
                          <CommandEmpty>No item found.</CommandEmpty>
                          <CommandGroup>
                            {items
                              .filter((i) => i.isActive)
                              .map((item) => (
                                <CommandItem
                                  key={item.id}
                                  value={`${item.code} ${item.name}`}
                                  onSelect={() => {
                                    field.onChange(item.id);
                                    handleItemSelect(item.id);
                                    setItemOpen(false);
                                  }}
                                  className="flex items-center gap-2"
                                >
                                  <Check
                                    className={cn(
                                      "h-4 w-4",
                                      field.value === item.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{item.code}</span>
                                      <span className="truncate text-sm text-muted-foreground">
                                        {item.name}
                                      </span>
                                    </div>
                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                      On hand:{" "}
                                      {("onHand" in item ? item.onHand : 0).toFixed(2)}{" "}
                                      {"uom" in item ? item.uom : ""} • Available:{" "}
                                      {("available" in item ? item.available : 0).toFixed(2)}{" "}
                                      {"uom" in item ? item.uom : ""}
                                    </div>
                                  </div>
                                  <div className="ml-4 flex-shrink-0 text-sm font-semibold">
                                    {formatCurrency(item.listPrice)}
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
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                  <span className="font-medium">{formatCurrency(lineSubtotal)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Discount:</span>
                  <span className="font-medium">-{formatCurrency(discountAmount)}</span>
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{mode === "edit" ? "Update Item" : "Add Item"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
