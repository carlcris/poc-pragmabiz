"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Calculator, TriangleAlert } from "lucide-react";
import { z } from "zod";
import { useCreateSalesOrder, useUpdateSalesOrder } from "@/hooks/useSalesOrders";
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
import { DataTableSkeletonRows } from "@/components/shared/DataTableSkeletonRows";
import { useCurrency } from "@/hooks/useCurrency";
import { quotationsApi, type AvailableQuotationLine } from "@/lib/api/quotations";
import type { SalesOrder } from "@/types/sales-order";
import type { CreateSalesOrderRequest } from "@/types/sales-order";
import {
  QuotationLineItemDialog,
  type LineItemFormValues,
} from "../quotations/QuotationLineItemDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const salesOrderFormSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  orderDate: z.string().min(1, "Order date is required"),
  expectedDeliveryDate: z.string().min(1, "Expected delivery date is required"),
  shippingAddress: z.string().default(""),
  shippingCity: z.string().default(""),
  shippingState: z.string().default(""),
  shippingPostalCode: z.string().default(""),
  shippingCountry: z.string().default(""),
  paymentTerms: z.string().default(""),
  notes: z.string().default(""),
});

type SalesOrderFormInput = z.input<typeof salesOrderFormSchema>;

type SalesOrderFormProps = {
  salesOrder?: SalesOrder | null;
  initialValues?: SalesOrderFormInitialValues;
  onCancel?: () => void;
  onSuccess?: (salesOrder: SalesOrder) => void;
  submitLabel?: string;
};

export type SalesOrderFormInitialValues = Partial<SalesOrderFormInput> & {
  lineItems?: SalesOrder["lineItems"];
  lockCustomer?: boolean;
};

const mapSalesOrderLineItemToFormValues = (item: SalesOrder["lineItems"][number]) => ({
  itemId: item.itemId,
  itemCode: item.itemCode,
  itemName: item.itemName,
  quotationId: item.quotationId,
  quotationNumber: item.quotationNumber,
  quotationItemId: item.quotationItemId,
  quotationRemainingQuantity: item.quotationRemainingQuantity,
  description: item.description,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  uomId: item.uomId,
  uomCode: item.uomCode,
  uomName: item.uomName,
  discount: item.discount,
  taxRate: item.taxRate,
  available: item.available,
  reorderPoint: item.reorderPoint,
  skipInventory: item.skipInventory,
  frameConfiguration: item.frameConfiguration,
  frameComponents: item.frameComponents,
});

