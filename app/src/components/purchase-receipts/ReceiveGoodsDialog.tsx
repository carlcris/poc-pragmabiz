"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useReceiveGoodsFromPO } from "@/hooks/usePurchaseReceipts";
import { useWarehouses } from "@/hooks/useWarehouses";
import { CompactPackageSelector } from "@/components/inventory/PackageSelector";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PurchaseOrder } from "@/types/purchase-order";
import { format } from "date-fns";

const receiveGoodsSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required"),
  receiptDate: z.string().min(1, "Receipt date is required"),
  supplierInvoiceNumber: z.string().optional(),
  supplierInvoiceDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      purchaseOrderItemId: z.string(),
      itemId: z.string(),
      quantityOrdered: z.number(),
      quantityReceived: z.number().min(0, "Quantity cannot be negative"),
      packagingId: z.string().nullable().optional(), // null = use base package
      uomId: z.string(),
      rate: z.number(),
    })
  ),
});

type ReceiveGoodsFormValues = z.infer<typeof receiveGoodsSchema>;

interface ReceiveGoodsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder | null;
}

export function ReceiveGoodsDialog({
  open,
  onOpenChange,
  purchaseOrder,
}: ReceiveGoodsDialogProps) {
  const receiveMutation = useReceiveGoodsFromPO();
  const { data: warehousesData } = useWarehouses({ page: 1, limit: 100 });
  const warehouses = warehousesData?.data || [];

  const form = useForm<ReceiveGoodsFormValues>({
    resolver: zodResolver(receiveGoodsSchema),
    mode: "onSubmit", // Only validate on submit
    defaultValues: {
      warehouseId: "",
      receiptDate: format(new Date(), "yyyy-MM-dd"),
      supplierInvoiceNumber: "",
      supplierInvoiceDate: "",
      notes: "",
      items: [],
    },
  });

  // Initialize items from purchase order
  useEffect(() => {
    if (purchaseOrder && open) {

      const items = (purchaseOrder.items || []).map((item: any) => {
        const remainingQty = item.quantity - (item.quantityReceived || 0);

        // Get uomId from either direct property or nested uom object
        const uomId = item.uomId || item.uom?.id || "";

        return {
          purchaseOrderItemId: item.id,
          itemId: item.itemId,
          quantityOrdered: item.quantity,
          quantityReceived: remainingQty, // Default to receiving remaining quantity
          packagingId: item.packagingId || null, // Use the package from PO
          uomId,
          rate: item.rate,
        };
      });

      form.reset({
        warehouseId: "",
        receiptDate: format(new Date(), "yyyy-MM-dd"),
        supplierInvoiceNumber: "",
        supplierInvoiceDate: "",
        notes: "",
        items,
      });
    }
  }, [purchaseOrder, open, form]);

  const onSubmit = async (data: ReceiveGoodsFormValues) => {
    if (!purchaseOrder) return;

    // Filter out items with 0 quantity
    const itemsToReceive = data.items.filter(item => item.quantityReceived > 0);

    if (itemsToReceive.length === 0) {
      toast.error("Please enter quantities to receive for at least one item");
      return;
    }

    try {
      const result = await receiveMutation.mutateAsync({
        purchaseOrderId: purchaseOrder.id,
        data: {
          warehouseId: data.warehouseId,
          receiptDate: data.receiptDate,
          supplierInvoiceNumber: data.supplierInvoiceNumber,
          supplierInvoiceDate: data.supplierInvoiceDate,
          notes: data.notes,
          items: itemsToReceive,
        },
      });

      toast.success("Goods received successfully! Stock levels updated.");
      onOpenChange(false);
    } catch (error: any) {

      toast.error(error.message || "Failed to receive goods");
    }
  };

  if (!purchaseOrder) return null;

  const items = form.watch("items");

  const updateItemQuantity = (index: number, quantity: number) => {
    const currentItems = [...form.getValues("items")]; // Create a new array
    currentItems[index] = {
      ...currentItems[index],
      quantityReceived: isNaN(quantity) ? 0 : quantity,
    };
    form.setValue("items", currentItems, { shouldValidate: false }); // Don't validate on change
  };

  const updateItemPackaging = (index: number, packagingId: string | null) => {
    const currentItems = [...form.getValues("items")];
    currentItems[index] = {
      ...currentItems[index],
      packagingId,
    };
    form.setValue("items", currentItems, { shouldValidate: false });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive Goods</DialogTitle>
          <DialogDescription>
            Receive items from Purchase Order {purchaseOrder.orderCode}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Purchase Order Info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">Supplier</div>
                <div className="font-medium">{purchaseOrder.supplier?.name}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Order Date</div>
                <div className="font-medium">
                  {format(new Date(purchaseOrder.orderDate), "MMM d, yyyy")}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Expected Delivery</div>
                <div className="font-medium">
                  {format(new Date(purchaseOrder.expectedDeliveryDate), "MMM d, yyyy")}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <Badge>{purchaseOrder.status}</Badge>
              </div>
            </div>

            {/* Receipt Details */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="warehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warehouse *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.code} - {warehouse.name}
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
                name="receiptDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receipt Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplierInvoiceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Invoice Number</FormLabel>
                    <FormControl>
                      <Input placeholder="INV-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplierInvoiceDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Invoice Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Items to Receive */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Items to Receive</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead className="text-right">Ordered</TableHead>
                      <TableHead className="text-right">Already Received</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead className="text-right">Receive Now *</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrder.items?.map((poItem, index) => {
                      const alreadyReceived = poItem.quantityReceived || 0;
                      const remaining = poItem.quantity - alreadyReceived;
                      const receivingNow = items[index]?.quantityReceived || 0;
                      const packagingId = items[index]?.packagingId || null;

                      return (
                        <TableRow key={poItem.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{poItem.item?.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {poItem.item?.code}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <CompactPackageSelector
                              itemId={poItem.itemId}
                              value={packagingId}
                              onChange={(pkgId) => updateItemPackaging(index, pkgId)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {poItem.quantity}
                          </TableCell>
                          <TableCell className="text-right">
                            {alreadyReceived}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {remaining}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max={remaining}
                              value={receivingNow}
                              onChange={(e) =>
                                updateItemQuantity(index, parseFloat(e.target.value) || 0)
                              }
                              className="w-24 text-right"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any notes about the receipt..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Display form errors */}
            {Object.keys(form.formState.errors).length > 0 && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                <p className="font-semibold">Please fix the following errors:</p>
                <ul className="mt-1 list-disc list-inside">
                  {form.formState.errors.warehouseId && (
                    <li>{String(form.formState.errors.warehouseId.message)}</li>
                  )}
                  {form.formState.errors.receiptDate && (
                    <li>{String(form.formState.errors.receiptDate.message)}</li>
                  )}
                  {form.formState.errors.supplierInvoiceNumber && (
                    <li>{String(form.formState.errors.supplierInvoiceNumber.message)}</li>
                  )}
                  {form.formState.errors.supplierInvoiceDate && (
                    <li>{String(form.formState.errors.supplierInvoiceDate.message)}</li>
                  )}
                  {form.formState.errors.notes && (
                    <li>{String(form.formState.errors.notes.message)}</li>
                  )}
                  {form.formState.errors.items && typeof form.formState.errors.items === 'object' && 'message' in form.formState.errors.items && (
                    <li>{String(form.formState.errors.items.message)}</li>
                  )}
                  {form.formState.errors.items && Array.isArray(form.formState.errors.items) && (
                    <>
                      {form.formState.errors.items.map((itemError: any, idx: number) => (
                        itemError && (
                          <li key={idx}>
                            Item {idx + 1}: {JSON.stringify(itemError)}
                          </li>
                        )
                      ))}
                    </>
                  )}
                  {/* Fallback - show raw error object for debugging */}
                  {Object.keys(form.formState.errors).length > 0 &&
                   !form.formState.errors.warehouseId &&
                   !form.formState.errors.receiptDate &&
                   !form.formState.errors.items && (
                    <li className="text-xs">Debug: {JSON.stringify(form.formState.errors)}</li>
                  )}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={receiveMutation.isPending}>
                {receiveMutation.isPending ? "Receiving..." : "Receive Goods"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
