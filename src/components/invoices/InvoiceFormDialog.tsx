"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Calculator, Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useCreateInvoice, useUpdateInvoice } from "@/hooks/useInvoices";
import { useCustomers } from "@/hooks/useCustomers";
import { useWarehouses } from "@/hooks/useWarehouses";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrency } from "@/hooks/useCurrency";
import {
  createInvoiceFormSchema,
} from "@/lib/validations/invoice";
import type { Invoice } from "@/types/invoice";
import type { WarehouseLocation } from "@/types/inventory-location";
import { InvoiceLineItemDialog, type LineItemFormValues } from "./InvoiceLineItemDialog";

interface InvoiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: Invoice | null;
}

export function InvoiceFormDialog({ open, onOpenChange, invoice }: InvoiceFormDialogProps) {
  const t = useTranslations("invoiceForm");
  const isEditMode = !!invoice;
  const { formatCurrency } = useCurrency();
  const invoiceFormSchema = createInvoiceFormSchema((key) => t(key));
  type InvoiceFormInput = z.input<typeof invoiceFormSchema>;
  const createMutation = useCreateInvoice({
    success: t("createSuccess"),
    error: t("createError"),
  });
  const updateMutation = useUpdateInvoice({
    success: t("updateSuccess"),
    error: t("updateError"),
  });

  const { data: customersData } = useCustomers({ limit: 50 });
  const customers = customersData?.data || [];

  const { data: warehousesData } = useWarehouses({ limit: 50 });
  const warehouses = warehousesData?.data || [];

  const [lineItems, setLineItems] = useState<LineItemFormValues[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{ index: number; item: LineItemFormValues } | null>(null);

  const defaultValues = useMemo<InvoiceFormInput>(
    () => ({
      customerId: "",
      warehouseId: "",
      locationId: "",
      invoiceDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      terms: "Payment due within 30 days. Delivery within 2 weeks of order confirmation.",
      notes: "",
    }),
    []
  );

  const form = useForm<InvoiceFormInput>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues,
  });

  const selectedWarehouseId = form.watch("warehouseId");

  const { data: locationsData } = useQuery<{ data: WarehouseLocation[] }>({
    queryKey: ["warehouse-locations", selectedWarehouseId],
    queryFn: () => apiClient.get(`/api/warehouses/${selectedWarehouseId}/locations`),
    enabled: !!selectedWarehouseId,
  });

  const locations = useMemo(
    () => (locationsData?.data || []).filter((location) => location.isActive),
    [locationsData]
  );

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
    if (open && invoice) {
      form.reset({
        customerId: invoice.customerId,
        warehouseId: invoice.warehouseId || "",
        locationId: invoice.locationId || "",
        invoiceDate: invoice.invoiceDate.split("T")[0],
        dueDate: invoice.dueDate.split("T")[0],
        terms: invoice.paymentTerms || "",
        notes: invoice.notes || "",
      });
      setLineItems(
        invoice.lineItems.map((item) => ({
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          uomId: item.uomId,
          discount: item.discount,
          taxRate: item.taxRate,
          lineTotal: item.lineTotal,
        }))
      );
    } else if (open) {
      form.reset(defaultValues);
      setLineItems([]);
    }
  }, [open, invoice, form, defaultValues]);

  useEffect(() => {
    if (!selectedWarehouseId) {
      form.setValue("locationId", "");
    }
  }, [selectedWarehouseId, form]);

  const handleSaveItem = (item: LineItemFormValues) => {
    if (editingItem !== null) {
      setLineItems((items) => items.map((entry, index) => (index === editingItem.index ? item : entry)));
    } else {
      setLineItems((items) => [...items, item]);
    }
  };

  const onSubmit = async (data: InvoiceFormInput) => {
    if (lineItems.length === 0) {
      toast.error(t("addLineItemRequired"));
      return;
    }

    try {
      const parsed = invoiceFormSchema.parse(data);
      const apiRequest = {
        customerId: parsed.customerId,
        warehouseId: parsed.warehouseId,
        locationId: parsed.locationId || undefined,
        invoiceDate: parsed.invoiceDate,
        dueDate: parsed.dueDate,
        lineItems: lineItems.map((item) => ({
          itemId: item.itemId,
          itemCode: item.itemCode || "",
          itemName: item.itemName || "",
          description: item.description,
          quantity: item.quantity,
          uomId: item.uomId,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate,
          lineTotal: item.lineTotal,
        })),
        paymentTerms: parsed.terms,
        notes: parsed.notes,
      };

      if (isEditMode && invoice) {
        await updateMutation.mutateAsync({
          id: invoice.id,
          data: {
            customerId: apiRequest.customerId,
            warehouseId: apiRequest.warehouseId,
            locationId: apiRequest.locationId,
            invoiceDate: apiRequest.invoiceDate,
            dueDate: apiRequest.dueDate,
            lineItems: apiRequest.lineItems,
            paymentTerms: apiRequest.paymentTerms,
            notes: apiRequest.notes,
          },
        });
      } else {
        const selectedCustomer = customers.find((cust) => cust.id === apiRequest.customerId);
        if (!selectedCustomer) {
          toast.error(t("missingCustomerDetails"));
          return;
        }

        await createMutation.mutateAsync({
          ...apiRequest,
          companyId: selectedCustomer.companyId,
          billingAddress: selectedCustomer.billingAddress,
          billingCity: selectedCustomer.billingCity,
          billingState: selectedCustomer.billingState,
          billingPostalCode: selectedCustomer.billingPostalCode,
          billingCountry: selectedCustomer.billingCountry,
        });
      }
      onOpenChange(false);
    } catch {}
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditMode ? t("editTitle") : t("createTitle")}</DialogTitle>
            <DialogDescription>{isEditMode ? t("editDescription") : t("createDescription")}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="general">{t("generalTab")}</TabsTrigger>
                  <TabsTrigger value="items">{t("lineItemsTab", { count: lineItems.length })}</TabsTrigger>
                  <TabsTrigger value="terms">{t("termsTab")}</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="mt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("customer")} *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("selectCustomer")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customers.filter((customer) => customer.isActive).map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.code} - {customer.name}
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
                    name="warehouseId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("warehouseOptional")}</FormLabel>
                        <Select onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)} value={field.value || "__none__"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("selectWarehouse")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">{t("none")}</SelectItem>
                            {warehouses.filter((warehouse) => warehouse.isActive).map((warehouse) => (
                              <SelectItem key={warehouse.id} value={warehouse.id}>
                                {warehouse.code} - {warehouse.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">{t("warehouseHelp")}</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="locationId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("location")}</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}
                          value={field.value || "__none__"}
                          disabled={!selectedWarehouseId}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={selectedWarehouseId ? t("selectLocation") : t("selectWarehouseFirst")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">{t("none")}</SelectItem>
                            {locations.map((location) => (
                              <SelectItem key={location.id} value={location.id}>
                                {location.code} {location.name ? `- ${location.name}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="invoiceDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("invoiceDate")} *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("dueDate")} *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="items" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">{t("lineItemsTitle")}</h3>
                      <p className="text-sm text-muted-foreground">{t("lineItemsDescription")}</p>
                    </div>
                    <Button type="button" onClick={() => { setEditingItem(null); setItemDialogOpen(true); }} size="sm">
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
                              <TableHead>{t("item")}</TableHead>
                              <TableHead className="text-right">{t("qty")}</TableHead>
                              <TableHead className="text-center">{t("unit")}</TableHead>
                              <TableHead className="text-right">{t("price")}</TableHead>
                              <TableHead className="text-right">{t("discountPct")}</TableHead>
                              <TableHead className="text-right">{t("taxPct")}</TableHead>
                              <TableHead className="text-right">{t("total")}</TableHead>
                              <TableHead className="w-[100px]">{t("actions")}</TableHead>
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
                                    <span className="text-muted-foreground">{item.uomId || "—"}</span>
                                  </TableCell>
                                  <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                                  <TableCell className="text-right">{item.discount}%</TableCell>
                                  <TableCell className="text-right">{item.taxRate}%</TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(lineTotal)}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingItem({ index, item: lineItems[index] }); setItemDialogOpen(true); }}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button type="button" variant="ghost" size="sm" onClick={() => setLineItems((items) => items.filter((_, itemIndex) => itemIndex !== index))}>
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
                </TabsContent>

                <TabsContent value="terms" className="mt-4 space-y-4">
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
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending
                    ? t("saving")
                    : isEditMode
                      ? t("updateInvoice")
                      : t("createInvoice")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <InvoiceLineItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        onSave={handleSaveItem}
        item={editingItem?.item || null}
        mode={editingItem ? "edit" : "add"}
      />
    </>
  );
}
