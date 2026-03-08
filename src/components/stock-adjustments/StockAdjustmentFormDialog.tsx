"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Plus, Pencil, Trash2, Calculator } from "lucide-react";
import type { StockAdjustment } from "@/types/stock-adjustment";
import type { WarehouseLocation } from "@/types/inventory-location";
import { apiClient } from "@/lib/api";
import { StockAdjustmentLineItemDialog, type StockAdjustmentLineItemFormValues } from "@/components/stock-adjustments/StockAdjustmentLineItemDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const createAdjustmentFormSchema = (
  tValidation: (key: "adjustmentDateRequired" | "warehouseRequired" | "reasonRequired") => string
) =>
  z.object({
    adjustmentType: z.enum(["physical_count", "damage", "loss", "found", "quality_issue", "other"]),
    adjustmentDate: z.string().min(1, tValidation("adjustmentDateRequired")),
    warehouseId: z.string().min(1, tValidation("warehouseRequired")),
    locationId: z.string().optional(),
    reason: z.string().min(1, tValidation("reasonRequired")),
    notes: z.string().optional(),
  });

type AdjustmentFormSchema = ReturnType<typeof createAdjustmentFormSchema>;
export type StockAdjustmentFormValues = z.infer<AdjustmentFormSchema>;

export type StockAdjustmentFormSubmitPayload = {
  values: StockAdjustmentFormValues;
  lineItems: StockAdjustmentLineItemFormValues[];
  selectedAdjustment: StockAdjustment | null;
};

type WarehouseOption = {
  id: string;
  code?: string | null;
  name?: string | null;
};

type StockAdjustmentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAdjustment: StockAdjustment | null;
  warehouses: WarehouseOption[];
  isSaving: boolean;
  onSave: (payload: StockAdjustmentFormSubmitPayload) => Promise<void>;
  onItemSelect: (itemId: string, warehouseId: string, locationId?: string) => Promise<number>;
  formatCurrency: (value: number) => string;
};

