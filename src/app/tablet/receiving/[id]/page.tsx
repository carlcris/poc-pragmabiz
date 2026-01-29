"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { TabletHeader } from "@/components/tablet/TabletHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CompactPackageSelector } from "@/components/inventory/PackageSelector";
import { usePurchaseOrder } from "@/hooks/usePurchaseOrders";
import { useReceiveGoodsFromPO } from "@/hooks/usePurchaseReceipts";
import { useWarehouses } from "@/hooks/useWarehouses";
import { apiClient } from "@/lib/api";
import type { WarehouseLocation } from "@/types/inventory-location";
import type { PurchaseOrderLineItem } from "@/types/purchase-order";

const receiveGoodsSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required"),
  locationId: z.string().optional(),
  receiptDate: z.string().min(1, "Receipt date is required"),
  batchSequenceNumber: z.string().optional(),
  supplierInvoiceNumber: z.string().optional(),
  supplierInvoiceDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      purchaseOrderItemId: z.string(),
      itemId: z.string(),
      quantityOrdered: z.number(),
      quantityReceived: z.number().min(0, "Quantity cannot be negative"),
      packagingId: z.string().nullable().optional(),
      uomId: z.string(),
      rate: z.number(),
    })
  ),
});

type ReceiveGoodsFormValues = z.infer<typeof receiveGoodsSchema>;

export default function TabletReceivingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const purchaseOrderId = params.id as string;

  const { data: purchaseOrder, isLoading, error } = usePurchaseOrder(purchaseOrderId);
  const receiveMutation = useReceiveGoodsFromPO();
  const { data: warehousesData } = useWarehouses({ page: 1, limit: 100 });
  const warehouses = useMemo(() => warehousesData?.data || [], [warehousesData?.data]);

  const form = useForm<ReceiveGoodsFormValues>({
    resolver: zodResolver(receiveGoodsSchema),
    mode: "onSubmit",
    defaultValues: {
      warehouseId: "",
      locationId: "",
      receiptDate: format(new Date(), "yyyy-MM-dd"),
      batchSequenceNumber: "",
      supplierInvoiceNumber: "",
      supplierInvoiceDate: "",
      notes: "",
      items: [],
    },
  });

  useEffect(() => {
    if (!purchaseOrder) return;

    const items = (purchaseOrder.items || []).map((item: PurchaseOrderLineItem) => {
      const remainingQty = item.quantity - (item.quantityReceived || 0);
      const uomId = item.uomId || item.uom?.id || "";

      return {
        purchaseOrderItemId: item.id,
        itemId: item.itemId,
        quantityOrdered: item.quantity,
        quantityReceived: remainingQty,
        packagingId: item.packagingId || null,
        uomId,
        rate: item.rate,
      };
    });

    form.reset({
      warehouseId: "",
      locationId: "",
      receiptDate: format(new Date(), "yyyy-MM-dd"),
      batchSequenceNumber: "",
      supplierInvoiceNumber: "",
      supplierInvoiceDate: "",
      notes: "",
      items,
    });
  }, [purchaseOrder, form]);

  useEffect(() => {
    if (form.getValues("warehouseId")) return;
    if (warehouses.length === 1) {
      form.setValue("warehouseId", warehouses[0].id);
    }
  }, [warehouses, form]);

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

  useEffect(() => {
    if (!selectedWarehouseId) {
      form.setValue("locationId", "");
    }
  }, [selectedWarehouseId, form]);

  const items = form.watch("items");

  const updateItemQuantity = (index: number, quantity: number) => {
    const currentItems = [...form.getValues("items")];
    currentItems[index] = {
      ...currentItems[index],
      quantityReceived: Number.isFinite(quantity) ? quantity : 0,
    };
    form.setValue("items", currentItems, { shouldValidate: false });
  };

  const updateItemPackaging = (index: number, packagingId: string | null) => {
    const currentItems = [...form.getValues("items")];
    currentItems[index] = {
      ...currentItems[index],
      packagingId,
    };
    form.setValue("items", currentItems, { shouldValidate: false });
  };

  const onSubmit = async (data: ReceiveGoodsFormValues) => {
    if (!purchaseOrder) return;

    const itemsToReceive = data.items.filter((item) => item.quantityReceived > 0);
    if (itemsToReceive.length === 0) {
      toast.error("Please enter quantities to receive for at least one item");
      return;
    }

    try {
      await receiveMutation.mutateAsync({
        purchaseOrderId: purchaseOrder.id,
        data: {
          warehouseId: data.warehouseId,
          locationId: data.locationId || undefined,
          receiptDate: data.receiptDate,
          batchSequenceNumber: data.batchSequenceNumber,
          supplierInvoiceNumber: data.supplierInvoiceNumber,
          supplierInvoiceDate: data.supplierInvoiceDate,
          notes: data.notes,
          items: itemsToReceive,
        },
      });

      toast.success("Goods received successfully.");
      router.push("/tablet/receiving");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to receive goods";
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TabletHeader
        title="Receive Goods"
        subtitle={purchaseOrder?.orderCode || "Purchase Order"}
        showBack={true}
        backHref="/tablet/receiving"
        warehouseName="Main Warehouse"
      />

      <div className="space-y-6 p-6">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              Loading purchase order...
            </CardContent>
          </Card>
        ) : error || !purchaseOrder ? (
          <Card>
            <CardContent className="py-8 text-center text-red-600">
              Failed to load purchase order.
            </CardContent>
          </Card>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="warehouseId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Warehouse *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11">
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
                      name="locationId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={!selectedWarehouseId}
                          >
                            <FormControl>
                              <SelectTrigger className="h-11">
                                <SelectValue
                                  placeholder={
                                    selectedWarehouseId
                                      ? "Select location"
                                      : "Select warehouse first"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
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
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="receiptDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Receipt Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-11" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="batchSequenceNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Batch</FormLabel>
                          <FormControl>
                            <Input placeholder="Batch sequence" {...field} className="h-11" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="supplierInvoiceNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier Invoice #</FormLabel>
                          <FormControl>
                            <Input placeholder="Invoice number" {...field} className="h-11" />
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
                            <Input type="date" {...field} className="h-11" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Notes" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Package</TableHead>
                          <TableHead className="text-right">Ordered</TableHead>
                          <TableHead className="text-right">Receive Now *</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(purchaseOrder.items || []).map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">{item.item?.name}</div>
                              <div className="text-xs text-muted-foreground">{item.item?.code}</div>
                            </TableCell>
                            <TableCell>
                              <CompactPackageSelector
                                itemId={item.itemId}
                                value={items[index]?.packagingId || null}
                                onChange={(pkgId) => updateItemPackaging(index, pkgId)}
                              />
                            </TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max={item.quantity}
                                value={items[index]?.quantityReceived || 0}
                                onChange={(e) =>
                                  updateItemQuantity(index, parseFloat(e.target.value) || 0)
                                }
                                className="h-10 text-right"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
                <Button type="submit" disabled={receiveMutation.isPending}>
                  {receiveMutation.isPending ? "Saving..." : "Receive Goods"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
