"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Printer } from "lucide-react";
import type { StockAdjustment, StockAdjustmentItem } from "@/types/stock-adjustment";
import { StockAdjustmentStatusText } from "@/components/stock-adjustments/StockAdjustmentStatusText";
import { StockAdjustmentTypeLabel } from "@/components/stock-adjustments/StockAdjustmentTypeLabel";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type StockAdjustmentDetailsDialogProps = {
  adjustment: StockAdjustment | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (adjustment: StockAdjustment) => void;
  onPrintBatchLabel: (adjustment: StockAdjustment, item: StockAdjustmentItem) => void;
  formatCurrency: (value: number) => string;
};

export function StockAdjustmentDetailsDialog({
  adjustment,
  onOpenChange,
  onEdit,
  onPrintBatchLabel,
  formatCurrency,
}: StockAdjustmentDetailsDialogProps) {
  const t = useTranslations("stockAdjustmentsPage");
  const tForm = useTranslations("stockAdjustmentForm");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const changeCounts = useMemo(
    () =>
      (adjustment?.items ?? []).reduce(
        (counts, item) => ({
          increases: counts.increases + (item.difference > 0 ? 1 : 0),
          decreases: counts.decreases + (item.difference < 0 ? 1 : 0),
        }),
        { increases: 0, decreases: 0 }
      ),
    [adjustment]
  );

  const formatQty = (value: number) =>
    value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatValue = (value: number) =>
    value < 0 ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value);
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const toneClass = (value: number) =>
    value > 0 ? "text-green-700" : value < 0 ? "text-red-700" : "text-muted-foreground";
  const formatEnteredDifference = (item: StockAdjustmentItem) =>
    `${item.difference > 0 ? "+" : ""}${formatQty(
      (item.difference < 0 ? -1 : 1) * item.enteredQty
    )} ${item.enteredUnitLabel || item.uomName || ""}`.trim();
  const formatBaseDifference = (item: StockAdjustmentItem) =>
    `${formatQty(item.difference)} ${item.uomName || ""}`.trim();

  return (
    <Dialog open={adjustment !== null} onOpenChange={onOpenChange}>
      {/* Same frame as StockAdjustmentFormDialog so switching between view and edit keeps the
          dialog in place; the viewport clamp has no preset in the Tailwind scale. */}
      <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col gap-0 overflow-hidden p-0 md:h-[min(90vh,52rem)]">
        <DialogHeader className="px-6 pb-5 pr-12 pt-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <DialogTitle className="text-xl">{t("detailsTitle")}</DialogTitle>
            {adjustment ? <StockAdjustmentStatusText status={adjustment.status} /> : null}
          </div>
          <DialogDescription>
            {adjustment ? t("detailsDescription", { code: adjustment.adjustmentCode }) : ""}
          </DialogDescription>
        </DialogHeader>

        {adjustment ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto border-t p-4 sm:p-6">
              <section
                aria-label={tForm("generalInformation")}
                className="space-y-4 rounded-xl border bg-muted/30 p-4 sm:p-5"
              >
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4">
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-muted-foreground">
                      {tForm("warehouseLabel")}
                    </dt>
                    <dd className="font-medium">{adjustment.warehouseName}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-muted-foreground">
                      {tForm("locationLabel")}
                    </dt>
                    {adjustment.locationPath || adjustment.locationName ? (
                      <dd className="font-medium">
                        {adjustment.locationPath || adjustment.locationName}
                      </dd>
                    ) : (
                      <dd className="text-muted-foreground">{t("detailsNoLocation")}</dd>
                    )}
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-muted-foreground">
                      {tForm("adjustmentTypeLabel")}
                    </dt>
                    <dd className="font-medium">
                      <StockAdjustmentTypeLabel type={adjustment.adjustmentType} />
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-muted-foreground">
                      {tForm("adjustmentDateLabel")}
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {formatDate(adjustment.adjustmentDate)}
                    </dd>
                  </div>
                </dl>

                <div className="h-px bg-border" aria-hidden="true" />

                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4">
                  <div className="col-span-2 space-y-1">
                    <dt className="text-sm font-medium text-muted-foreground">
                      {tForm("reasonLabel")}
                    </dt>
                    <dd className="font-medium">{adjustment.reason}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-muted-foreground">
                      {tForm("notesLabel")}
                    </dt>
                    {adjustment.notes ? (
                      <dd className="whitespace-pre-wrap">{adjustment.notes}</dd>
                    ) : (
                      <dd className="text-muted-foreground">{t("detailsNoNotes")}</dd>
                    )}
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-muted-foreground">
                      {t("stockTransaction")}
                    </dt>
                    {adjustment.stockTransactionCode ? (
                      <dd className="font-medium tabular-nums">
                        {adjustment.stockTransactionCode}
                      </dd>
                    ) : (
                      <dd className="text-muted-foreground">{t("stockTransactionPending")}</dd>
                    )}
                  </div>
                </dl>
              </section>

              <section
                aria-labelledby="stock-adjustment-details-lines-heading"
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <h3
                    id="stock-adjustment-details-lines-heading"
                    className="text-base font-semibold"
                  >
                    {tForm("lineItemsTitle")}
                  </h3>
                  <Badge variant="secondary" className="tabular-nums">
                    {adjustment.items.length}
                  </Badge>
                </div>

                <ul className="space-y-3 md:hidden">
                  {adjustment.items.map((item) => (
                    <li key={item.id} className="overflow-hidden rounded-xl border">
                      <div className="flex items-start gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium leading-snug">{item.itemName}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {item.itemCode}
                            {item.batchCode || item.batchLocationSku ? (
                              <>
                                {" · "}
                                <span className="font-semibold text-foreground">
                                  {item.batchCode || item.batchLocationSku}
                                </span>
                              </>
                            ) : null}
                            {item.batchLocationCode || item.batchLocationName
                              ? ` · ${item.batchLocationCode || item.batchLocationName}`
                              : null}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 shrink-0"
                          aria-label={tForm("printBatchLabels")}
                          onClick={() => onPrintBatchLabel(adjustment, item)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                      <dl className="grid grid-cols-3 gap-3 border-t bg-muted/30 px-4 py-3 text-sm tabular-nums">
                        <div>
                          <dt className="text-xs text-muted-foreground">{tForm("currentQty")}</dt>
                          <dd className="text-muted-foreground">{formatQty(item.currentQty)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">{tForm("adjustedQty")}</dt>
                          <dd>{formatQty(item.adjustedQty)}</dd>
                        </div>
                        <div className="text-right">
                          <dt className="text-xs text-muted-foreground">{tForm("difference")}</dt>
                          <dd className={cn("font-semibold", toneClass(item.difference))}>
                            {formatEnteredDifference(item)}
                          </dd>
                          {item.enteredUnitOptionId && (
                            <dd className="text-xs text-muted-foreground">
                              {formatBaseDifference(item)}
                            </dd>
                          )}
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">{tForm("unitCost")}</dt>
                          <dd>{formatCurrency(item.unitCost)}</dd>
                        </div>
                        <div className="col-span-2 text-right">
                          <dt className="text-xs text-muted-foreground">{tForm("totalValue")}</dt>
                          <dd className={cn("font-semibold", toneClass(item.totalCost))}>
                            {formatValue(item.totalCost)}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>

                <div className="hidden overflow-x-auto rounded-xl border md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>{tForm("item")}</TableHead>
                        <TableHead>{tForm("batch")}</TableHead>
                        <TableHead className="text-right">{tForm("currentQty")}</TableHead>
                        <TableHead className="text-right">{tForm("adjustedQty")}</TableHead>
                        <TableHead className="text-right">{tForm("difference")}</TableHead>
                        <TableHead className="text-right">{tForm("unitCost")}</TableHead>
                        <TableHead className="text-right">{tForm("totalValue")}</TableHead>
                        <TableHead>
                          <span className="sr-only">{tForm("actions")}</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adjustment.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="max-w-xs">
                            <div className="font-medium leading-snug">{item.itemName}</div>
                            <div className="text-xs text-muted-foreground">{item.itemCode}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold">
                              {item.batchCode || item.batchLocationSku}
                            </div>
                            {item.batchLocationSku && item.batchLocationSku !== item.batchCode ? (
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
                              "whitespace-nowrap text-right font-semibold tabular-nums",
                              toneClass(item.difference)
                            )}
                          >
                            {formatEnteredDifference(item)}
                            {item.enteredUnitOptionId && (
                              <div className="text-xs font-normal text-muted-foreground">
                                {formatBaseDifference(item)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(item.unitCost)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-semibold tabular-nums",
                              toneClass(item.totalCost)
                            )}
                          >
                            {formatValue(item.totalCost)}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9"
                                aria-label={tForm("printBatchLabels")}
                                title={tForm("printBatchLabels")}
                                onClick={() => onPrintBatchLabel(adjustment, item)}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            </div>

            <DialogFooter className="items-center gap-3 border-t bg-muted/30 px-4 py-4 sm:justify-between sm:space-x-0 sm:px-6">
              <dl className="flex w-full flex-wrap items-center gap-x-7 gap-y-2 sm:w-auto">
                <div>
                  <dt className="text-xs text-muted-foreground">{tForm("linesCount")}</dt>
                  <dd className="font-semibold tabular-nums">{adjustment.items.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{tForm("increasesCount")}</dt>
                  <dd className="font-semibold tabular-nums text-green-700">
                    {changeCounts.increases}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{tForm("decreasesCount")}</dt>
                  <dd className="font-semibold tabular-nums text-red-700">
                    {changeCounts.decreases}
                  </dd>
                </div>
                <div className="hidden h-8 w-px bg-border sm:block" aria-hidden="true" />
                <div className="ml-auto text-right sm:ml-0 sm:text-left">
                  <dt className="text-xs text-muted-foreground">{tForm("totalAdjustmentValue")}</dt>
                  <dd
                    className={cn(
                      "text-lg font-bold tabular-nums",
                      adjustment.totalValue === 0
                        ? "text-foreground"
                        : toneClass(adjustment.totalValue)
                    )}
                  >
                    {formatValue(adjustment.totalValue)}
                  </dd>
                </div>
              </dl>
              <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {tCommon("close")}
                </Button>
                {adjustment.status === "draft" ? (
                  <Button type="button" onClick={() => onEdit(adjustment)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    {t("editAdjustment")}
                  </Button>
                ) : null}
              </div>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
