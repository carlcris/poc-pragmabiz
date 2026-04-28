"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check } from "lucide-react";
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
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useItem, useItems } from "@/hooks/useItems";

const transformationItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  itemCode: z.string().optional(),
  itemName: z.string().optional(),
  quantity: z.number().min(0.001, "Quantity must be greater than 0"),
  uomId: z.string().min(1, "Unit of measure is required"),
  uom: z.string().optional(),
  sequence: z.number().int().min(1).optional(),
  isScrap: z.boolean().optional(),
  notes: z.string().optional(),
});

export type TransformationItemFormValues = z.infer<typeof transformationItemSchema>;

interface TransformationItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: TransformationItemFormValues) => void;
  item?: TransformationItemFormValues | null;
  mode?: "add" | "edit";
  type: "input" | "output";
}

export function TransformationItemDialog({
  open,
  onOpenChange,
  onSave,
  item,
  mode = "add",
  type,
}: TransformationItemDialogProps) {
  const [itemSearch, setItemSearch] = useState("");
  const debouncedItemSearch = useDebouncedValue(itemSearch.trim());
  const { data: itemsData, isLoading: isLoadingItems } = useItems({
    search: debouncedItemSearch || undefined,
    limit: 5,
  });
  const items = itemsData?.data || [];

  const form = useForm<TransformationItemFormValues>({
    resolver: zodResolver(transformationItemSchema),
    defaultValues: {
      itemId: "",
      itemCode: "",
      itemName: "",
      quantity: 1,
      uomId: "",
      uom: "",
      sequence: 1,
      isScrap: false,
      notes: "",
    },
  });
  const selectedItemId = form.watch("itemId");
  const { data: selectedItemResponse } = useItem(selectedItemId);
  const selectedItem =
    items.find((entry) => entry.id === selectedItemId) ?? selectedItemResponse?.data ?? null;

  // Reset form when dialog opens/closes or item changes
  useEffect(() => {
    if (open && item) {
      form.reset(item);
    } else if (open) {
      form.reset({
        itemId: "",
        itemCode: "",
        itemName: "",
        quantity: 1,
        uomId: "",
        uom: "",
        sequence: 1,
        isScrap: false,
        notes: "",
      });
    }
  }, [open, item, form]);

  const handleItemSelect = (itemId: string) => {
    const selectedItem = items.find((i) => i.id === itemId);

    if (selectedItem) {
      form.setValue("itemId", selectedItem.id);
      form.setValue("itemCode", selectedItem.code);
      form.setValue("itemName", selectedItem.name);
      form.setValue("uomId", selectedItem.uomId);
      form.setValue("uom", selectedItem.uom);
    }
  };

  const onSubmit = (data: TransformationItemFormValues) => {
    onSave(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit" : "Add"} {type === "input" ? "Input" : "Output"} Item
          </DialogTitle>
          <DialogDescription>
            {type === "input"
              ? "Select a material to be consumed in this transformation"
              : "Select a product to be produced by this transformation"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Item Selection */}
            <FormField
              control={form.control}
              name="itemId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Item *</FormLabel>
                  <FormControl>
                    <AsyncSearchCombobox
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        handleItemSelect(value);
                      }}
                      searchValue={itemSearch}
                      onSearchValueChange={setItemSearch}
                      options={items}
                      selectedOption={selectedItem}
                      getOptionValue={(entry) => entry.id}
                      getOptionLabel={(entry) => `${entry.code} - ${entry.name}`}
                      getOptionSearchValue={(entry) => `${entry.code} ${entry.name}`}
                      placeholder="Select item..."
                      searchPlaceholder="Search items..."
                      emptyMessage="No items found."
                      isLoading={isLoadingItems}
                      popoverClassName="w-[500px]"
                      renderOption={(entry, selected) => (
                        <div className="flex items-center gap-2">
                          <Check className={`h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`} />
                          <span>{entry.code} - {entry.name}</span>
                        </div>
                      )}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quantity and UOM Row */}
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
                        step="0.001"
                        placeholder="0.00"
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
                name="uom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit of Measure</FormLabel>
                    <FormControl>
                      <Input {...field} disabled placeholder="Auto-filled" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Output-specific: Is Scrap checkbox */}
            {type === "output" && (
              <FormField
                control={form.control}
                name="isScrap"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Mark as Scrap/Byproduct</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        This item is a waste product or byproduct of the transformation
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            )}

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Optional notes..." rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{mode === "edit" ? "Update" : "Add"} Item</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
