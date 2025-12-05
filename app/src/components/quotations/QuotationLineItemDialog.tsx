"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Textarea } from "@/components/ui/textarea";
import { useItems } from "@/hooks/useItems";
import { useItemsEnhanced } from "@/hooks/useItemsEnhanced";
import { useCurrency } from "@/hooks/useCurrency";

const lineItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  itemCode: z.string().optional(),
  itemName: z.string().optional(),
  description: z.string().default(""),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
  uomId: z.string().min(1, "Unit of measure is required"),
  discount: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
});

export type LineItemFormValues = z.infer<typeof lineItemSchema>;

interface QuotationLineItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: LineItemFormValues) => void;
  item?: LineItemFormValues | null;
  mode?: "add" | "edit";
}

export function QuotationLineItemDialog({
  open,
  onOpenChange,
  onSave,
  item,
  mode = "add",
}: QuotationLineItemDialogProps) {
  // Fetch basic items (for uomId and description)
  const { data: basicItemsData } = useItems({ limit: 1000 });
  const basicItems = basicItemsData?.data || [];

  // Fetch items with stock information for display
  const { data: enhancedItemsData } = useItemsEnhanced({ limit: 1000 });
  const enhancedItems = enhancedItemsData?.data || [];

  const { formatCurrency } = useCurrency();

  // Item combobox state
  const [itemOpen, setItemOpen] = useState(false);

  const form = useForm<LineItemFormValues>({
    resolver: zodResolver(lineItemSchema),
    defaultValues: {
      itemId: "",
      itemCode: "",
      itemName: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      uomId: "",
      discount: 0,
      taxRate: 0,
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
        description: "",
        quantity: 1,
        unitPrice: 0,
        uomId: "",
        discount: 0,
        taxRate: 0,
      });
    }
  }, [open, item, form]);

  const handleItemSelect = (itemId: string) => {
    const basicItem = basicItems.find((i) => i.id === itemId);
    const enhancedItem = enhancedItems.find((i) => i.id === itemId);

    if (basicItem) {
      form.setValue("itemId", basicItem.id);
      form.setValue("itemCode", basicItem.code);
      form.setValue("itemName", basicItem.name);
      form.setValue("description", basicItem.description);
      form.setValue("unitPrice", basicItem.listPrice);
      form.setValue("uomId", basicItem.uomId);
    }
  };

  const onSubmit = (data: LineItemFormValues) => {
    onSave(data);
    onOpenChange(false);
  };

  const quantity = form.watch("quantity");
  const unitPrice = form.watch("unitPrice");
  const discount = form.watch("discount");
  const taxRate = form.watch("taxRate");

  // Calculate line total
  const lineSubtotal = (quantity || 0) * (unitPrice || 0);
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
              render={({ field }) => {
                const selectedItem = basicItems.find((i) => i.id === field.value);
                return (
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
                            {selectedItem
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
                                      handleItemSelect(item.id);
                                      setItemOpen(false);
                                    }}
                                    className="flex items-center justify-between py-2"
                                  >
                                    <div className="flex items-start flex-1 min-w-0">
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4 flex-shrink-0 mt-1",
                                          field.value === item.id
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">{item.code}</span>
                                          <span className="text-sm truncate">
                                            {item.name}
                                          </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                          <span
                                            className={cn(
                                              item.available <= 0
                                                ? "text-red-600 font-medium"
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

            {/* Line Total Display */}
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
