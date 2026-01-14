"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Calculator } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import {
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
} from "@/hooks/usePurchaseOrders";
import { useSuppliers } from "@/hooks/useSuppliers";
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
import type { PurchaseOrder } from "@/types/purchase-order";
import {
  PurchaseOrderLineItemDialog,
  type PurchaseOrderLineItemFormValues,
} from "./PurchaseOrderLineItemDialog";

const purchaseOrderFormSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  orderDate: z.string().min(1, "Order date is required"),
  expectedDeliveryDate: z.string().min(1, "Expected delivery date is required"),
  deliveryAddress: z.string().min(1, "Delivery address is required"),
  deliveryCity: z.string().min(1, "City is required"),
  deliveryState: z.string().min(1, "State is required"),
  deliveryCountry: z.string().min(1, "Country is required"),
  deliveryPostalCode: z.string().min(1, "Postal code is required"),
  notes: z.string().optional(),
});

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderFormSchema>;

interface PurchaseOrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder?: PurchaseOrder | null;
  initialLineItems?: PurchaseOrderLineItemFormValues[];
  initialActiveTab?: "general" | "items" | "terms";
}

export function PurchaseOrderFormDialog({
  open,
  onOpenChange,
  purchaseOrder,
  initialLineItems,
  initialActiveTab,
}: PurchaseOrderFormDialogProps) {
  const isEditMode = !!purchaseOrder;
  const { formatCurrency } = useCurrency();
  const createMutation = useCreatePurchaseOrder();
  const updateMutation = useUpdatePurchaseOrder();

  const { data: suppliersData } = useSuppliers({ limit: 1000 });
  const suppliers = suppliersData?.data || [];

  // Line items state
  const [lineItems, setLineItems] = useState<
    PurchaseOrderLineItemFormValues[]
  >([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    index: number;
    item: PurchaseOrderLineItemFormValues;
  } | null>(null);
  const [activeTab, setActiveTab] = useState("general");

  // Default values
  const defaultValues = useMemo<PurchaseOrderFormValues>(
    () => ({
      supplierId: "",
      orderDate: new Date().toISOString().split("T")[0],
      expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      deliveryAddress: "",
      deliveryCity: "",
      deliveryState: "",
      deliveryCountry: "Philippines",
      deliveryPostalCode: "",
      notes: "",
    }),
    []
  );

  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues,
  });

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => {
      const lineTotal = item.lineTotal ?? (item.quantity || 0) * (item.rate || 0);
      const discountRate = (item.discountPercent || 0) / 100;
      const taxRate = (item.taxPercent || 0) / 100;
      const denominator = (1 - discountRate) * (1 + taxRate);
      const itemSubtotal = denominator > 0 ? lineTotal / denominator : 0;
      return sum + itemSubtotal;
    }, 0);
    const totalDiscount = lineItems.reduce((sum, item) => {
      const lineTotal = item.lineTotal ?? (item.quantity || 0) * (item.rate || 0);
      const discountRate = (item.discountPercent || 0) / 100;
      const taxRate = (item.taxPercent || 0) / 100;
      const denominator = (1 - discountRate) * (1 + taxRate);
      const itemSubtotal = denominator > 0 ? lineTotal / denominator : 0;
      return sum + itemSubtotal * discountRate;
    }, 0);
    const totalTax = lineItems.reduce((sum, item) => {
      const lineTotal = item.lineTotal ?? (item.quantity || 0) * (item.rate || 0);
      const discountRate = (item.discountPercent || 0) / 100;
      const taxRate = (item.taxPercent || 0) / 100;
      const denominator = (1 - discountRate) * (1 + taxRate);
      const itemSubtotal = denominator > 0 ? lineTotal / denominator : 0;
      const taxableAmount = itemSubtotal * (1 - discountRate);
      return sum + taxableAmount * taxRate;
    }, 0);
    const totalAmount = subtotal - totalDiscount + totalTax;

    return { subtotal, totalDiscount, totalTax, totalAmount };
  }, [lineItems]);

  // Reset form when dialog opens/closes or purchase order changes
  useEffect(() => {
    if (open && purchaseOrder) {
      form.reset({
        supplierId: purchaseOrder.supplierId,
        orderDate: purchaseOrder.orderDate.split("T")[0],
        expectedDeliveryDate: purchaseOrder.expectedDeliveryDate.split("T")[0],
        deliveryAddress: purchaseOrder.deliveryAddress || "",
        deliveryCity: purchaseOrder.deliveryCity || "",
        deliveryState: purchaseOrder.deliveryState || "",
        deliveryCountry: purchaseOrder.deliveryCountry || "Philippines",
        deliveryPostalCode: purchaseOrder.deliveryPostalCode || "",
        notes: purchaseOrder.notes || "",
      });
      // Convert PO line items to form format
      const formLineItems: PurchaseOrderLineItemFormValues[] =
        purchaseOrder.items?.map((item) => ({
          itemId: item.itemId,
          itemCode: item.item?.code,
          itemName: item.item?.name,
          quantity: item.quantity,
          packagingId: item.packagingId || null,
          packagingName: item.packagingName,
          rate: item.rate,
          uomId: item.uomId,
          discountPercent: item.discountPercent,
          taxPercent: item.taxPercent,
          lineTotal: item.lineTotal,
        })) || [];
      setLineItems(formLineItems);
      setActiveTab("general");
    } else if (open) {
      form.reset(defaultValues);
      setLineItems(initialLineItems || []);
      setActiveTab(initialActiveTab || "general");
    }
  }, [open, purchaseOrder, form, defaultValues, initialLineItems, initialActiveTab]);

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

  const handleSaveItem = (item: PurchaseOrderLineItemFormValues) => {
    if (editingItem !== null) {
      // Update existing item
      setLineItems((items) =>
        items.map((it, i) => (i === editingItem.index ? item : it))
      );
    } else {
      // Add new item
      setLineItems((items) => [...items, item]);
    }
  };

  const handleSupplierChange = (supplierId: string) => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (supplier) {
      // Auto-fill delivery address from supplier's billing address
      form.setValue("deliveryAddress", supplier.billingAddress);
      form.setValue("deliveryCity", supplier.billingCity);
      form.setValue("deliveryState", supplier.billingState);
      form.setValue("deliveryPostalCode", supplier.billingPostalCode);
      form.setValue("deliveryCountry", supplier.billingCountry);
    }
  };

  const onSubmit = async (data: PurchaseOrderFormValues) => {

    if (lineItems.length === 0) {
      toast.error("Please add at least one line item");
      return;
    }

    try {
      // Transform form data to API request format
      const apiRequest = {
        supplierId: data.supplierId,
        orderDate: data.orderDate,
        expectedDeliveryDate: data.expectedDeliveryDate,
        deliveryAddress: data.deliveryAddress,
        deliveryCity: data.deliveryCity,
        deliveryState: data.deliveryState,
        deliveryCountry: data.deliveryCountry,
        deliveryPostalCode: data.deliveryPostalCode,
        items: lineItems.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          packagingId: item.packagingId || null,
          uomId: item.uomId,
          rate: item.rate,
          discountPercent: item.discountPercent || 0,
          taxPercent: item.taxPercent || 0,
        })),
        notes: data.notes || "",
        discountAmount: totals.totalDiscount,
        taxAmount: totals.totalTax,
      };

      if (isEditMode && purchaseOrder) {
        await updateMutation.mutateAsync({
          id: purchaseOrder.id,
          data: apiRequest,
        });
        toast.success("Purchase order updated successfully");
      } else {
        await createMutation.mutateAsync(apiRequest);
        toast.success("Purchase order created successfully");
      }
      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : (isEditMode
            ? "Failed to update purchase order"
            : "Failed to create purchase order");
      toast.error(errorMessage);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit Purchase Order" : "Create New Purchase Order"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Update purchase order details and line items."
                : "Fill in the purchase order details and add line items."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
              // Switch to general tab if there are validation errors there
              if (Object.keys(errors).length > 0) {
                setActiveTab("general");
                toast.error("Please fill in all required fields in the General tab");
              }
            })} className="space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="items">
                    Line Items ({lineItems.length})
                  </TabsTrigger>
                  <TabsTrigger value="terms">Notes</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="supplierId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier *</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            handleSupplierChange(value);
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a supplier" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {suppliers
                              .filter((s) => s.status === "active")
                              .map((supplier) => (
                                <SelectItem key={supplier.id} value={supplier.id}>
                                  {supplier.code} - {supplier.name}
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
                      name="orderDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Order Date *</FormLabel>
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
                          <FormLabel>Expected Delivery Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Delivery Address</h4>
                    <FormField
                      control={form.control}
                      name="deliveryAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address *</FormLabel>
                          <FormControl>
                            <Input placeholder="Street address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="deliveryCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City *</FormLabel>
                            <FormControl>
                              <Input placeholder="City" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="deliveryState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State/Province *</FormLabel>
                            <FormControl>
                              <Input placeholder="State" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="deliveryPostalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postal Code *</FormLabel>
                            <FormControl>
                              <Input placeholder="Postal code" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="deliveryCountry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country *</FormLabel>
                          <FormControl>
                            <Input placeholder="Country" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="items" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">Line Items</h3>
                      <p className="text-sm text-muted-foreground">
                        Manage items to purchase in this order
                      </p>
                    </div>
                    <Button type="button" onClick={handleAddItem} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>

                  {lineItems.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                      <p>No items added yet.</p>
                      <p className="text-sm">Click &quot;Add Item&quot; to get started.</p>
                    </div>
                  ) : (
                    <>
                      <div className="border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead className="text-center">Unit</TableHead>
                              <TableHead className="text-right">Rate</TableHead>
                              <TableHead className="text-right">
                                Disc %
                              </TableHead>
                              <TableHead className="text-right">Tax %</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lineItems.map((item, index) => {
                              const lineTotal =
                                item.lineTotal ?? item.quantity * item.rate;

                              return (
                                <TableRow key={index}>
                                  <TableCell>
                                    <div>
                                      <div className="font-medium">
                                        {item.itemName}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {item.itemCode}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {item.quantity}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className="text-muted-foreground">
                                      {item.packagingName || "—"}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(item.rate)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {item.discountPercent}%
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {item.taxPercent}%
                                  </TableCell>
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
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <Calculator className="h-5 w-5" />
                          <h4 className="font-semibold">Totals</h4>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span className="font-medium">
                              {formatCurrency(totals.subtotal)}
                            </span>
                          </div>
                          <div className="flex justify-between text-red-600">
                            <span>Discount:</span>
                            <span className="font-medium">
                              -{formatCurrency(totals.totalDiscount)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tax:</span>
                            <span className="font-medium">
                              {formatCurrency(totals.totalTax)}
                            </span>
                          </div>
                          <div className="flex justify-between text-lg font-bold border-t pt-2">
                            <span>Total:</span>
                            <span>{formatCurrency(totals.totalAmount)}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="terms" className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={6} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : isEditMode
                    ? "Update Purchase Order"
                    : "Create Purchase Order"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Line Item Dialog */}
      <PurchaseOrderLineItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        onSave={handleSaveItem}
        item={editingItem?.item || null}
        mode={editingItem ? "edit" : "add"}
      />
    </>
  );
}
