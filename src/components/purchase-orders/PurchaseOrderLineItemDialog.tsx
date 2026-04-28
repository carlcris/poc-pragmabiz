"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
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
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useItem, useItems } from "@/hooks/useItems";
import { useCurrency } from "@/hooks/useCurrency";
import {
  createPurchaseOrderLineItemSchema,
  type PurchaseOrderLineItemInput,
} from "@/lib/validations/purchase-order-dialog";

export type PurchaseOrderLineItemFormValues = PurchaseOrderLineItemInput & {
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
  const t = useTranslations("purchaseOrderLineItemDialog");
  const tValidation = useTranslations("purchaseOrderValidation");
  const [itemSearch, setItemSearch] = useState("");
  const debouncedItemSearch = useDebouncedValue(itemSearch.trim());
  const { data: itemsData, isLoading: isItemsLoading } = useItems({
    search: debouncedItemSearch || undefined,
    limit: 5,
    includeStock: true,
  });
  const items = itemsData?.data || [];
  const { formatCurrency } = useCurrency();
  const lineItemSchema = createPurchaseOrderLineItemSchema((key) => tValidation(key));

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
  const selectedItemId = form.watch("itemId");
  const { data: selectedItemResponse } = useItem(selectedItemId);
  const selectedItem = items.find((entry) => entry.id === selectedItemId) ?? selectedItemResponse?.data ?? null;

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
          <DialogTitle>{mode === "edit" ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? t("editDescription")
              : t("createDescription")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="itemId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t("itemLabel")}</FormLabel>
                  <FormControl>
                    <AsyncSearchCombobox
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        handleItemSelect(value);
                      }}
                      searchValue={itemSearch}
                      onSearchValueChange={setItemSearch}
                      options={items.filter((entry) => entry.isActive)}
                      selectedOption={selectedItem}
                      getOptionValue={(entry) => entry.id}
                      getOptionLabel={(entry) => `${entry.code} - ${entry.name}`}
                      getOptionSearchValue={(entry) => `${entry.code} ${entry.name}`}
                      placeholder={t("searchItem")}
                      searchPlaceholder={t("searchByCodeOrName")}
                      emptyMessage={t("noItemFound")}
                      isLoading={isItemsLoading}
                      popoverClassName="w-[520px]"
                      renderOption={(entry, selected) => (
                        <div className="flex items-center gap-2">
                          <Check className={`h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{entry.code}</span>
                              <span className="truncate text-sm text-muted-foreground">
                                {entry.name}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {t("onHand")}: {("onHand" in entry ? entry.onHand ?? 0 : 0).toFixed(2)}{" "}
                              {"uom" in entry ? entry.uom ?? "" : ""} • {t("available")}:{" "}
                              {("available" in entry ? entry.available ?? 0 : 0).toFixed(2)}{" "}
                              {"uom" in entry ? entry.uom ?? "" : ""}
                            </div>
                          </div>
                          <div className="ml-4 flex-shrink-0 text-sm font-semibold">
                            {formatCurrency(entry.listPrice)}
                          </div>
                        </div>
                      )}
                    />
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
                    <FormLabel>{t("quantityLabel")}</FormLabel>
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
                    <FormLabel>{t("rateLabel")}</FormLabel>
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
                    <FormLabel>{t("discountLabel")}</FormLabel>
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
                    <FormLabel>{t("taxLabel")}</FormLabel>
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
                  <span>{t("subtotal")}</span>
                  <span className="font-medium">{formatCurrency(lineSubtotal)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>{t("discount")}</span>
                  <span className="font-medium">-{formatCurrency(discountAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("tax")}</span>
                  <span className="font-medium">{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>{t("lineTotal")}</span>
                  <span>{formatCurrency(lineTotal)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit">{mode === "edit" ? t("updateAction") : t("createAction")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
