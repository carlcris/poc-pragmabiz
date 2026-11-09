"use client";

import type { StockAdjustmentLineItemFormValues } from "@/lib/stock-adjustments/line-item-schema";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Lock, MoreVertical, Package, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { StockAdjustment } from "@/types/stock-adjustment";
import type { BarcodeData } from "@/lib/barcode";
import { StockAdjustmentBatchPrintDialog } from "@/components/stock-adjustments/StockAdjustmentBatchPrintDialog";
import { StockAdjustmentLineItemDialog } from "@/components/stock-adjustments/StockAdjustmentLineItemDialog";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { WarehouseSelect } from "@/components/warehouses/WarehouseSelect";
import { WarehouseLocationSelect } from "@/components/warehouses/WarehouseLocationSelect";
import type { LookupWarehouseOption } from "@/hooks/useLookups";
import { cn } from "@/lib/utils";

const createAdjustmentFormSchema = (
  tValidation: (key: "warehouseRequired" | "adjustmentDateRequired" | "reasonRequired") => string
) =>
  z.object({
    warehouseId: z.string().min(1, tValidation("warehouseRequired")),
    adjustmentType: z.enum(["physical_count", "damage", "loss", "found", "quality_issue", "other"]),
    adjustmentDate: z.string().min(1, tValidation("adjustmentDateRequired")),
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

type StockAdjustmentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAdjustment: StockAdjustment | null;
  isSaving: boolean;
  onSave: (payload: StockAdjustmentFormSubmitPayload) => Promise<void>;
  formatCurrency: (value: number) => string;
};

export function StockAdjustmentFormDialog({
  open,
  onOpenChange,
  selectedAdjustment,
  isSaving,
  onSave,
  formatCurrency,
}: StockAdjustmentFormDialogProps) {
  const t = useTranslations("stockAdjustmentForm");
  const tPage = useTranslations("stockAdjustmentsPage");
  const tValidation = useTranslations("stockAdjustmentValidation");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [lineItems, setLineItems] = useState<StockAdjustmentLineItemFormValues[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    index: number;
    item: StockAdjustmentLineItemFormValues;
  } | null>(null);
  const [batchLabelToPrint, setBatchLabelToPrint] = useState<BarcodeData | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<LookupWarehouseOption | null>(null);

  const adjustmentFormSchema = createAdjustmentFormSchema((key) => tValidation(key));
  const form = useForm<StockAdjustmentFormValues>({
    resolver: zodResolver(adjustmentFormSchema),
    defaultValues: {
      warehouseId: "",
      adjustmentType: "physical_count",
      adjustmentDate: new Date().toISOString().split("T")[0],
      locationId: "",
      reason: "",
      notes: "",
    },
  });

  const totals = useMemo(
    () =>
      lineItems.reduce(
        (summary, item) => {
          const difference = (item.adjustedQty || 0) - (item.currentQty || 0);
          return {
            totalValue: summary.totalValue + difference * (item.unitCost || 0),
            increases: summary.increases + (difference > 0 ? 1 : 0),
            decreases: summary.decreases + (difference < 0 ? 1 : 0),
          };
        },
        { totalValue: 0, increases: 0, decreases: 0 }
      ),
    [lineItems]
  );

  useEffect(() => {
    if (open && selectedAdjustment) {
      form.reset({
        warehouseId: selectedAdjustment.warehouseId,
        adjustmentType: selectedAdjustment.adjustmentType,
        adjustmentDate: selectedAdjustment.adjustmentDate,
        locationId: selectedAdjustment.locationId || "",
        reason: selectedAdjustment.reason,
        notes: selectedAdjustment.notes || "",
      });
      setSelectedWarehouse({
        id: selectedAdjustment.warehouseId,
        code: selectedAdjustment.warehouseCode || "",
        name: selectedAdjustment.warehouseName || t("warehouseLabel"),
        businessUnitId: null,
        isActive: true,
      });

      const formLineItems: StockAdjustmentLineItemFormValues[] = selectedAdjustment.items.map(
        (item) => ({
          itemId: item.itemId,
          batchEntryMode: item.itemBatchLocationId ? "existing" : "new",
          itemBatchLocationId: item.itemBatchLocationId || "",
          batchLocationSku: item.batchLocationSku || "",
          batchCode: item.batchCode || "",
          batchReceivedAt: item.batchReceivedAt || "",
          batchWarehouseLocationId: item.batchWarehouseLocationId || "",
          batchLocationCode: item.batchLocationCode || "",
          batchLocationName: item.batchLocationName || "",
          itemCode: item.itemCode,
          itemName: item.itemName,
          uomId: item.uomId,
          uomName: item.uomName || "",
          enteredQty: item.enteredQty,
          enteredUnitOptionId: item.enteredUnitOptionId,
          enteredUnitLabel: item.enteredUnitLabel,
          enteredQtyPerUnit: item.enteredQtyPerUnit,
          currentQty: item.currentQty,
          adjustedQty: item.adjustedQty,
          unitCost: item.unitCost,
        })
      );
      setLineItems(formLineItems);
      return;
    }

    if (open) {
      form.reset({
        warehouseId: "",
        adjustmentType: "physical_count",
        adjustmentDate: new Date().toISOString().split("T")[0],
        locationId: "",
        reason: "",
        notes: "",
      });
      setLineItems([]);
      setSelectedWarehouse(null);
    }
  }, [form, open, selectedAdjustment, t]);

  const selectedWarehouseId = form.watch("warehouseId");

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
    const duplicateLine = lineItems.some((existingItem, index) => {
      if (editingItem?.index === index || existingItem.itemId !== item.itemId) {
        return false;
      }

      if (existingItem.itemBatchLocationId && item.itemBatchLocationId) {
        return existingItem.itemBatchLocationId === item.itemBatchLocationId;
      }

      const existingBatchCode = existingItem.batchCode?.trim();
      const batchCode = item.batchCode?.trim();
      return Boolean(existingBatchCode && batchCode && existingBatchCode === batchCode);
    });

    if (duplicateLine) {
      toast.error(t("duplicateBatchLine"));
      return false;
    }

    if (editingItem !== null) {
      setLineItems((items) => items.map((it, i) => (i === editingItem.index ? item : it)));
      return true;
    }

    setLineItems((items) => [...items, item]);
    return true;
  };

  const handlePrintBatchLabel = (item: StockAdjustmentLineItemFormValues) => {
    if (!item.itemBatchLocationId || !item.batchLocationSku) {
      toast.error(t("printBatchMissing"));
      return;
    }

    setBatchLabelToPrint({
      boxId: item.itemBatchLocationId,
      itemId: item.itemId,
      batchLocationSku: item.batchLocationSku,
      batchNumber: item.batchCode || item.batchLocationSku,
      grnNumber: selectedAdjustment?.adjustmentCode || t("stockAdjustmentLabel"),
      itemCode: item.itemCode || "",
      itemName: item.itemName || "",
      boxNumber: 1,
      qtyPerBox: item.adjustedQty,
      deliveryDate: item.batchReceivedAt || form.getValues("adjustmentDate"),
      warehouseCode: selectedWarehouse?.code || undefined,
      locationId: item.batchWarehouseLocationId || null,
      locationCode: item.batchLocationCode || undefined,
    });
  };

  const handleSubmit = async (values: StockAdjustmentFormValues) => {
    if (lineItems.length === 0) {
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

  const isWarehouseLocked = Boolean(selectedAdjustment) || lineItems.length > 0;
  const formatQty = (value: number) =>
    value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatValue = (value: number) =>
    value < 0 ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value);
  const toneClass = (value: number) =>
    value > 0 ? "text-green-700" : value < 0 ? "text-red-700" : "text-muted-foreground";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* Fixed height from md up so adding lines or switching states never resizes and
            re-centres the dialog; the viewport clamp has no preset in the Tailwind scale. */}
        <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col gap-0 overflow-hidden p-0 md:h-[min(90vh,52rem)]">
          <DialogHeader className="px-6 pb-5 pr-12 pt-6">
            <DialogTitle className="text-xl">
              {selectedAdjustment ? t("editTitle") : t("createTitle")}
            </DialogTitle>
            <DialogDescription>
              {selectedAdjustment
                ? t("editDescription", { code: selectedAdjustment.adjustmentCode })
                : t("createDescription")}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto border-t p-6">
                <section
                  aria-label={t("generalInformation")}
                  className="space-y-4 rounded-xl border bg-muted/30 p-5"
                >
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <FormField
                      control={form.control}
                      name="warehouseId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("warehouseLabel")}</FormLabel>
                          <FormControl>
                            <WarehouseSelect
                              value={field.value}
                              onValueChange={(value) => {
                                field.onChange(value);
                                form.setValue("locationId", "");
                              }}
                              onOptionChange={setSelectedWarehouse}
                              scope="current_business_unit"
                              selectedOption={selectedWarehouse}
                              disabled={isWarehouseLocked}
                            />
                          </FormControl>
                          {isWarehouseLocked ? (
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Lock className="h-3 w-3" />
                              {t("warehouseLockedHint")}
                            </p>
                          ) : null}
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
                          <FormControl>
                            <WarehouseLocationSelect
                              warehouseId={selectedWarehouseId}
                              value={field.value ?? ""}
                              onValueChange={field.onChange}
                              selectedOption={
                                selectedAdjustment?.locationId &&
                                selectedAdjustment.locationId === field.value
                                  ? {
                                      id: selectedAdjustment.locationId,
                                      code: selectedAdjustment.locationCode ?? "",
                                      name: selectedAdjustment.locationName,
                                    }
                                  : null
                              }
                              allowNone
                              storableOnly
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">{t("locationHint")}</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                              <SelectItem value="physical_count">
                                {tPage("physicalCount")}
                              </SelectItem>
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
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="reason"
                      render={({ field }) => (
                        <FormItem>
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
                        <FormItem>
                          <FormLabel>{t("notesLabel")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("notesPlaceholder")} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </section>

                <section
                  aria-labelledby="stock-adjustment-lines-heading"
                  className="flex flex-1 flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <h3 id="stock-adjustment-lines-heading" className="text-base font-semibold">
                        {t("lineItemsTitle")}
                      </h3>
                      {lineItems.length > 0 ? (
                        <Badge variant="secondary" className="tabular-nums">
                          {lineItems.length}
                        </Badge>
                      ) : null}
                    </div>
                    {lineItems.length > 0 ? (
                      <Button type="button" onClick={handleAddItem} size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        {t("addItem")}
                      </Button>
                    ) : null}
                  </div>

                  {lineItems.length === 0 ? (
                    <div className="flex min-h-48 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-primary">
                        <Package className="h-5 w-5" />
                      </span>
                      <p className="text-sm font-semibold">{t("noItems")}</p>
                      <p className="max-w-sm text-sm text-muted-foreground">
                        {selectedWarehouseId
                          ? t("noItemsDescription")
                          : t("selectWarehouseBeforeItems")}
                      </p>
                      <Button
                        type="button"
                        onClick={handleAddItem}
                        size="sm"
                        disabled={!selectedWarehouseId}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {t("addItem")}
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>{t("item")}</TableHead>
                            <TableHead>{t("batch")}</TableHead>
                            <TableHead className="text-right">{t("currentQty")}</TableHead>
                            <TableHead className="text-right">{t("adjustedQty")}</TableHead>
                            <TableHead className="text-right">{t("difference")}</TableHead>
                            <TableHead className="text-right">{t("unitCost")}</TableHead>
                            <TableHead className="text-right">{t("totalValue")}</TableHead>
                            <TableHead>
                              <span className="sr-only">{t("actions")}</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lineItems.map((item, index) => {
                            const difference = (item.adjustedQty || 0) - (item.currentQty || 0);
                            const totalValue = difference * (item.unitCost || 0);

                            return (
                              <TableRow key={index}>
                                <TableCell className="max-w-xs">
                                  <div className="font-medium leading-snug">{item.itemName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {item.itemCode}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold">
                                      {item.batchCode || item.batchLocationSku}
                                    </span>
                                    {item.itemBatchLocationId || item.itemBatchId ? null : (
                                      <Badge variant="secondary">{t("newBatchTag")}</Badge>
                                    )}
                                  </div>
                                  {item.batchLocationSku &&
                                  item.batchLocationSku !== item.batchCode ? (
                                    <div className="text-xs tabular-nums text-muted-foreground">
                                      {item.batchLocationSku}
                                    </div>
                                  ) : null}
                                  {item.batchLocationCode || item.batchLocationName ? (
                                    <div className="text-xs text-muted-foreground">
                                      {item.batchLocationCode || item.batchLocationName}
                                    </div>
                                  ) : null}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                  {formatQty(item.currentQty)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatQty(item.adjustedQty)}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "text-right font-semibold tabular-nums",
                                    toneClass(difference)
                                  )}
                                >
                                  {difference > 0 ? "+" : ""}
                                  {formatQty(
                                    (difference < 0 ? -1 : 1) *
                                      (item.enteredQty ?? Math.abs(difference))
                                  )}{" "}
                                  {item.enteredUnitLabel || item.uomName}
                                  <div className="text-xs font-normal text-muted-foreground">
                                    {formatQty(difference)} {item.uomName}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatCurrency(item.unitCost)}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "text-right font-semibold tabular-nums",
                                    toneClass(totalValue)
                                  )}
                                >
                                  {formatValue(totalValue)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditItem(index)}
                                    >
                                      <Pencil className="mr-2 h-4 w-4" />
                                      {tCommon("edit")}
                                    </Button>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-9 w-9"
                                          aria-label={tCommon("actions")}
                                        >
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={() => handlePrintBatchLabel(item)}
                                        >
                                          <Printer className="mr-2 h-4 w-4" />
                                          {t("printBatchLabels")}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() => handleDeleteItem(index)}
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          {t("removeLine")}
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </section>
              </div>

              <DialogFooter className="items-center gap-3 border-t bg-muted/30 px-6 py-4 sm:justify-between sm:space-x-0">
                <dl className="flex flex-wrap items-center gap-x-7 gap-y-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("linesCount")}</dt>
                    <dd className="font-semibold tabular-nums">{lineItems.length}</dd>
                  </div>
                  {lineItems.length > 0 ? (
                    <>
                      <div>
                        <dt className="text-xs text-muted-foreground">{t("increasesCount")}</dt>
                        <dd className="font-semibold tabular-nums text-green-700">
                          {totals.increases}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">{t("decreasesCount")}</dt>
                        <dd className="font-semibold tabular-nums text-red-700">
                          {totals.decreases}
                        </dd>
                      </div>
                    </>
                  ) : null}
                  <div className="hidden h-8 w-px bg-border sm:block" aria-hidden="true" />
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("totalAdjustmentValue")}</dt>
                    <dd
                      className={cn(
                        "text-lg font-bold tabular-nums",
                        totals.totalValue === 0 ? "text-foreground" : toneClass(totals.totalValue)
                      )}
                    >
                      {formatValue(totals.totalValue)}
                    </dd>
                  </div>
                </dl>
                <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    {t("cancel")}
                  </Button>
                  <Button type="submit" disabled={isSaving || lineItems.length === 0}>
                    {isSaving
                      ? t("saving")
                      : selectedAdjustment
                        ? t("updateAction")
                        : t("createAction")}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <StockAdjustmentBatchPrintDialog
        label={batchLabelToPrint}
        onOpenChange={(open) => {
          if (!open) {
            setBatchLabelToPrint(null);
          }
        }}
      />

      {itemDialogOpen && (
        <StockAdjustmentLineItemDialog
          open={itemDialogOpen}
          onOpenChange={setItemDialogOpen}
          onSave={handleSaveItem}
          item={editingItem?.item || null}
          mode={editingItem ? "edit" : "add"}
          warehouseId={selectedWarehouseId}
          locationId={form.watch("locationId")}
        />
      )}
    </>
  );
}
