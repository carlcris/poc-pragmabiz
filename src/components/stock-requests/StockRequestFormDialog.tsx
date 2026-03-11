"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { z } from "zod";
import type { StockRequest } from "@/types/stock-request";
import type { StockRequestLineItemPayload } from "@/components/stock-requests/StockRequestLineItemDialog";
import { StockRequestLineItemDialog } from "@/components/stock-requests/StockRequestLineItemDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const createRequestFormSchema = (
  tValidation: (key: "requestDateRequired" | "requiredDateRequired" | "requestedByRequired" | "requestedToRequired" | "requestingAndFulfillingMustDiffer") => string
) =>
  z
  .object({
    request_date: z.string().min(1, tValidation("requestDateRequired")),
    required_date: z.string().min(1, tValidation("requiredDateRequired")),
    requesting_warehouse_id: z.string().min(1, tValidation("requestedByRequired")),
    fulfilling_warehouse_id: z.string().min(1, tValidation("requestedToRequired")),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    purpose: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.fulfilling_warehouse_id && values.fulfilling_warehouse_id === values.requesting_warehouse_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: tValidation("requestingAndFulfillingMustDiffer"),
        path: ["fulfilling_warehouse_id"],
      });
    }
  });

type StockRequestFormSchema = ReturnType<typeof createRequestFormSchema>;
export type StockRequestFormValues = z.infer<StockRequestFormSchema>;

type WarehouseOption = {
  id: string;
  code: string;
  name: string;
};

type StockRequestFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRequest: StockRequest | null;
  warehouses: WarehouseOption[];
  defaultRequestingWarehouseId: string;
  isSaving: boolean;
  onSave: (payload: {
    values: StockRequestFormValues;
    lineItems: StockRequestLineItemPayload[];
    selectedRequest: StockRequest | null;
  }) => Promise<void>;
};

