"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useResolvedCustomerPricing } from "@/hooks/useCustomerPricing";
import { useCurrency } from "@/hooks/useCurrency";
import {
  getDefaultPriceTierCode,
  getItemPriceTierOptions,
  resolvePriceTierSelection,
} from "@/lib/pricing/itemPriceTiers";
import { ItemSelect, type ItemSelectOption } from "@/components/common/ItemSelect";

const createLineItemSchema = (messages: {
  itemRequired: string;
  quantityRequired: string;
  unitPriceRequired: string;
  uomRequired: string;
}) =>
  z.object({
    itemId: z.string().min(1, messages.itemRequired),
    itemCode: z.string().optional(),
    itemName: z.string().optional(),
    description: z.string().default(""),
    quantity: z.number().min(0.01, messages.quantityRequired),
    pricingTier: z.string().optional(),
    pricingTierName: z.string().optional(),
    unitPrice: z.number().min(0, messages.unitPriceRequired),
    uomId: z.string().min(1, messages.uomRequired),
    uomCode: z.string().optional(),
    uomName: z.string().optional(),
    discount: z.number().min(0).max(100).default(0),
    taxRate: z.number().min(0).max(100).default(0),
  });

type LineItemFormInput = z.input<ReturnType<typeof createLineItemSchema>>;
export type QuotationInventoryLineItemFormValues = z.output<
  ReturnType<typeof createLineItemSchema>
> & {
  lineTotal?: number;
  available?: number;
  reorderPoint?: number;
};

type QuotationInventoryLineItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: QuotationInventoryLineItemFormValues) => void;
  item?: QuotationInventoryLineItemFormValues | null;
  mode?: "add" | "edit";
  customerId?: string;
};

type LineItemOption = ItemSelectOption & {
  uomCode?: string;
  uomName?: string;
};

