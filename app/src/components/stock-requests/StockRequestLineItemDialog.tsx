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
import { useActivePackages } from "@/hooks/useItemPackages";

const lineItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  itemCode: z.string().optional(),
  itemName: z.string().optional(),
  uomId: z.string().min(1, "Unit of measure is required"),
  packagingId: z.string().nullable().optional(),
  requestedQty: z.number().min(0.01, "Requested quantity must be greater than 0"),
  notes: z.string().optional(),
});

export type StockRequestLineItemFormValues = z.infer<typeof lineItemSchema>;
export type StockRequestLineItemPayload = StockRequestLineItemFormValues & {
  packagingName?: string;
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
  const { data: itemsData } = useItems({ limit: 1000 });
  const items = itemsData?.data || [];

  const form = useForm<StockRequestLineItemFormValues>({
    resolver: zodResolver(lineItemSchema),
    defaultValues: {
      itemId: "",
      itemCode: "",
      itemName: "",
      uomId: "",
      packagingId: null,
      requestedQty: 1,
      notes: "",
    },
  });

  // Reset form when dialog opens/closes or item changes
  useEffect(() => {
    if (open && item) {
      const { packagingName, ...formItem } = item;
      form.reset(formItem);
    } else if (open) {
      form.reset({
        itemId: "",
        itemCode: "",
        itemName: "",
        uomId: "",
        packagingId: null,
        requestedQty: 1,
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
      form.setValue("packagingId", null);
    }
  };

  const onSubmit = (data: StockRequestLineItemFormValues) => {
    const selectedPackage = packages?.find((pkg) => pkg.id === data.packagingId);

    onSave({
      ...data,
      packagingName: selectedPackage?.packName,
    });
    onOpenChange(false);
  };

  const requestedQty = form.watch("requestedQty") || 0;
  const itemId = form.watch("itemId");
  const packagingId = form.watch("packagingId");
  const { data: packages } = useActivePackages(itemId);

  useEffect(() => {
    if (!itemId || packagingId) {
      return;
    }

    const basePackage = packages?.find((pkg) => pkg.isBasePackage) ||
      packages?.find((pkg) => pkg.isDefault);

    if (basePackage) {
      form.setValue("packagingId", basePackage.id);
    }
  }, [itemId, packagingId, packages, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit Request Item" : "Add Request Item"}
          </DialogTitle>
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
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                      placeholder="Enter quantity"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="packagingId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Package (Optional)</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value || null)}
                    value={field.value || ""}
                    disabled={!itemId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            itemId ? "Select package (optional)" : "Select an item first"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(packages || []).map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.id}>
                          {pkg.packName}
                          {pkg.isBasePackage ? " [Base]" : ""}
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
                <span className="text-2xl font-bold">
                  {requestedQty.toFixed(2)}
                </span>
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
