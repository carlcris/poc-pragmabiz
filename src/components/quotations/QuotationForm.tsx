"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Calculator } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useCreateQuotation, useUpdateQuotation } from "@/hooks/useQuotations";
import { useCustomer, useCustomers } from "@/hooks/useCustomers";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { useCurrency } from "@/hooks/useCurrency";
import type { Quotation } from "@/types/quotation";
import type { CreateQuotationRequest } from "@/types/quotation";
import { QuotationLineItemDialog, type LineItemFormValues } from "./QuotationLineItemDialog";

const quotationFormSchema = z.object({
  companyId: z.string().optional(),
  customerId: z.string().min(1, "Customer is required"),
  quotationDate: z.string().min(1, "Quotation date is required"),
  validUntil: z.string().min(1, "Valid until date is required"),
  terms: z.string(),
  notes: z.string(),
});

type QuotationFormValues = z.infer<typeof quotationFormSchema>;

type QuotationFormProps = {
  quotation?: Quotation | null;
  onCancel?: () => void;
  onSuccess?: (quotation: Quotation) => void;
  submitLabel?: string;
};

export function QuotationForm({
  quotation,
  onCancel,
  onSuccess,
  submitLabel,
}: QuotationFormProps) {
  const t = useTranslations("quotationForm");
  const tCommon = useTranslations("common");
  const isEditMode = !!quotation;
  const { formatCurrency } = useCurrency();
  const createMutation = useCreateQuotation();
  const updateMutation = useUpdateQuotation();
  const [customerSearch, setCustomerSearch] = useState("");
  const debouncedCustomerSearch = useDebouncedValue(customerSearch.trim());
  const [lineItems, setLineItems] = useState<LineItemFormValues[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    index: number;
    item: LineItemFormValues;
  } | null>(null);

  const { data: customersData, isLoading: isCustomersLoading } = useCustomers({
    search: debouncedCustomerSearch || undefined,
    limit: 5,
    isActive: true,
  });
  const customers = customersData?.data || [];

  const defaultValues = useMemo<QuotationFormValues>(
    () => ({
      companyId: "",
      customerId: "",
      quotationDate: new Date().toISOString().split("T")[0],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      terms: "Payment due within 30 days. Delivery within 2 weeks of order confirmation.",
      notes: "",
    }),
    []
  );

  const form = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationFormSchema),
    defaultValues,
  });
  const selectedCustomerId = form.watch("customerId");
  const { data: selectedCustomerData } = useCustomer(selectedCustomerId);
  const selectedCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) ?? selectedCustomerData ?? null;

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => {
      const lineTotal = item.lineTotal ?? (item.quantity || 0) * (item.unitPrice || 0);
      const discountRate = (item.discount || 0) / 100;
      const taxRate = (item.taxRate || 0) / 100;
      const denominator = (1 - discountRate) * (1 + taxRate);
      const itemSubtotal = denominator > 0 ? lineTotal / denominator : 0;
      return sum + itemSubtotal;
    }, 0);
    const totalDiscount = lineItems.reduce((sum, item) => {
      const lineTotal = item.lineTotal ?? (item.quantity || 0) * (item.unitPrice || 0);
      const discountRate = (item.discount || 0) / 100;
      const taxRate = (item.taxRate || 0) / 100;
      const denominator = (1 - discountRate) * (1 + taxRate);
      const itemSubtotal = denominator > 0 ? lineTotal / denominator : 0;
      return sum + itemSubtotal * discountRate;
    }, 0);
    const totalTax = lineItems.reduce((sum, item) => {
      const lineTotal = item.lineTotal ?? (item.quantity || 0) * (item.unitPrice || 0);
      const discountRate = (item.discount || 0) / 100;
      const taxRate = (item.taxRate || 0) / 100;
      const denominator = (1 - discountRate) * (1 + taxRate);
      const itemSubtotal = denominator > 0 ? lineTotal / denominator : 0;
      const taxableAmount = itemSubtotal * (1 - discountRate);
      return sum + taxableAmount * taxRate;
    }, 0);
    const totalAmount = subtotal - totalDiscount + totalTax;

    return { subtotal, totalDiscount, totalTax, totalAmount };
  }, [lineItems]);

  useEffect(() => {
    if (quotation) {
      form.reset({
        companyId: quotation.companyId,
        customerId: quotation.customerId,
        quotationDate: quotation.quotationDate.split("T")[0],
        validUntil: quotation.validUntil.split("T")[0],
        terms: quotation.terms,
        notes: quotation.notes,
      });
      setLineItems(
        quotation.lineItems.map((item) => ({
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          uomId: item.uomId,
          uomCode: item.uomCode,
          uomName: item.uomName,
          discount: item.discount,
          taxRate: item.taxRate,
          lineTotal: item.lineTotal,
          frameConfiguration: item.frameConfiguration,
          frameComponents: item.frameComponents,
        }))
      );
      return;
    }

    form.reset(defaultValues);
    setLineItems([]);
  }, [quotation, form, defaultValues]);

  const handleAddItem = () => {
    setEditingItem(null);
    setItemDialogOpen(true);
  };

  const handleEditItem = (index: number) => {
    setEditingItem({ index, item: lineItems[index] });
    setItemDialogOpen(true);
  };

  const handleDeleteItem = (index: number) => {
    setLineItems((items) => items.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSaveItem = (item: LineItemFormValues) => {
    if (editingItem !== null) {
      setLineItems((items) =>
        items.map((currentItem, itemIndex) =>
          itemIndex === editingItem.index ? item : currentItem
        )
      );
    } else {
      setLineItems((items) => [...items, item]);
    }
  };

  const onSubmit = async (data: QuotationFormValues) => {
    if (lineItems.length === 0) {
      alert(t("addLineItemRequired"));
      return;
    }

    try {
      const apiRequest: CreateQuotationRequest = {
        customerId: data.customerId,
        quotationDate: data.quotationDate,
        validUntil: data.validUntil,
        items: lineItems.map((item, index) => ({
          itemId: item.itemId,
          description: item.description,
          quantity: item.quantity,
          uomId: item.uomId,
          rate: item.unitPrice,
          discountPercent: item.discount,
          taxPercent: item.taxRate,
          sortOrder: index,
          frameConfiguration: item.frameConfiguration,
          frameComponents: item.frameComponents,
        })),
        termsConditions: data.terms,
        notes: data.notes,
      };

      const result =
        isEditMode && quotation
          ? await updateMutation.mutateAsync({
              id: quotation.id,
              data: {
                quotationDate: apiRequest.quotationDate,
                validUntil: apiRequest.validUntil,
                items: apiRequest.items,
                termsConditions: apiRequest.termsConditions,
                notes: apiRequest.notes,
              },
            })
          : await createMutation.mutateAsync(apiRequest);

      toast.success(isEditMode ? "Quotation updated successfully" : "Quotation created successfully");
      onSuccess?.(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save quotation");
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <section className="space-y-4 rounded-lg border bg-card p-6">
            <div>
              <h3 className="text-lg font-semibold">{t("generalTab")}</h3>
            </div>
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("customer")} *</FormLabel>
                    <FormControl>
                      <AsyncSearchCombobox
                        value={field.value}
                        onValueChange={field.onChange}
                        searchValue={customerSearch}
                        onSearchValueChange={setCustomerSearch}
                        options={customers}
                        selectedOption={selectedCustomer}
                        getOptionValue={(customer) => customer.id}
                        getOptionLabel={(customer) => customer.name}
                        getOptionSearchValue={(customer) => `${customer.code} ${customer.name}`}
                        placeholder={t("selectCustomer")}
                        searchPlaceholder="Search customer"
                        emptyMessage="No customer found."
                        isLoading={isCustomersLoading}
                        renderOption={(customer, selected) => (
                          <div className="flex items-start py-2">
                            <div
                              className={`mr-2 mt-1 h-4 w-4 flex-shrink-0 ${selected ? "opacity-100" : "opacity-0"}`}
                            >
                              ✓
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium">{customer.name}</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {customer.code}
                              </div>
                            </div>
                          </div>
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="quotationDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("quotationDate")} *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("validUntil")} *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
          </section>

          <section className="space-y-4 rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">{t("lineItemsTitle")}</h3>
                  <p className="text-sm text-muted-foreground">{t("lineItemsDescription")}</p>
                </div>
                <Button type="button" onClick={handleAddItem} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("addItem")}
                </Button>
              </div>

              {lineItems.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed py-12 text-center text-muted-foreground">
                  <p>{t("noItems")}</p>
                  <p className="text-sm">{t("noItemsDescription")}</p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tCommon("item")}</TableHead>
                          <TableHead className="text-right">{t("qty")}</TableHead>
                          <TableHead className="text-center">{t("unit")}</TableHead>
                          <TableHead className="text-right">{t("price")}</TableHead>
                          <TableHead className="text-right">{t("discountPct")}</TableHead>
                          <TableHead className="text-right">{t("taxPct")}</TableHead>
                          <TableHead className="text-right">{t("total")}</TableHead>
                          <TableHead className="w-[100px]">{tCommon("actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.map((item, index) => {
                          const lineTotal = item.lineTotal ?? item.quantity * item.unitPrice;

                          return (
                            <TableRow key={index}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{item.itemName}</div>
                                  <div className="text-sm text-muted-foreground">{item.itemCode}</div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-center">
                                <span className="text-muted-foreground">
                                  {item.uomCode || item.uomName || "-"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                              <TableCell className="text-right">{item.discount}%</TableCell>
                              <TableCell className="text-right">{item.taxRate}%</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(lineTotal)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditItem(index)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteItem(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="rounded-lg bg-muted p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Calculator className="h-5 w-5" />
                      <h4 className="font-semibold">{t("totals")}</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>{t("subtotal")}:</span>
                        <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-red-600">
                        <span>{t("discount")}:</span>
                        <span className="font-medium">-{formatCurrency(totals.totalDiscount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t("tax")}:</span>
                        <span className="font-medium">{formatCurrency(totals.totalTax)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 text-lg font-bold">
                        <span>{t("total")}:</span>
                        <span>{formatCurrency(totals.totalAmount)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
          </section>

          <section className="space-y-4 rounded-lg border bg-card p-6">
            <div>
              <h3 className="text-lg font-semibold">{t("termsTab")}</h3>
            </div>
              <FormField
                control={form.control}
                name="terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("termsConditions")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={4} />
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
                    <FormLabel>{t("internalNotes")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                    )}
                  />
          </section>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {onCancel ? (
              <Button type="button" variant="outline" onClick={onCancel}>
                {tCommon("cancel")}
              </Button>
            ) : null}
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? t("saving")
                : submitLabel || (isEditMode ? t("updateQuotation") : t("createQuotation"))}
            </Button>
          </div>
        </form>
      </Form>

      <QuotationLineItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        onSave={handleSaveItem}
        item={editingItem?.item || null}
        mode={editingItem ? "edit" : "add"}
      />
    </>
  );
}