export function StockAdjustmentFormDialog({
  open,
  onOpenChange,
  selectedAdjustment,
  warehouses,
  isSaving,
  onSave,
  onItemSelect,
  formatCurrency,
}: StockAdjustmentFormDialogProps) {
  const t = useTranslations("stockAdjustmentForm");
  const tPage = useTranslations("stockAdjustmentsPage");
  const tValidation = useTranslations("stockAdjustmentValidation");
  const locale = useLocale();
  const [lineItems, setLineItems] = useState<StockAdjustmentLineItemFormValues[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    index: number;
    item: StockAdjustmentLineItemFormValues;
  } | null>(null);

  const adjustmentFormSchema = createAdjustmentFormSchema((key) => tValidation(key));
  const form = useForm<StockAdjustmentFormValues>({
    resolver: zodResolver(adjustmentFormSchema),
    defaultValues: {
      adjustmentType: "physical_count",
      adjustmentDate: new Date().toISOString().split("T")[0],
      warehouseId: "",
      locationId: "",
      reason: "",
      notes: "",
    },
  });

  const totals = useMemo(() => {
    const totalValue = lineItems.reduce((sum, item) => {
      const difference = (item.adjustedQty || 0) - (item.currentQty || 0);
      const value = difference * (item.unitCost || 0);
      return sum + value;
    }, 0);

    return { totalValue };
  }, [lineItems]);

  useEffect(() => {
    if (open && selectedAdjustment) {
      form.reset({
        adjustmentType: selectedAdjustment.adjustmentType,
        adjustmentDate: selectedAdjustment.adjustmentDate,
        warehouseId: selectedAdjustment.warehouseId,
        locationId: selectedAdjustment.locationId || "",
        reason: selectedAdjustment.reason,
        notes: selectedAdjustment.notes || "",
      });

      const formLineItems: StockAdjustmentLineItemFormValues[] = selectedAdjustment.items.map((item) => ({
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        uomId: item.uomId,
        currentQty: item.currentQty,
        adjustedQty: item.adjustedQty,
        unitCost: item.unitCost,
      }));
      setLineItems(formLineItems);
      return;
    }

    if (open) {
      form.reset({
        adjustmentType: "physical_count",
        adjustmentDate: new Date().toISOString().split("T")[0],
        warehouseId: "",
        locationId: "",
        reason: "",
        notes: "",
      });
      setLineItems([]);
    }
  }, [form, open, selectedAdjustment]);

  const selectedWarehouseId = form.watch("warehouseId");

  useEffect(() => {
    if (!selectedWarehouseId) {
      form.setValue("locationId", "");
    }
  }, [selectedWarehouseId, form]);

  const { data: locationsData } = useQuery<{ data: WarehouseLocation[] }>({
    queryKey: ["warehouse-locations", selectedWarehouseId],
    queryFn: () => apiClient.get(`/api/warehouses/${selectedWarehouseId}/locations`),
    enabled: !!selectedWarehouseId,
  });

  const locations = useMemo(
    () => (locationsData?.data || []).filter((location) => location.isActive),
    [locationsData]
  );

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

  const handleSaveItem = (item: StockAdjustmentLineItemFormValues) => {
    if (editingItem !== null) {
      setLineItems((items) => items.map((it, i) => (i === editingItem.index ? item : it)));
      return;
    }
    setLineItems((items) => [...items, item]);
  };

  const handleSubmit = async (values: StockAdjustmentFormValues) => {
    if (lineItems.length === 0) {
      window.alert(t("lineItemRequired"));
      return;
    }

    try {
      await onSave({
        values,
        lineItems,
        selectedAdjustment,
      });
      onOpenChange(false);
      setLineItems([]);
      form.reset();
    } catch {
      // Parent handles mutation errors
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedAdjustment ? t("editTitle") : t("createTitle")}
            </DialogTitle>
            <DialogDescription>
              {selectedAdjustment
                ? t("editDescription", { code: selectedAdjustment.adjustmentCode })
                : t("createDescription")}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">{t("generalInformation")}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="adjustmentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("adjustmentTypeLabel")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("selectType")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="physical_count">{tPage("physicalCount")}</SelectItem>
                            <SelectItem value="damage">{tPage("damage")}</SelectItem>
                            <SelectItem value="loss">{tPage("loss")}</SelectItem>
                            <SelectItem value="found">{tPage("found")}</SelectItem>
                            <SelectItem value="quality_issue">{tPage("qualityIssue")}</SelectItem>
                            <SelectItem value="other">{tPage("other")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="adjustmentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("adjustmentDateLabel")}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="warehouseId"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
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
                                {(warehouse.code || "") + " - " + (warehouse.name || "")}
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
                      <FormItem className="col-span-2">
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
                    name="reason"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>{t("reasonLabel")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("reasonPlaceholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>{t("notesLabel")}</FormLabel>
                        <FormControl>
                          <Textarea placeholder={t("notesPlaceholder")} className="resize-none" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">{t("lineItemsTitle")}</h3>
                    <p className="text-sm text-muted-foreground">{t("lineItemsDescription")}</p>
                  </div>
                  <Button type="button" onClick={handleAddItem} size="sm" disabled={!selectedWarehouseId}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("addItem")}
                  </Button>
                </div>

                {!selectedWarehouseId && (
                  <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-600">
                    {t("selectWarehouseBeforeItems")}
                  </div>
                )}

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
                            <TableHead className="text-right">{t("currentQty")}</TableHead>
                            <TableHead className="text-right">{t("adjustedQty")}</TableHead>
                            <TableHead className="text-right">{t("difference")}</TableHead>
                            <TableHead className="text-right">{t("unitCost")}</TableHead>
                            <TableHead className="text-right">{t("totalValue")}</TableHead>
                            <TableHead className="w-[100px]">{t("actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lineItems.map((item, index) => {
                            const difference = (item.adjustedQty || 0) - (item.currentQty || 0);
                            const totalValue = difference * (item.unitCost || 0);

                            return (
                              <TableRow key={index}>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">{item.itemName}</div>
                                    <div className="text-sm text-muted-foreground">{item.itemCode}</div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">{item.currentQty.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right">{item.adjustedQty.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right">
                                  <span
                                    className={`font-medium ${
                                      difference > 0
                                        ? "text-green-600"
                                        : difference < 0
                                          ? "text-red-600"
                                          : "text-muted-foreground"
                                    }`}
                                  >
                                    {difference > 0 ? "+" : ""}
                                    {difference.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">{formatCurrency(item.unitCost)}</TableCell>
                                <TableCell className="text-right">
                                  <span
                                    className={`font-medium ${
                                      totalValue > 0 ? "text-green-600" : totalValue < 0 ? "text-red-600" : ""
                                    }`}
                                  >
                                    {formatCurrency(totalValue)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Button type="button" variant="ghost" size="sm" onClick={() => handleEditItem(index)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteItem(index)}>
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
                        <h4 className="font-semibold">{t("summary")}</h4>
                      </div>
                      <div className="flex justify-between text-lg font-bold">
                        <span>{t("totalAdjustmentValue")}:</span>
                        <span
                          className={
                            totals.totalValue > 0
                              ? "text-green-600"
                              : totals.totalValue < 0
                                ? "text-red-600"
                                : ""
                          }
                        >
                          {formatCurrency(totals.totalValue)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? t("saving") : selectedAdjustment ? t("updateAction") : t("createAction")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {itemDialogOpen && (
        <StockAdjustmentLineItemDialog
          open={itemDialogOpen}
          onOpenChange={setItemDialogOpen}
          onSave={handleSaveItem}
          item={editingItem?.item || null}
          mode={editingItem ? "edit" : "add"}
          warehouseId={selectedWarehouseId}
          locationId={form.watch("locationId")}
          onItemSelect={onItemSelect}
        />
      )}
    </>
  );
}
