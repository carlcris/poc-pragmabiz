"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { toast } from "sonner";
import { useReceiveStockRequest } from "@/hooks/useStockRequests";
import { useLookupWarehouseLocations } from "@/hooks/useLookups";
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
import { format } from "date-fns";

const createReceiveStockRequestSchema = (
  tValidation: (key: "receivedDateRequired" | "receivedQtyMin") => string
) => z.object({
  receivedDate: z.string().min(1, tValidation("receivedDateRequired")),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      stockRequestItemId: z.string(),
      itemId: z.string(),
      requestedQty: z.number(),
      receivedQty: z.number().min(0, tValidation("receivedQtyMin")),
      uomId: z.string(),
      locationId: z.string().nullable().optional(),
    })
  ),
});

type ReceiveStockRequestSchema = ReturnType<typeof createReceiveStockRequestSchema>;
type ReceiveStockRequestFormValues = z.infer<ReceiveStockRequestSchema>;

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
  const t = useTranslations("receiveStockRequestDialog");
  const tValidation = useTranslations("receiveStockRequestValidation");
  const locale = useLocale();
  const receiveMutation = useReceiveStockRequest();
  const receiveStockRequestSchema = createReceiveStockRequestSchema((key) => tValidation(key));

  const receivingWarehouseId = stockRequest?.requesting_warehouse?.id || "";

  const { data: locationsData } = useLookupWarehouseLocations(receivingWarehouseId, { limit: 100 });

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
        receivedQty: Math.max(0, (item.dispatch_qty || 0) - (item.received_qty || 0)),
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
      toast.error(t("receiveQtyRequired"));
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

      toast.success(t("receiveSuccess"));
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("receiveError");
      toast.error(message);
    }
  };

  if (!stockRequest) return null;

  const items = form.watch("items");

  const updateItemQuantity = (index: number, quantity: number) => {
    const requestItem = stockRequest.stock_request_items?.[index];
    const dispatchedQty = requestItem?.dispatch_qty || 0;
    const receivedQty = requestItem?.received_qty || 0;
    const remainingQty = Math.max(0, dispatchedQty - receivedQty);
    const nextQty = Math.min(Math.max(0, Number.isFinite(quantity) ? quantity : 0), remainingQty);

    const currentItems = [...form.getValues("items")];
    currentItems[index] = {
      ...currentItems[index],
      receivedQty: nextQty,
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
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { code: stockRequest.request_code })}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted p-4">
              <div>
                <div className="text-sm text-muted-foreground">{t("from")}</div>
                <div className="font-medium">
                  {stockRequest.requesting_warehouse?.warehouse_name || t("noWarehouse")}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">{t("to")}</div>
                <div className="font-medium">
                  {stockRequest.fulfilling_warehouse?.warehouse_name || t("noWarehouse")}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">{t("requiredDate")}</div>
                <div className="font-medium">
                  {format(new Date(stockRequest.required_date), "MMM d, yyyy")}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">{t("status")}</div>
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
                    <FormLabel>{t("receivedDateLabel")} *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">{t("itemsToReceive")}</h3>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("item")}</TableHead>
                      <TableHead className="text-right">{t("requested")}</TableHead>
                      <TableHead className="text-right">{t("dispatched")}</TableHead>
                      <TableHead className="text-right">{t("received")}</TableHead>
                      <TableHead className="text-right">{t("receiveNow")}</TableHead>
                      <TableHead>{t("location")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(stockRequest.stock_request_items || []).map((requestItem, index) => {
                      const receivingNow = items[index]?.receivedQty || 0;
                      const locationId = items[index]?.locationId || "";
                      const dispatchedQty = requestItem.dispatch_qty || 0;
                      const receivedQty = requestItem.received_qty || 0;
                      const remainingQty = Math.max(0, dispatchedQty - receivedQty);

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
                            {requestItem.requested_qty.toLocaleString(locale, { maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">{dispatchedQty}</TableCell>
                          <TableCell className="text-right">{receivedQty}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max={remainingQty}
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
                                  placeholder={receivingWarehouseId ? t("selectLocation") : t("selectWarehouseFirst")}
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