export function SalesOrderForm({
  salesOrder,
  initialValues,
  onCancel,
  onSuccess,
  submitLabel,
}: SalesOrderFormProps) {
  const t = useTranslations("salesOrderForm");
  const tCommon = useTranslations("common");
  const isEditMode = !!salesOrder;
  const { formatCurrency } = useCurrency();
  const createMutation = useCreateSalesOrder();
  const updateMutation = useUpdateSalesOrder();
  const [customerSearch, setCustomerSearch] = useState("");
  const debouncedCustomerSearch = useDebouncedValue(customerSearch.trim());

  const { data: customersData, isLoading: isCustomersLoading } = useCustomers({
    search: debouncedCustomerSearch || undefined,
    isActive: true,
    limit: 5,
  });
  const customers = customersData?.data || [];

  const [lineItems, setLineItems] = useState<LineItemFormValues[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [quotationLinesOpen, setQuotationLinesOpen] = useState(false);
  const [quotationLineSearch, setQuotationLineSearch] = useState("");
  const debouncedQuotationLineSearch = useDebouncedValue(quotationLineSearch.trim());
  const [quotationLinePage, setQuotationLinePage] = useState(1);
  const [quotationLines, setQuotationLines] = useState<AvailableQuotationLine[]>([]);
  const [quotationLinesHasMore, setQuotationLinesHasMore] = useState(false);
  const [quotationLinesLoading, setQuotationLinesLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    index: number | null;
    item: LineItemFormValues;
  } | null>(null);

  const defaultValues = useMemo<SalesOrderFormInput>(
    () => ({
      customerId: initialValues?.customerId || "",
      orderDate: new Date().toISOString().split("T")[0],
      expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      shippingAddress: initialValues?.shippingAddress || "",
      shippingCity: initialValues?.shippingCity || "",
      shippingState: initialValues?.shippingState || "",
      shippingPostalCode: initialValues?.shippingPostalCode || "",
      shippingCountry: initialValues?.shippingCountry || "",
      paymentTerms: initialValues?.paymentTerms || "Payment due within 30 days",
      notes: initialValues?.notes || "",
    }),
    [initialValues]
  );

  const form = useForm<SalesOrderFormInput>({
    resolver: zodResolver(salesOrderFormSchema),
    defaultValues,
  });
  const selectedCustomerId = form.watch("customerId");
  const { data: selectedCustomerData } = useCustomer(selectedCustomerId);
  const selectedCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) ??
    selectedCustomerData ??
    null;
  const isCustomerLocked = !isEditMode && !!initialValues?.lockCustomer;

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce(
      (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
      0
    );
    const totalDiscount = lineItems.reduce((sum, item) => {
      const itemSubtotal = (item.quantity || 0) * (item.unitPrice || 0);
      return sum + (itemSubtotal * (item.discount || 0)) / 100;
    }, 0);
    const totalTax = lineItems.reduce((sum, item) => {
      const itemSubtotal = (item.quantity || 0) * (item.unitPrice || 0);
      const itemDiscount = (itemSubtotal * (item.discount || 0)) / 100;
      const taxableAmount = itemSubtotal - itemDiscount;
      return sum + (taxableAmount * (item.taxRate || 0)) / 100;
    }, 0);
    const totalAmount = subtotal - totalDiscount + totalTax;

    return { subtotal, totalDiscount, totalTax, totalAmount };
  }, [lineItems]);

  useEffect(() => {
    if (salesOrder) {
      form.reset({
        customerId: salesOrder.customerId,
        orderDate: salesOrder.orderDate.split("T")[0],
        expectedDeliveryDate: salesOrder.expectedDeliveryDate.split("T")[0],
        shippingAddress: salesOrder.shippingAddress,
        shippingCity: salesOrder.shippingCity,
        shippingState: salesOrder.shippingState,
        shippingPostalCode: salesOrder.shippingPostalCode,
        shippingCountry: salesOrder.shippingCountry,
        paymentTerms: salesOrder.paymentTerms,
        notes: salesOrder.notes,
      });
      setLineItems(salesOrder.lineItems.map(mapSalesOrderLineItemToFormValues));
      return;
    }

    form.reset(defaultValues);
    setLineItems((initialValues?.lineItems || []).map(mapSalesOrderLineItemToFormValues));
  }, [salesOrder, form, defaultValues, initialValues?.lineItems]);

  const handleAddItem = () => {
    setEditingItem(null);
    setItemDialogOpen(true);
  };

  const handleOpenQuotationLines = () => {
    setQuotationLinePage(1);
    setQuotationLinesOpen(true);
  };

  const handleEditItem = (index: number) => {
    setEditingItem({ index, item: lineItems[index] });
    setItemDialogOpen(true);
  };

  const handleDeleteItem = (index: number) => {
    setLineItems((items) => items.filter((_, i) => i !== index));
  };

  const handleSaveItem = (item: LineItemFormValues) => {
    setLineItems((items) => {
      if (editingItem?.index !== null && editingItem?.index !== undefined) {
        return items.map((it, i) => (i === editingItem.index ? item : it));
      }

      const existingQuotationLineIndex = item.quotationItemId
        ? items.findIndex((current) => current.quotationItemId === item.quotationItemId)
        : -1;

      if (existingQuotationLineIndex >= 0) {
        return items.map((current, index) =>
          index === existingQuotationLineIndex ? item : current
        );
      }

      return [...items, item];
    });
  };

  const handleSelectQuotationLine = (line: AvailableQuotationLine) => {
    const nextLine = mapQuotationLineToSalesOrderLine(line);
    const existingIndex = lineItems.findIndex(
      (item) => item.quotationItemId === line.quotationItemId
    );

    setEditingItem({ index: existingIndex >= 0 ? existingIndex : null, item: nextLine });
    setQuotationLinesOpen(false);
    setItemDialogOpen(true);
  };

  const mapQuotationLineToSalesOrderLine = (
    line: AvailableQuotationLine,
    quantity = line.quotationRemainingQuantity || line.quantity
  ): LineItemFormValues => ({
    itemId: line.itemId,
    itemCode: line.itemCode,
    itemName: line.itemName,
    quotationId: line.quotationId,
    quotationNumber: line.quotationNumber,
    quotationItemId: line.quotationItemId,
    quotationRemainingQuantity: line.quotationRemainingQuantity,
    description: line.description,
    quantity,
    unitPrice: line.unitPrice,
    uomId: line.uomId,
    uomCode: line.uomCode,
    uomName: line.uomName,
    discount: line.discount,
    taxRate: line.taxRate,
    lineTotal: line.lineTotal,
    skipInventory: !!line.frameConfiguration,
    frameConfiguration: line.frameConfiguration,
    frameComponents: line.frameComponents,
  });

  useEffect(() => {
    if (!quotationLinesOpen || !selectedCustomerId) {
      setQuotationLines([]);
      return;
    }

    let isActive = true;
    setQuotationLinesLoading(true);
    quotationsApi
      .getAvailableLines({
        customerId: selectedCustomerId,
        search: debouncedQuotationLineSearch || undefined,
        page: quotationLinePage,
        limit: 10,
      })
      .then((response) => {
        if (!isActive) return;
        setQuotationLines(response.data);
        setQuotationLinesHasMore(response.pagination.hasMore);
      })
      .catch(() => {
        if (!isActive) return;
        setQuotationLines([]);
        setQuotationLinesHasMore(false);
      })
      .finally(() => {
        if (isActive) setQuotationLinesLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [quotationLinesOpen, selectedCustomerId, debouncedQuotationLineSearch, quotationLinePage]);

  const onSubmit = async (data: SalesOrderFormInput) => {
    if (lineItems.length === 0) {
      alert(t("addLineItemRequired"));
      return;
    }

    try {
      const parsed = salesOrderFormSchema.parse(data);
      const apiRequest: CreateSalesOrderRequest = {
        customerId: parsed.customerId,
        orderDate: parsed.orderDate,
        expectedDeliveryDate: parsed.expectedDeliveryDate,
        lineItems: lineItems.map((item) => ({
          itemId: item.itemId,
          itemCode: item.itemCode || "",
          itemName: item.itemName || "",
          quotationId: item.quotationId || null,
          quotationNumber: item.quotationNumber,
          quotationItemId: item.quotationItemId || null,
          quotationRemainingQuantity: item.quotationRemainingQuantity,
          description: item.description,
          quantity: item.quantity,
          uomId: item.uomId,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate,
          skipInventory: item.skipInventory ?? !!item.frameConfiguration,
          frameConfiguration: item.frameConfiguration,
          frameComponents: item.frameComponents,
        })),
        shippingAddress: parsed.shippingAddress,
        shippingCity: parsed.shippingCity,
        shippingState: parsed.shippingState,
        shippingPostalCode: parsed.shippingPostalCode,
        shippingCountry: parsed.shippingCountry,
        paymentTerms: parsed.paymentTerms,
        notes: parsed.notes,
      };

      const result =
        isEditMode && salesOrder
          ? await updateMutation.mutateAsync({
              id: salesOrder.id,
              data: apiRequest,
            })
          : await createMutation.mutateAsync(apiRequest);

      onSuccess?.(result);
    } catch {}
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="rounded-lg border bg-card">
            <div className="border-b bg-muted/40 px-6 py-4">
              <h3 className="text-lg font-semibold">{t("generalTab")}</h3>
              <p className="text-sm text-muted-foreground">Basic order information</p>
            </div>
            <div className="space-y-6 p-6">
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
                        placeholder={t("searchCustomer")}
                        searchPlaceholder={t("customerSearchPlaceholder")}
                        emptyMessage={t("noCustomerFound")}
                        isLoading={isCustomersLoading}
                        disabled={isCustomerLocked}
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

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="orderDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("orderDate")} *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expectedDeliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("expectedDelivery")} *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b bg-muted/40 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold">{t("lineItemsTitle")}</h3>
                <p className="text-sm text-muted-foreground">{t("lineItemsDescription")}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenQuotationLines}
                  size="sm"
                  disabled={!selectedCustomerId}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add from Quotation
                </Button>
                <Button type="button" onClick={handleAddItem} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Inventory Item
                </Button>
              </div>
            </div>

            <div className="p-6">
              {lineItems.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed py-16 text-center text-muted-foreground">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Plus className="h-6 w-6" />
                  </div>
                  <p className="mt-4 font-medium">{t("noItems")}</p>
                  <p className="mt-1 text-sm">{t("noItemsDescription")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>{tCommon("item")}</TableHead>
                          <TableHead className="text-right">{t("qty")}</TableHead>
                          <TableHead className="text-center">{t("unit")}</TableHead>
                          <TableHead className="text-right">{t("price")}</TableHead>
                          <TableHead className="text-right">{t("discountPct")}</TableHead>
                          <TableHead className="text-right">{t("taxPct")}</TableHead>
                          <TableHead className="text-right">{t("total")}</TableHead>
                          <TableHead className="w-[100px] text-center">
                            {tCommon("actions")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.map((item, index) => {
                          const itemSubtotal = item.quantity * item.unitPrice;
                          const discountAmount = (itemSubtotal * item.discount) / 100;
                          const taxableAmount = itemSubtotal - discountAmount;
                          const taxAmount = (taxableAmount * item.taxRate) / 100;
                          const lineTotal = taxableAmount + taxAmount;

                          return (
                            <TableRow key={index}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{item.itemName}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {item.itemCode}
                                  </div>
                                  {item.quotationNumber ? (
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      From quotation {item.quotationNumber}
                                    </div>
                                  ) : null}
                                  {!item.skipInventory &&
                                  typeof item.available === "number" &&
                                  item.quantity > item.available ? (
                                    <div className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                                      <TriangleAlert className="h-3.5 w-3.5" />
                                      <span>{t("inventoryWarning")}</span>
                                    </div>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-center">
                                <span className="text-muted-foreground">
                                  {item.uomCode || item.uomName || item.uomId || "—"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.unitPrice)}
                              </TableCell>
                              <TableCell className="text-right">{item.discount}%</TableCell>
                              <TableCell className="text-right">{item.taxRate}%</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(lineTotal)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleEditItem(index)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
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

                  <div className="flex justify-end">
                    <div className="w-full max-w-sm space-y-3 rounded-lg border bg-muted/30 p-5">
                      <div className="mb-3 flex items-center gap-2 border-b pb-3">
                        <Calculator className="h-5 w-5" />
                        <h4 className="font-semibold">{t("totals")}</h4>
                      </div>
                      <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("subtotal")}:</span>
                          <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-red-600">
                          <span>{t("discount")}:</span>
                          <span className="font-medium">
                            -{formatCurrency(totals.totalDiscount)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("tax")}:</span>
                          <span className="font-medium">{formatCurrency(totals.totalTax)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-3 text-base font-bold">
                          <span>{t("total")}:</span>
                          <span className="text-lg">{formatCurrency(totals.totalAmount)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border bg-card">
              <div className="border-b bg-muted/40 px-6 py-4">
                <h3 className="text-lg font-semibold">{t("shippingTab")}</h3>
                <p className="text-sm text-muted-foreground">Delivery address details</p>
              </div>
              <div className="space-y-4 p-6">
                <FormField
                  control={form.control}
                  name="shippingAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("address")}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t("addressPlaceholder")} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="shippingCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("city")}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t("cityPlaceholder")} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="shippingState"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("stateProvince")}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t("statePlaceholder")} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="shippingPostalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("postalCode")}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t("postalCodePlaceholder")} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="shippingCountry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("country")}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t("countryPlaceholder")} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card">
              <div className="border-b bg-muted/40 px-6 py-4">
                <h3 className="text-lg font-semibold">{t("termsTab")}</h3>
                <p className="text-sm text-muted-foreground">Payment and additional notes</p>
              </div>
              <div className="space-y-4 p-6">
                <FormField
                  control={form.control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("paymentTerms")}</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} className="resize-none" />
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
                        <Textarea {...field} rows={4} className="resize-none" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 rounded-lg border bg-card p-4">
            {onCancel ? (
              <Button type="button" variant="outline" onClick={onCancel}>
                {tCommon("cancel")}
              </Button>
            ) : null}
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending
                ? t("saving")
                : submitLabel || (isEditMode ? t("updateOrder") : t("createOrder"))}
            </Button>
          </div>
        </form>
      </Form>

      <QuotationLineItemDialog
        open={itemDialogOpen}
        onOpenChange={(open) => {
          setItemDialogOpen(open);
          if (!open) setEditingItem(null);
        }}
        onSave={handleSaveItem}
        item={editingItem?.item || null}
        mode={editingItem?.index === null ? "add" : editingItem ? "edit" : "add"}
      />

      <Dialog
        open={quotationLinesOpen}
        onOpenChange={setQuotationLinesOpen}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Add from customer quotations</DialogTitle>
            <DialogDescription>
              Select accepted or partially ordered quotation lines for this customer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={quotationLineSearch}
              onChange={(event) => {
                setQuotationLineSearch(event.target.value);
                setQuotationLinePage(1);
              }}
              placeholder="Search quotation number, item code, or item name..."
            />
            <div className="max-h-[420px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quotation</TableHead>
                    <TableHead>{tCommon("item")}</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">{t("price")}</TableHead>
                    <TableHead className="w-[100px] text-right">{tCommon("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotationLinesLoading ? (
                    <DataTableSkeletonRows
                      rowCount={5}
                      columnWidths={["w-28", "w-52", "w-20", "w-20", "w-16"]}
                      rightAlignedColumns={[2, 3, 4]}
                      actionColumnIndex={4}
                    />
                  ) : quotationLines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No available quotation lines found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    quotationLines.map((line) => (
                      <TableRow key={line.quotationItemId}>
                        <TableCell className="font-medium">{line.quotationNumber}</TableCell>
                        <TableCell>
                          <div className="font-medium">{line.itemName}</div>
                          <div className="text-xs text-muted-foreground">{line.itemCode}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          {line.quotationRemainingQuantity} {line.uomCode || line.uomName}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(line.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleSelectQuotationLine(line)}
                          >
                            Add
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={quotationLinePage <= 1 || quotationLinesLoading}
                onClick={() => setQuotationLinePage((page) => Math.max(1, page - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {quotationLinePage}</span>
              <Button
                type="button"
                variant="outline"
                disabled={!quotationLinesHasMore || quotationLinesLoading}
                onClick={() => setQuotationLinePage((page) => page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