export function QuotationInventoryLineItemDialog({
  open,
  onOpenChange,
  onSave,
  item,
  mode = "add",
  customerId,
}: QuotationInventoryLineItemDialogProps) {
  const t = useTranslations("quotationLineItemDialog");
  const tCommon = useTranslations("common");
  const [selectedLineItems, setSelectedLineItems] = useState<Record<string, LineItemOption>>({});
  const [pendingCustomerPriceItemId, setPendingCustomerPriceItemId] = useState<string | null>(null);
  const { formatCurrency } = useCurrency();

  const lineItemSchema = useMemo(
    () =>
      createLineItemSchema({
        itemRequired: t("itemRequired"),
        quantityRequired: t("quantityRequired"),
        unitPriceRequired: t("unitPriceRequired"),
        uomRequired: t("uomRequired"),
      }),
    [t]
  );

  const form = useForm<LineItemFormInput>({
    resolver: zodResolver(lineItemSchema),
    defaultValues: {
      itemId: "",
      itemCode: "",
      itemName: "",
      description: "",
      quantity: 1,
      pricingTier: "",
      pricingTierName: "",
      unitPrice: 0,
      uomId: "",
      uomCode: "",
      uomName: "",
      discount: 0,
      taxRate: 0,
    },
  });

  // Reset form when dialog opens/closes or item changes
  useEffect(() => {
    if (open && item) {
      form.reset(item);
      setSelectedLineItems({
        [item.itemId]: {
          id: item.itemId,
          code: item.itemCode || "",
          name: item.itemName || item.description,
          description: item.description,
          uom: item.uomCode || item.uomName || "",
          uomId: item.uomId,
          uomCode: item.uomCode,
          uomName: item.uomName,
          listPrice: item.unitPrice,
          defaultPriceTier: item.pricingTier,
          priceTiers:
            item.pricingTier && item.pricingTierName
              ? [
                  {
                    id: `${item.itemId}-${item.pricingTier}`,
                    priceTier: item.pricingTier,
                    priceTierName: item.pricingTierName,
                    price: item.unitPrice,
                    currencyCode: "PHP",
                    effectiveFrom: new Date().toISOString().split("T")[0],
                    effectiveTo: null,
                    isActive: true,
                  },
                ]
              : undefined,
        },
      });
    } else if (open) {
      form.reset({
        itemId: "",
        itemCode: "",
        itemName: "",
        description: "",
        quantity: 1,
        pricingTier: "",
        pricingTierName: "",
        unitPrice: 0,
        uomId: "",
        uomCode: "",
        uomName: "",
        discount: 0,
        taxRate: 0,
      });
      setSelectedLineItems({});
    }
  }, [open, item, form]);

  const rememberLineItem = (lineItem: LineItemOption) => {
    setSelectedLineItems((current) => ({
      ...current,
      [lineItem.id]: lineItem,
    }));
  };

  const handleItemSelect = (selectedItem: ItemSelectOption) => {
    rememberLineItem(selectedItem);
    form.setValue("itemId", selectedItem.id);
    form.setValue("itemCode", selectedItem.code);
    form.setValue("itemName", selectedItem.name);
    form.setValue("description", selectedItem.description || "");
    const priceSelection = resolvePriceTierSelection(selectedItem);
    form.setValue("pricingTier", priceSelection.priceTier);
    form.setValue("pricingTierName", priceSelection.priceTierName);
    form.setValue("unitPrice", priceSelection.price);
    form.setValue("uomId", selectedItem.uomId);
    form.setValue("uomCode", selectedItem.uom);
    form.setValue("uomName", selectedItem.uom);
    setPendingCustomerPriceItemId(customerId ? selectedItem.id : null);
  };

  const handlePricingTierChange = (priceTier: string) => {
    if (!pricingLineItem) return;
    const priceSelection = resolvePriceTierSelection(pricingLineItem, priceTier);
    form.setValue("pricingTier", priceSelection.priceTier);
    form.setValue("pricingTierName", priceSelection.priceTierName);
    form.setValue("unitPrice", priceSelection.price);
  };

  const onSubmit = (data: LineItemFormInput) => {
    const parsed = lineItemSchema.parse(data);
    onSave({
      ...parsed,
      lineTotal,
      available: selectedLineItem?.available,
      reorderPoint: selectedLineItem?.reorderPoint,
    });
    onOpenChange(false);
  };

  const quantity = form.watch("quantity");
  const selectedItemId = form.watch("itemId");
  const unitPrice = form.watch("unitPrice");
  const discount = form.watch("discount");
  const taxRate = form.watch("taxRate");
  const selectedLineItem = selectedLineItems[selectedItemId];
  const { data: resolvedCustomerPricing } = useResolvedCustomerPricing({
    customerId,
    itemIds: selectedItemId ? [selectedItemId] : [],
    enabled: open,
  });
  const resolvedPriceTiers = resolvedCustomerPricing?.data.find(
    (entry) => entry.itemId === selectedItemId
  )?.priceTiers;
  const pricingLineItem = useMemo(
    () =>
      selectedLineItem && resolvedPriceTiers
        ? { ...selectedLineItem, priceTiers: resolvedPriceTiers }
        : selectedLineItem,
    [resolvedPriceTiers, selectedLineItem]
  );
  const priceTierOptions = pricingLineItem ? getItemPriceTierOptions(pricingLineItem) : [];
  const selectedPricingTier =
    form.watch("pricingTier") ||
    (pricingLineItem ? getDefaultPriceTierCode(pricingLineItem) : undefined);

  useEffect(() => {
    if (!pricingLineItem || !resolvedPriceTiers || pendingCustomerPriceItemId !== selectedItemId) {
      return;
    }

    const priceSelection = resolvePriceTierSelection(
      pricingLineItem,
      form.getValues("pricingTier")
    );
    form.setValue("pricingTier", priceSelection.priceTier);
    form.setValue("pricingTierName", priceSelection.priceTierName);
    form.setValue("unitPrice", priceSelection.price);
    setPendingCustomerPriceItemId(null);
  }, [form, pendingCustomerPriceItemId, pricingLineItem, resolvedPriceTiers, selectedItemId]);
  const selectedItemAvailable = selectedLineItem?.available ?? 0;
  const showInventoryWarning =
    !!selectedLineItem &&
    typeof selectedLineItem.available === "number" &&
    quantity > 0 &&
    quantity > selectedItemAvailable;
  // Calculate line total
  const lineSubtotal = (quantity || 0) * (unitPrice || 0);
  const discountAmount = (lineSubtotal * (discount || 0)) / 100;
  const taxableAmount = lineSubtotal - discountAmount;
  const taxAmount = (taxableAmount * (taxRate || 0)) / 100;
  const lineTotal = taxableAmount + taxAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{mode === "edit" ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>
            {mode === "edit" ? t("editDescription") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-6 overflow-y-auto px-1">
              <FormField
                control={form.control}
                name="itemId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{tCommon("item")} *</FormLabel>
                    <ItemSelect
                      value={field.value}
                      onValueChange={field.onChange}
                      onItemSelect={handleItemSelect}
                      selectedOption={selectedLineItems[field.value] ?? null}
                      includeStock
                      showStock
                      renderTrailing={(lineItem) =>
                        formatCurrency(resolvePriceTierSelection(lineItem).price)
                      }
                      placeholder={t("searchItem")}
                      searchPlaceholder={t("itemSearchPlaceholder")}
                      emptyMessage={t("noItemFound")}
                    />
                    {showInventoryWarning ? (
                      <Alert className="mt-2 border-amber-200 bg-amber-50 text-amber-900">
                        <AlertDescription>
                          {t("inventoryWarning", {
                            requested: quantity.toFixed(2),
                            available: selectedItemAvailable.toFixed(2),
                            uom: selectedLineItem?.uom || "",
                          })}
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tCommon("description")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Basic Information Card */}
              <div className="space-y-4 rounded-lg border bg-card p-5">
                <h3 className="border-b pb-2 text-base font-semibold text-foreground">
                  {t("basicInformation")}
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">{t("quantity")} *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pricingTier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">{t("pricingTier")}</FormLabel>
                        <Select
                          value={field.value || selectedPricingTier}
                          onValueChange={(value) => {
                            field.onChange(value);
                            handlePricingTierChange(value);
                          }}
                          disabled={!selectedLineItem || priceTierOptions.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder={t("selectPricingTier")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {priceTierOptions.map((priceTier) => (
                              <SelectItem key={priceTier.priceTier} value={priceTier.priceTier}>
                                {priceTier.priceTier.toUpperCase()} (
                                {formatCurrency(priceTier.price)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Pricing & Totals Card */}
              <div className="space-y-4 rounded-lg border bg-card p-5">
                <h3 className="border-b pb-2 text-base font-semibold text-foreground">
                  {t("pricingAndTotals")}
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="discount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">{t("discountRate")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="h-11"
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
                        <FormLabel className="text-sm font-medium">{t("taxRate")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Line Total Summary */}
                <div className="mt-4 rounded-xl border-2 bg-gradient-to-br from-slate-50 to-slate-100 p-5 dark:from-slate-900 dark:to-slate-800">
                  <div className="space-y-3">
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground">
                      {t("orderSummary")}
                    </h4>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between py-1.5 text-sm">
                        <span className="font-medium text-muted-foreground">{t("subtotal")}</span>
                        <span className="text-base font-semibold">
                          {formatCurrency(lineSubtotal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 text-sm">
                        <span className="font-medium text-destructive">{t("discount")}</span>
                        <span className="text-base font-semibold text-destructive">
                          -{formatCurrency(discountAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b py-1.5 pb-2 text-sm">
                        <span className="font-medium text-muted-foreground">{t("tax")}</span>
                        <span className="text-base font-semibold">{formatCurrency(taxAmount)}</span>
                      </div>
                      <div className="-mx-5 flex items-center justify-between rounded-b-lg bg-primary/10 px-5 py-3 pt-2 dark:bg-primary/20">
                        <span className="text-lg font-bold">{t("lineTotal")}</span>
                        <span className="text-2xl font-bold text-primary">
                          {formatCurrency(lineTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="sticky bottom-0 -mx-1 mt-6 flex-shrink-0 border-t bg-muted/30 px-6 py-4 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit">{mode === "edit" ? t("updateItem") : t("addItem")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