export function StockRequestFormDialog({
  open,
  onOpenChange,
  selectedRequest,
  warehouses,
  defaultRequestingWarehouseId,
  isSaving,
  onSave,
}: StockRequestFormDialogProps) {
  const t = useTranslations("stockRequestForm");
  const tPage = useTranslations("stockRequestsPage");
  const tValidation = useTranslations("stockRequestValidation");
  const locale = useLocale();
  const [lineItems, setLineItems] = useState<StockRequestLineItemPayload[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    index: number;
    item: StockRequestLineItemPayload;
  } | null>(null);

  const requestFormSchema = createRequestFormSchema((key) => tValidation(key));
  const form = useForm<StockRequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      request_date: new Date().toISOString().split("T")[0],
      required_date: new Date().toISOString().split("T")[0],
      requesting_warehouse_id: "",
      fulfilling_warehouse_id: "",
      priority: "normal",
      purpose: "",
      notes: "",
    },
  });
  const requestingWarehouseId = form.watch("requesting_warehouse_id");
  const requestingWarehouse = warehouses.find((warehouse) => warehouse.id === requestingWarehouseId) ?? null;
  const requestingWarehouseLabel = requestingWarehouse
    ? `${requestingWarehouse.code} - ${requestingWarehouse.name}`
    : t("autoAssignedWarehouseUnavailable");
  const fulfillingWarehouseOptions = warehouses.filter(
    (warehouse) => warehouse.id !== requestingWarehouseId
  );

  useEffect(() => {
    if (open && selectedRequest) {
      form.reset({
        request_date: selectedRequest.request_date,
        required_date: selectedRequest.required_date,
        requesting_warehouse_id: selectedRequest.requesting_warehouse_id,
        fulfilling_warehouse_id: selectedRequest.fulfilling_warehouse_id || "",
        priority: selectedRequest.priority,
        purpose: selectedRequest.purpose || "",
        notes: selectedRequest.notes || "",
      });

      const formLineItems: StockRequestLineItemPayload[] =
        selectedRequest.stock_request_items?.map((item) => ({
          itemId: item.item_id,
          itemCode: item.items?.item_code || "",
          itemName: item.items?.item_name || "",
          uomId: item.uom_id,
          uomLabel: item.units_of_measure?.code || item.units_of_measure?.symbol || "",
          requestedQty: item.requested_qty,
          notes: item.notes || "",
        })) || [];
      setLineItems(formLineItems);
    } else if (open) {
      form.reset({
        request_date: new Date().toISOString().split("T")[0],
        required_date: new Date().toISOString().split("T")[0],
        requesting_warehouse_id: defaultRequestingWarehouseId,
        fulfilling_warehouse_id: "",
        priority: "normal",
        purpose: "",
        notes: "",
      });
      setLineItems([]);
    }
  }, [defaultRequestingWarehouseId, form, open, selectedRequest]);

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

  const handleSaveItem = (item: StockRequestLineItemPayload) => {
    if (editingItem !== null) {
      setLineItems((items) => items.map((it, i) => (i === editingItem.index ? item : it)));
    } else {
      setLineItems((items) => [...items, item]);
    }
  };

  const onSubmit = async (values: StockRequestFormValues) => {
    if (lineItems.length === 0) {
      window.alert(t("lineItemRequired"));
      return;
    }

    try {
      await onSave({ values, lineItems, selectedRequest });
      onOpenChange(false);
      setLineItems([]);
      form.reset();
    } catch {
      // Error handled by parent mutations
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{selectedRequest ? t("editTitle") : t("createTitle")}</DialogTitle>
            <DialogDescription>
              {selectedRequest
                ? t("editDescription", { code: selectedRequest.request_code })
                : t("createDescription")}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-1">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <FormField
                      control={form.control}
                      name="request_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">{t("requestDateLabel")}<span className="ml-0.5 text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="required_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">{t("requiredDateLabel")}<span className="ml-0.5 text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">{t("priorityLabel")}<span className="ml-0.5 text-destructive">*</span></FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder={t("selectPriority")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">{tPage("low")}</SelectItem>
                              <SelectItem value="normal">{tPage("normal")}</SelectItem>
                              <SelectItem value="high">{tPage("high")}</SelectItem>
                              <SelectItem value="urgent">{tPage("urgent")}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="col-span-3 grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="requesting_warehouse_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">{t("requestedByLabel")}<span className="ml-0.5 text-destructive">*</span></FormLabel>
                            <FormControl>
                              <Input
                                value={requestingWarehouseLabel}
                                readOnly
                                disabled
                                className="h-9"
                              />
                            </FormControl>
                            <input type="hidden" name={field.name} value={field.value} readOnly />
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="fulfilling_warehouse_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">{t("requestedToLabel")}<span className="ml-0.5 text-destructive">*</span></FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder={t("selectRequestedTo")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {fulfillingWarehouseOptions.map((warehouse) => (
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
                    </div>

                    <FormField
                      control={form.control}
                      name="purpose"
                      render={({ field }) => (
                        <FormItem className="col-span-3">
                          <FormLabel className="text-xs">{t("purposeLabel")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("purposePlaceholder")} {...field} className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem className="col-span-3">
                          <FormLabel className="text-xs">{t("notesLabel")}</FormLabel>
                          <FormControl>
                            <Textarea placeholder={t("notesPlaceholder")} className="h-16 resize-none" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium">{t("lineItemsTitle")}</h3>
                        <p className="text-xs text-muted-foreground">{t("lineItemsDescription")}</p>
                      </div>
                      <Button type="button" onClick={handleAddItem} size="sm" className="h-8">
                        <Plus className="mr-1 h-3 w-3" />
                        {t("addItem")}
                      </Button>
                    </div>

                    {lineItems.length === 0 ? (
                      <div className="rounded-lg border-2 border-dashed py-8 text-center text-muted-foreground">
                        <p className="text-sm">{t("noItems")}</p>
                        <p className="text-xs">{t("noItemsDescription")}</p>
                      </div>
                    ) : (
                      <div className="max-h-[300px] overflow-y-auto rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="py-2 text-xs">{t("item")}</TableHead>
                              <TableHead className="py-2 text-right text-xs">{t("qty")}</TableHead>
                              <TableHead className="py-2 text-xs">{t("unit")}</TableHead>
                              <TableHead className="py-2 text-xs">{t("notes")}</TableHead>
                              <TableHead className="w-[80px] py-2 text-xs">{t("actions")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lineItems.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell className="py-2">
                                  <div>
                                    <div className="text-sm font-medium">{item.itemName}</div>
                                    <div className="text-xs text-muted-foreground">{item.itemCode}</div>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2 text-right text-sm">{item.requestedQty.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                <TableCell className="py-2 text-sm">{item.uomLabel || t("noValue")}</TableCell>
                                <TableCell className="py-2">
                                  <div className="max-w-[150px] truncate text-sm">{item.notes || t("noValue")}</div>
                                </TableCell>
                                <TableCell className="py-2">
                                  <div className="flex items-center gap-1">
                                    <Button type="button" variant="ghost" size="sm" onClick={() => handleEditItem(index)} className="h-7 w-7 p-0">
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteItem(index)} className="h-7 w-7 p-0">
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-4 flex-shrink-0">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-9">
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || !form.formState.isValid || lineItems.length === 0}
                  className="h-9"
                >
                  {isSaving ? t("saving") : selectedRequest ? t("updateAction") : t("createAction")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {itemDialogOpen && (
        <StockRequestLineItemDialog
          open={itemDialogOpen}
          onOpenChange={setItemDialogOpen}
          onSave={handleSaveItem}
          item={editingItem?.item || null}
          mode={editingItem ? "edit" : "add"}
        />
      )}
    </>
  );
}
