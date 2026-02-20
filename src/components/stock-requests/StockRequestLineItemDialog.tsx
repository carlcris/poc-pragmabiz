"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useItems } from "@/hooks/useItems";

const lineItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  itemCode: z.string().optional(),
  itemName: z.string().optional(),
  uomId: z.string().min(1, "Unit of measure is required"),
  requestedQty: z.number().min(0.01, "Requested quantity must be greater than 0"),
  notes: z.string().optional(),
});

export type StockRequestLineItemFormValues = z.infer<typeof lineItemSchema>;
export type StockRequestLineItemPayload = StockRequestLineItemFormValues & {
  uomLabel?: string;
};

interface StockRequestLineItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: StockRequestLineItemPayload) => void;
  item?: StockRequestLineItemPayload | null;
  mode?: "add" | "edit";
}

export function StockRequestLineItemDialog({
  open,
  onOpenChange,
  onSave,
  item,
  mode = "add",
}: StockRequestLineItemDialogProps) {
  const [itemOpen, setItemOpen] = useState(false);
  const [itemSearchInput, setItemSearchInput] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const { data: itemsData, isLoading: isItemsLoading, isFetching: isItemsFetching } = useItems({
    limit: 5,
    includeStock: true,
    search: itemSearch || undefined,
    enabled: open && itemOpen,
  });
  const items = itemsData?.data || [];

  const form = useForm<StockRequestLineItemFormValues>({
    resolver: zodResolver(lineItemSchema),
    defaultValues: {
      itemId: "",
      itemCode: "",
      itemName: "",
      uomId: "",
      requestedQty: 1,
      notes: "",
    },
  });

  // Reset form when dialog opens/closes or item changes
  useEffect(() => {
    if (open && item) {
      const formItem = { ...item };
      form.reset(formItem);
    } else if (open) {
      form.reset({
        itemId: "",
        itemCode: "",
        itemName: "",
        uomId: "",
        requestedQty: 1,
        notes: "",
      });
    }
  }, [open, item, form]);

  useEffect(() => {
    const trimmed = itemSearchInput.trim();

    if (trimmed.length === 0) {
      setItemSearch("");
      return;
    }

    if (trimmed.length < 3) {
      setItemSearch("");
      return;
    }

    const timer = setTimeout(() => {
      setItemSearch(trimmed);
    }, 400);

    return () => clearTimeout(timer);
  }, [itemSearchInput]);

  useEffect(() => {
    if (!itemOpen) {
      setItemSearchInput("");
      setItemSearch("");
    }
  }, [itemOpen]);

  const handleItemSelect = (itemId: string) => {
    const selectedItem = items.find((i) => i.id === itemId);
    if (selectedItem) {
      form.setValue("itemId", selectedItem.id);
      form.setValue("itemCode", selectedItem.code);
      form.setValue("itemName", selectedItem.name);
      form.setValue("uomId", selectedItem.uomId);
    }
  };

  const onSubmit = (data: StockRequestLineItemFormValues) => {
    const selectedItem = items.find((i) => i.id === data.itemId);
    const uomLabel = selectedItem?.uom || item?.uomLabel || "";

    onSave({
      ...data,
      uomLabel,
    });
    onOpenChange(false);
  };

  const requestedQty = form.watch("requestedQty") || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit Request Item" : "Add Request Item"}</DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update the request item details."
              : "Fill in the details for the new request item."}
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
                                if (selectedItem) {
                                  return `${selectedItem.code} - ${selectedItem.name}`;
                                }
                                const currentCode = form.getValues("itemCode");
                                const currentName = form.getValues("itemName");
                                return currentCode && currentName
                                  ? `${currentCode} - ${currentName}`
                                  : "Select an item";
                              })()
                            : "Search item..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(95vw,520px)] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search by code or name..."
                          value={itemSearchInput}
                          onValueChange={setItemSearchInput}
                        />
                        <CommandList className="max-h-[260px] overflow-y-auto">
                          {isItemsLoading || isItemsFetching ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Loading items...</span>
                            </div>
                          ) : (
                            <>
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
                                      className="flex items-start gap-2 py-2"
                                    >
                                      <Check
                                        className={cn(
                                          "mt-0.5 h-4 w-4 shrink-0",
                                          field.value === item.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold break-words">
                                          {item.code}
                                        </div>
                                        <div className="text-sm text-muted-foreground break-words">
                                          {item.name}
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground break-words">
                                          On hand:{" "}
                                          {("onHand" in item ? item.onHand : 0).toFixed(2)}{" "}
                                          {"uom" in item ? item.uom : ""} • Available:{" "}
                                          {("available" in item ? item.available : 0).toFixed(2)}{" "}
                                          {"uom" in item ? item.uom : ""}
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="requestedQty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requested Quantity *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      placeholder="Enter quantity"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes for this item..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Summary Display */}
            <div className="rounded-md border-2 border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Quantity to Request:</span>
                <span className="text-2xl font-bold">{requestedQty.toFixed(2)}</span>
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
