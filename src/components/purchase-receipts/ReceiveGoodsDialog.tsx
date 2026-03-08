"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useReceiveGoodsFromPO } from "@/hooks/usePurchaseReceipts";
import { useWarehouses } from "@/hooks/useWarehouses";
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
import type { PurchaseOrder, PurchaseOrderLineItem } from "@/types/purchase-order";
import type { WarehouseLocation } from "@/types/inventory-location";
import {
  createReceiveGoodsSchema,
  type ReceiveGoodsFormValues,
} from "@/lib/validations/purchase-order-dialog";

interface ReceiveGoodsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder | null;
}

export function ReceiveGoodsDialog({ open, onOpenChange, purchaseOrder }: ReceiveGoodsDialogProps) {
  const t = useTranslations("receiveGoodsDialog");
  const tValidation = useTranslations("purchaseOrderValidation");
  const locale = useLocale();
  const receiveMutation = useReceiveGoodsFromPO();
  const { data: warehousesData } = useWarehouses({ page: 1, limit: 100 });
  const warehouses = warehousesData?.data || [];
  const receiveGoodsSchema = createReceiveGoodsSchema((key) => tValidation(key));
  const today = new Date().toISOString().split("T")[0];
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(
      new Date(value)
    );
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft":
        return t("draft");
      case "submitted":
        return t("submitted");
      case "approved":
        return t("approved");
      case "in_transit":
        return t("inTransit");
      case "partially_received":
        return t("partiallyReceived");
      case "received":
        return t("received");
      case "cancelled":
        return t("cancelled");
      default:
        return status;
    }
  };

  const form = useForm<ReceiveGoodsFormValues>({
    resolver: zodResolver(receiveGoodsSchema),
    mode: "onSubmit", // Only validate on submit
    defaultValues: {
      warehouseId: "",
      locationId: "",
      receiptDate: today,
      batchSequenceNumber: "",
      supplierInvoiceNumber: "",
      supplierInvoiceDate: "",
      notes: "",
      items: [],
    },
  });

  // Initialize items from purchase order
  useEffect(() => {
    if (purchaseOrder && open) {
      const items = (purchaseOrder.items || []).map((item: PurchaseOrderLineItem) => {
        const remainingQty = item.quantity - (item.quantityReceived || 0);

        // Get uomId from either direct property or nested uom object
        const uomId = item.uomId || item.uom?.id || "";

        return {
          purchaseOrderItemId: item.id,
          itemId: item.itemId,
          quantityOrdered: item.quantity,
          quantityReceived: remainingQty, // Default to receiving remaining quantity
          uomId,
          rate: item.rate,
        };
      });

      form.reset({
        warehouseId: "",
        locationId: "",
        receiptDate: today,
        batchSequenceNumber: "",
        supplierInvoiceNumber: "",
        supplierInvoiceDate: "",
        notes: "",
        items,
      });
    }
  }, [purchaseOrder, open, form, today]);

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

  const onSubmit = async (data: ReceiveGoodsFormValues) => {
    if (!purchaseOrder) return;

    // Filter out items with 0 quantity
    const itemsToReceive = data.items.filter((item) => item.quantityReceived > 0);

    if (itemsToReceive.length === 0) {
      toast.error(t("lineItemRequired"));
      return;
    }

    try {
      await receiveMutation.mutateAsync({
        purchaseOrderId: purchaseOrder.id,
        data: {
          warehouseId: data.warehouseId,
          locationId: data.locationId || undefined,
          receiptDate: data.receiptDate,
          supplierInvoiceNumber: data.supplierInvoiceNumber,
          supplierInvoiceDate: data.supplierInvoiceDate,
          batchSequenceNumber: data.batchSequenceNumber,
          notes: data.notes,
          items: itemsToReceive,
        },
      });

      toast.success(t("success"));
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("error");
      toast.error(message);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { code: purchaseOrder.orderCode })}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Purchase Order Info */}
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted p-4">
              <div>
                <div className="text-sm text-muted-foreground">{t("supplier")}</div>
                <div className="font-medium">{purchaseOrder.supplier?.name}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">{t("orderDate")}</div>
                <div className="font-medium">
                  {formatDate(purchaseOrder.orderDate)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">{t("expectedDelivery")}</div>
                <div className="font-medium">
                  {formatDate(purchaseOrder.expectedDeliveryDate)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">{t("status")}</div>
                <Badge>{getStatusLabel(purchaseOrder.status)}</Badge>
              </div>
            </div>

            {/* Receipt Details */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="warehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("warehouseLabel")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectWarehouse")} />
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
                    <FormLabel>{t("locationLabel")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!selectedWarehouseId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              selectedWarehouseId ? t("selectLocation") : t("selectWarehouseFirst")
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

              <FormField
                control={form.control}
                name="receiptDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("receiptDateLabel")}</FormLabel>
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
                    <FormLabel>{t("supplierInvoiceNumberLabel")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("supplierInvoiceNumberPlaceholder")} {...field} />
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
                    <FormLabel>{t("supplierInvoiceDateLabel")}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                    <FormLabel>{t("batchLabel")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("batchPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Items to Receive */}
            <div>
              <h3 className="mb-3 text-sm font-semibold">{t("itemsToReceive")}</h3>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("item")}</TableHead>
                      <TableHead className="text-right">{t("ordered")}</TableHead>
                      <TableHead className="text-right">{t("alreadyReceived")}</TableHead>
                      <TableHead className="text-right">{t("remaining")}</TableHead>
                      <TableHead className="text-right">{t("receiveNow")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrder.items?.map((poItem, index) => {
                      const alreadyReceived = poItem.quantityReceived || 0;
                      const remaining = poItem.quantity - alreadyReceived;
                      const receivingNow = items[index]?.quantityReceived || 0;

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
                          <TableCell className="text-right">{poItem.quantity}</TableCell>
                          <TableCell className="text-right">{alreadyReceived}</TableCell>
                          <TableCell className="text-right font-medium">{remaining}</TableCell>
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
                  <FormLabel>{t("notesLabel")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("notesPlaceholder")}
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
                <p className="font-semibold">{t("fixErrors")}</p>
                <ul className="mt-1 list-inside list-disc">
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
                  {form.formState.errors.items &&
                    typeof form.formState.errors.items === "object" &&
                    "message" in form.formState.errors.items && (
                      <li>{String(form.formState.errors.items.message)}</li>
                    )}
                  {form.formState.errors.items && Array.isArray(form.formState.errors.items) && (
                    <>
                      {form.formState.errors.items.map(
                        (itemError, idx: number) =>
                          itemError && (
                            <li key={idx}>
                              {t("itemError", { index: idx + 1, message: JSON.stringify(itemError) })}
                            </li>
                          )
                      )}
                    </>
                  )}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={receiveMutation.isPending}>
                {receiveMutation.isPending ? t("receiving") : t("receiveAction")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
