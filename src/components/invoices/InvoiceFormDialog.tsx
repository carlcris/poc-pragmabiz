"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Calculator } from "lucide-react";
import { z } from "zod";
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
import type { Invoice } from "@/types/invoice";
import type { WarehouseLocation } from "@/types/inventory-location";
import { InvoiceLineItemDialog, type LineItemFormValues } from "./InvoiceLineItemDialog";

const invoiceFormSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  warehouseId: z.string().optional(),
  locationId: z.string().optional(),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  dueDate: z.string().min(1, "Valid until date is required"),
  terms: z.string().default(""),
  notes: z.string().default(""),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

interface InvoiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: Invoice | null;
}

export function InvoiceFormDialog({ open, onOpenChange, invoice }: InvoiceFormDialogProps) {
  const isEditMode = !!invoice;
  const { formatCurrency } = useCurrency();
  const createMutation = useCreateInvoice();
  const updateMutation = useUpdateInvoice();

  const { data: customersData } = useCustomers({ limit: 1000 });
  const customers = customersData?.data || [];

  const { data: warehousesData } = useWarehouses({ limit: 1000 });
  const warehouses = warehousesData?.data || [];

  // Line items state
  const [lineItems, setLineItems] = useState<LineItemFormValues[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    index: number;
    item: LineItemFormValues;
  } | null>(null);

  // Default values
  const defaultValues = useMemo<InvoiceFormValues>(
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

  const form = useForm<InvoiceFormValues>({
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

  // Calculate totals
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

  // Reset form when dialog opens/closes or invoice changes
  useEffect(() => {
    if (open && invoice) {
      form.reset({
        companyId: invoice.companyId,
        customerId: invoice.customerId,
        warehouseId: invoice.warehouseId || "",
        locationId: invoice.locationId || "",
        invoiceDate: invoice.invoiceDate.split("T")[0],
        dueDate: invoice.dueDate.split("T")[0],
        terms: invoice.paymentTerms || "",
        notes: invoice.notes || "",
      });
      // Convert invoice line items to form format
      const formLineItems: LineItemFormValues[] = invoice.lineItems.map((item) => ({
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        description: item.description,
        quantity: item.quantity,
        packagingId: item.packagingId ?? null,
        packagingName: item.packaging?.name,
        unitPrice: item.unitPrice,
        uomId: item.uomId,
        discount: item.discount,
        taxRate: item.taxRate,
        lineTotal: item.lineTotal,
      }));
      setLineItems(formLineItems);
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

  const handleAddItem = () => {
    setEditingItem(null);
    setItemDialogOpen(true);
  };

  const handleEditItem = (index: number) => {
    setEditingItem({ index, item: lineItems[index] });
    setItemDialogOpen(true);
  };

  const handleDeleteItem = (index: number) => {
    setLineItems((items) => items.filter((_, i) => i !== index));
  };

  const handleSaveItem = (item: LineItemFormValues) => {
    if (editingItem !== null) {
      // Update existing item
      setLineItems((items) => items.map((it, i) => (i === editingItem.index ? item : it)));
    } else {
      // Add new item
      setLineItems((items) => [...items, item]);
    }
  };

  const onSubmit = async (data: InvoiceFormValues) => {
    if (lineItems.length === 0) {
      alert("Please add at least one line item");
      return;
    }

    try {
      // Transform form data to API request format
      const apiRequest = {
        customerId: data.customerId,
        warehouseId: data.warehouseId,
        locationId: data.locationId || undefined,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate,
        lineItems: lineItems.map((item) => ({
          itemId: item.itemId,
          description: item.description,
          quantity: item.quantity,
          packagingId: item.packagingId ?? null,
          uomId: item.uomId,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate,
          lineTotal: item.lineTotal,
        })),
        paymentTerms: data.terms,
        notes: data.notes,
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
        await createMutation.mutateAsync(apiRequest);
      }
      onOpenChange(false);
    } catch {}
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit Invoice" : "Create New Invoice"}</DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Update invoice details and line items."
                : "Fill in the invoice details and add line items."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="items">Line Items ({lineItems.length})</TabsTrigger>
                  <TabsTrigger value="terms">Terms & Notes</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="mt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a customer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customers
                              .filter((c) => c.isActive)
                              .map((customer) => (
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
                        <FormLabel>Warehouse (Optional)</FormLabel>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(value === "__none__" ? "" : value)
                          }
                          value={field.value || "__none__"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a warehouse (for stock validation)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {warehouses
                              .filter((w) => w.isActive)
                              .map((warehouse) => (
                                <SelectItem key={warehouse.id} value={warehouse.id}>
                                  {warehouse.code} - {warehouse.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                          Select a warehouse to validate and deduct stock when sending
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="locationId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(value === "__none__" ? "" : value)
                          }
                          value={field.value || "__none__"}
                          disabled={!selectedWarehouseId}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  selectedWarehouseId
                                    ? "Select a location (optional)"
                                    : "Select warehouse first"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
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
                          <FormLabel>Invoice Date *</FormLabel>
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
                          <FormLabel>Valid Until *</FormLabel>
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
                      <h3 className="text-lg font-medium">Line Items</h3>
                      <p className="text-sm text-muted-foreground">
                        Manage products or services in this invoice
                      </p>
                    </div>
                    <Button type="button" onClick={handleAddItem} size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Item
                    </Button>
                  </div>

                  {lineItems.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed py-12 text-center text-muted-foreground">
                      <p>No items added yet.</p>
                      <p className="text-sm">Click &quot;Add Item&quot; to get started.</p>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead className="text-center">Unit</TableHead>
                              <TableHead className="text-right">Price</TableHead>
                              <TableHead className="text-right">Disc %</TableHead>
                              <TableHead className="text-right">Tax %</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead className="w-[100px]">Actions</TableHead>
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
                                      <div className="text-sm text-muted-foreground">
                                        {item.itemCode}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">{item.quantity}</TableCell>
                                  <TableCell className="text-center">
                                    <span className="text-muted-foreground">
                                      {item.packagingName || "—"}
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

                      {/* Totals Section */}
                      <div className="rounded-lg bg-muted p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Calculator className="h-5 w-5" />
                          <h4 className="font-semibold">Totals</h4>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-red-600">
                            <span>Discount:</span>
                            <span className="font-medium">
                              -{formatCurrency(totals.totalDiscount)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tax:</span>
                            <span className="font-medium">{formatCurrency(totals.totalTax)}</span>
                          </div>
                          <div className="flex justify-between border-t pt-2 text-lg font-bold">
                            <span>Total:</span>
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
                        <FormLabel>Terms & Conditions</FormLabel>
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
                        <FormLabel>Internal Notes</FormLabel>
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
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : isEditMode
                      ? "Update Invoice"
                      : "Create Invoice"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Line Item Dialog */}
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
