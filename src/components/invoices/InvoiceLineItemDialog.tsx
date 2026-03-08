"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
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
import {
  createInvoiceLineItemSchema,
  invoiceLineItemSchema,
} from "@/lib/validations/invoice";

export type LineItemFormValues = z.output<typeof invoiceLineItemSchema> & {
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
  const t = useTranslations("invoiceLineItemDialog");
  const { data: itemsData } = useItems({ limit: 50 });
  const items = itemsData?.data || [];
  const { formatCurrency } = useCurrency();
  const lineItemSchema = createInvoiceLineItemSchema((key) => t(key));
  type LineItemFormInput = z.input<typeof lineItemSchema>;

  const form = useForm<LineItemFormInput>({
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
    const selectedItem = items.find((entry) => entry.id === itemId);
    if (!selectedItem) return;

    form.setValue("itemId", selectedItem.id);
    form.setValue("itemCode", selectedItem.code);
    form.setValue("itemName", selectedItem.name);
    const itemDescription = "description" in selectedItem ? selectedItem.description : "";
    form.setValue("description", itemDescription);
    form.setValue("unitPrice", selectedItem.listPrice);
    form.setValue("uomId", selectedItem.uomId);
  };

  const onSubmit = (data: LineItemFormInput) => {
    const parsed = lineItemSchema.parse(data);
    onSave({
      ...parsed,
      lineTotal,
    });
    onOpenChange(false);
  };

  const quantity = form.watch("quantity");
  const unitPrice = form.watch("unitPrice");
  const discount = form.watch("discount");
  const taxRate = form.watch("taxRate");
  const lineSubtotal = (quantity || 0) * (unitPrice || 0);
  const discountAmount = (lineSubtotal * (discount || 0)) / 100;
  const taxableAmount = lineSubtotal - discountAmount;
  const taxAmount = (taxableAmount * (taxRate || 0)) / 100;
  const lineTotal = taxableAmount + taxAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>
            {mode === "edit" ? t("editDescription") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="itemId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("item")} *</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleItemSelect(value);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectItem")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {items
                        .filter((entry) => entry.isActive)
                        .map((entry) => (
                          <SelectItem key={entry.id} value={entry.id}>
                            {entry.code} - {entry.name}
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
                  <FormLabel>{t("description")}</FormLabel>
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
                    <FormLabel>{t("quantity")} *</FormLabel>
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
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("unitPrice")} *</FormLabel>
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
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("discountRate")}</FormLabel>
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
                name="taxRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("taxRate")}</FormLabel>
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

            <div className="rounded-lg bg-muted p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>{t("subtotal")}:</span>
                  <span className="font-medium">{formatCurrency(lineSubtotal)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>{t("discount")}:</span>
                  <span className="font-medium">-{formatCurrency(discountAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("tax")}:</span>
                  <span className="font-medium">{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-lg font-bold">
                  <span>{t("lineTotal")}:</span>
                  <span>{formatCurrency(lineTotal)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit">{mode === "edit" ? t("updateItem") : t("addItem")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
