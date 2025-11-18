"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useCreateInvoice, useUpdateInvoice } from "@/hooks/useInvoices";
import { useCustomers } from "@/hooks/useCustomers";
import { useItems } from "@/hooks/useItems";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invoiceFormSchema, type InvoiceFormValues } from "@/lib/validations/invoice";
import { useCurrency } from "@/hooks/useCurrency";
import type { Invoice } from "@/types/invoice";

interface InvoiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: Invoice | null;
}

export function InvoiceFormDialog({ open, onOpenChange, invoice }: InvoiceFormDialogProps) {
  const isEditing = !!invoice;
  const { formatCurrency } = useCurrency();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const { data: customersData } = useCustomers({ limit: 1000 });
  const { data: itemsData } = useItems({ limit: 1000 });
  const customers = customersData?.data || [];
  const items = itemsData?.data || [];

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      companyId: "company-1",
      customerId: "",
      salesOrderId: "",
      invoiceDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      lineItems: [],
      billingAddress: "",
      billingCity: "",
      billingState: "",
      billingPostalCode: "",
      billingCountry: "USA",
      paymentTerms: "net_30",
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  const lineItems = watch("lineItems");
  const customerId = watch("customerId");

  // Auto-fill billing address when customer is selected
  useEffect(() => {
    if (customerId) {
      const customer = customers.find((c) => c.id === customerId);
      if (customer) {
        setValue("billingAddress", customer.billingAddress);
        setValue("billingCity", customer.billingCity);
        setValue("billingState", customer.billingState);
        setValue("billingPostalCode", customer.billingPostalCode);
        setValue("billingCountry", customer.billingCountry);
      }
    }
  }, [customerId, customers, setValue]);

  // Load invoice data when editing
  useEffect(() => {
    if (invoice && open) {
      reset({
        companyId: invoice.companyId,
        customerId: invoice.customerId,
        salesOrderId: invoice.salesOrderId || "",
        invoiceDate: invoice.invoiceDate.split("T")[0],
        dueDate: invoice.dueDate.split("T")[0],
        lineItems: invoice.lineItems.map((item) => ({
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate,
        })),
        billingAddress: invoice.billingAddress,
        billingCity: invoice.billingCity,
        billingState: invoice.billingState,
        billingPostalCode: invoice.billingPostalCode,
        billingCountry: invoice.billingCountry,
        paymentTerms: invoice.paymentTerms,
        notes: invoice.notes,
      });
    } else if (!invoice && open) {
      reset({
        companyId: "company-1",
        customerId: "",
        salesOrderId: "",
        invoiceDate: new Date().toISOString().split("T")[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        lineItems: [],
        billingAddress: "",
        billingCity: "",
        billingState: "",
        billingPostalCode: "",
        billingCountry: "USA",
        paymentTerms: "net_30",
        notes: "",
      });
    }
  }, [invoice, open, reset]);

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);
    const totalDiscount = lineItems.reduce(
      (sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0) * (item.discount || 0)) / 100,
      0
    );
    const totalTax = lineItems.reduce((sum, item) => {
      const itemSubtotal = (item.quantity || 0) * (item.unitPrice || 0);
      const itemDiscount = (itemSubtotal * (item.discount || 0)) / 100;
      const taxableAmount = itemSubtotal - itemDiscount;
      return sum + (taxableAmount * (item.taxRate || 0)) / 100;
    }, 0);
    const totalAmount = subtotal - totalDiscount + totalTax;

    return { subtotal, totalDiscount, totalTax, totalAmount };
  }, [lineItems]);

  const onSubmit = async (data: InvoiceFormValues) => {
    try {
      if (isEditing && invoice) {
        await updateInvoice.mutateAsync({
          id: invoice.id,
          data,
        });
      } else {
        await createInvoice.mutateAsync(data);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save invoice:", error);
    }
  };

  const handleAddLineItem = () => {
    append({
      itemId: "",
      itemCode: "",
      itemName: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      taxRate: 8,
    });
  };

  const handleItemSelect = (index: number, itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (item) {
      setValue(`lineItems.${index}.itemId`, item.id);
      setValue(`lineItems.${index}.itemCode`, item.itemCode);
      setValue(`lineItems.${index}.itemName`, item.itemName);
      setValue(`lineItems.${index}.description`, item.description);
      setValue(`lineItems.${index}.unitPrice`, item.salesPrice);
      setValue(`lineItems.${index}.taxRate`, item.taxRate || 8);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Invoice" : "Create New Invoice"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update invoice information" : "Fill in the details to create a new invoice"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="items">Line Items</TabsTrigger>
              <TabsTrigger value="billing">Billing & Terms</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerId">
                    Customer <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={watch("customerId")}
                    onValueChange={(value) => setValue("customerId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.customerId && (
                    <p className="text-sm text-red-500">{errors.customerId.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salesOrderId">Sales Order (Optional)</Label>
                  <Input id="salesOrderId" {...register("salesOrderId")} placeholder="SO-2024-001" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoiceDate">
                    Invoice Date <span className="text-red-500">*</span>
                  </Label>
                  <Input id="invoiceDate" type="date" {...register("invoiceDate")} />
                  {errors.invoiceDate && (
                    <p className="text-sm text-red-500">{errors.invoiceDate.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate">
                    Due Date <span className="text-red-500">*</span>
                  </Label>
                  <Input id="dueDate" type="date" {...register("dueDate")} />
                  {errors.dueDate && (
                    <p className="text-sm text-red-500">{errors.dueDate.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentTerms">Payment Terms</Label>
                  <Select
                    value={watch("paymentTerms")}
                    onValueChange={(value) => setValue("paymentTerms", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment terms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="net_15">Net 15</SelectItem>
                      <SelectItem value="net_30">Net 30</SelectItem>
                      <SelectItem value="net_60">Net 60</SelectItem>
                      <SelectItem value="net_90">Net 90</SelectItem>
                      <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="items" className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Line Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddLineItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>

              {fields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-md">
                  No line items. Click "Add Item" to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-md space-y-3">
                      <div className="flex justify-between items-start">
                        <Label>Item {index + 1}</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2 col-span-2">
                          <Label>Select Item</Label>
                          <Select
                            value={watch(`lineItems.${index}.itemId`)}
                            onValueChange={(value) => handleItemSelect(index, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select item" />
                            </SelectTrigger>
                            <SelectContent>
                              {items.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.itemCode} - {item.itemName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            step="0.01"
                            {...register(`lineItems.${index}.quantity`, { valueAsNumber: true })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Unit Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            {...register(`lineItems.${index}.unitPrice`, { valueAsNumber: true })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Discount (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            {...register(`lineItems.${index}.discount`, { valueAsNumber: true })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Tax Rate (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            {...register(`lineItems.${index}.taxRate`, { valueAsNumber: true })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Discount:</span>
                  <span className="font-medium text-red-600">-{formatCurrency(totals.totalDiscount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax:</span>
                  <span className="font-medium">{formatCurrency(totals.totalTax)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(totals.totalAmount)}</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="billing" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="billingAddress">
                    Billing Address <span className="text-red-500">*</span>
                  </Label>
                  <Input id="billingAddress" {...register("billingAddress")} />
                  {errors.billingAddress && (
                    <p className="text-sm text-red-500">{errors.billingAddress.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billingCity">
                    City <span className="text-red-500">*</span>
                  </Label>
                  <Input id="billingCity" {...register("billingCity")} />
                  {errors.billingCity && (
                    <p className="text-sm text-red-500">{errors.billingCity.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billingState">
                    State <span className="text-red-500">*</span>
                  </Label>
                  <Input id="billingState" {...register("billingState")} />
                  {errors.billingState && (
                    <p className="text-sm text-red-500">{errors.billingState.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billingPostalCode">
                    Postal Code <span className="text-red-500">*</span>
                  </Label>
                  <Input id="billingPostalCode" {...register("billingPostalCode")} />
                  {errors.billingPostalCode && (
                    <p className="text-sm text-red-500">{errors.billingPostalCode.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billingCountry">
                    Country <span className="text-red-500">*</span>
                  </Label>
                  <Input id="billingCountry" {...register("billingCountry")} />
                  {errors.billingCountry && (
                    <p className="text-sm text-red-500">{errors.billingCountry.message}</p>
                  )}
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input id="notes" {...register("notes")} placeholder="Additional notes or terms..." />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createInvoice.isPending || updateInvoice.isPending}>
              {createInvoice.isPending || updateInvoice.isPending
                ? "Saving..."
                : isEditing
                ? "Update Invoice"
                : "Create Invoice"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
