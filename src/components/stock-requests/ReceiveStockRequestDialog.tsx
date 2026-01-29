"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useReceiveStockRequest } from "@/hooks/useStockRequests";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StockRequest } from "@/types/stock-request";
import type { WarehouseLocation } from "@/types/inventory-location";
import { format } from "date-fns";

const receiveStockRequestSchema = z.object({
  receivedDate: z.string().min(1, "Received date is required"),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      stockRequestItemId: z.string(),
      itemId: z.string(),
      requestedQty: z.number(),
      receivedQty: z.number().min(0, "Quantity cannot be negative"),
      packagingId: z.string().nullable().optional(),
      uomId: z.string(),
      locationId: z.string().nullable().optional(),
    })
  ),
});

type ReceiveStockRequestFormValues = z.infer<typeof receiveStockRequestSchema>;

interface ReceiveStockRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockRequest: StockRequest | null;
}

export function ReceiveStockRequestDialog({
  open,
  onOpenChange,
  stockRequest,
}: ReceiveStockRequestDialogProps) {
  const receiveMutation = useReceiveStockRequest();

  const receivingWarehouseId = stockRequest?.from_location?.id || "";

  const { data: locationsData } = useQuery<{ data: WarehouseLocation[] }>({
    queryKey: ["warehouse-locations", receivingWarehouseId],
    queryFn: () => apiClient.get(`/api/warehouses/${receivingWarehouseId}/locations`),
    enabled: !!receivingWarehouseId,
  });

  const locations = useMemo(
    () => (locationsData?.data || []).filter((location) => location.isActive),
    [locationsData]
  );

  const defaultLocationId = useMemo(() => {
    const mainLocation = locations.find((location) => location.code === "MAIN");
    return mainLocation?.id || locations[0]?.id || "";
  }, [locations]);

  const form = useForm<ReceiveStockRequestFormValues>({
    resolver: zodResolver(receiveStockRequestSchema),
    mode: "onSubmit",
    defaultValues: {
      receivedDate: format(new Date(), "yyyy-MM-dd"),
      notes: "",
      items: [],
    },
  });

  useEffect(() => {
    if (stockRequest && open) {
      const items = (stockRequest.stock_request_items || []).map((item) => ({
        stockRequestItemId: item.id,
        itemId: item.item_id,
        requestedQty: item.requested_qty,
        receivedQty: item.requested_qty,
        packagingId: item.packagingId ?? null,
        uomId: item.uom_id,
        locationId: defaultLocationId || null,
      }));

      form.reset({
        receivedDate: format(new Date(), "yyyy-MM-dd"),
        notes: "",
        items,
      });
    }
  }, [stockRequest, open, form, defaultLocationId]);

  const onSubmit = async (data: ReceiveStockRequestFormValues) => {
    if (!stockRequest) return;

    const itemsToReceive = data.items.filter((item) => item.receivedQty > 0);

    if (itemsToReceive.length === 0) {
      toast.error("Please enter quantities to receive for at least one item");
      return;
    }

    try {
      await receiveMutation.mutateAsync({
        id: stockRequest.id,
        data: {
          receivedDate: data.receivedDate,
          notes: data.notes,
          items: itemsToReceive,
        },
      });

      toast.success("Stock request received successfully.");
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to receive stock request";
      toast.error(message);
    }
  };

  if (!stockRequest) return null;

  const items = form.watch("items");

  const updateItemQuantity = (index: number, quantity: number) => {
    const currentItems = [...form.getValues("items")];
    currentItems[index] = {
      ...currentItems[index],
      receivedQty: Number.isFinite(quantity) ? quantity : 0,
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

  const updateItemLocation = (index: number, locationId: string | null) => {
    const currentItems = [...form.getValues("items")];
    currentItems[index] = {
      ...currentItems[index],
      locationId,
    };
    form.setValue("items", currentItems, { shouldValidate: false });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive Stock Request</DialogTitle>
          <DialogDescription>
            Receive items for request {stockRequest.request_code}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted p-4">
              <div>
                <div className="text-sm text-muted-foreground">From</div>
                <div className="font-medium">
                  {stockRequest.from_location?.warehouse_name || "--"}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">To</div>
                <div className="font-medium">
                  {stockRequest.to_location?.warehouse_name || "--"}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Required Date</div>
                <div className="font-medium">
                  {format(new Date(stockRequest.required_date), "MMM d, yyyy")}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="font-medium capitalize">
                  {stockRequest.status.replace(/_/g, " ")}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="receivedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Received Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">Items to Receive</h3>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead className="text-right">Requested</TableHead>
                      <TableHead className="text-right">Receive Now *</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(stockRequest.stock_request_items || []).map((requestItem, index) => {
                      const receivingNow = items[index]?.receivedQty || 0;
                      const packagingId = items[index]?.packagingId || null;
                      const locationId = items[index]?.locationId || "";

                      return (
                        <TableRow key={requestItem.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{requestItem.items?.item_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {requestItem.items?.item_code}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <CompactPackageSelector
                              itemId={requestItem.item_id}
                              value={packagingId}
                              onChange={(pkgId) => updateItemPackaging(index, pkgId)}
                            />
                          </TableCell>
                          <TableCell className="text-right">{requestItem.requested_qty}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max={requestItem.requested_qty}
                              value={receivingNow}
                              onChange={(e) =>
                                updateItemQuantity(index, parseFloat(e.target.value) || 0)
                              }
                              className="w-24 text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              onValueChange={(value) => updateItemLocation(index, value || null)}
                              value={locationId}
                              disabled={!receivingWarehouseId}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue
                                  placeholder={
                                    receivingWarehouseId
                                      ? "Select location"
                                      : "Select warehouse first"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {locations.map((location) => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.code} {location.name ? `- ${location.name}` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any notes about this receipt..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={receiveMutation.isPending}>
                {receiveMutation.isPending ? "Receiving..." : "Receive"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
