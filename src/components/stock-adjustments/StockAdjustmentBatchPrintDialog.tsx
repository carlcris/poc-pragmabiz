"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { useItemUnitOptions } from "@/hooks/useItemUnitOptions";
import type { BarcodeData } from "@/lib/barcode";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAX_BATCH_LABEL_COUNT = 100;

const createStockAdjustmentLabelId = (batchLocationId: string, labelNumber: number) => {
  const uniquePart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${labelNumber}`;

  return `stock-adjustment-${batchLocationId}-${uniquePart}`;
};

type StockAdjustmentBatchPrintDialogProps = {
  label: BarcodeData | null;
  onOpenChange: (open: boolean) => void;
};

export function StockAdjustmentBatchPrintDialog({
  label,
  onOpenChange,
}: StockAdjustmentBatchPrintDialogProps) {
  const t = useTranslations("stockAdjustmentForm");
  const [labelCount, setLabelCount] = useState("1");
  const [unitOptionId, setUnitOptionId] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);
  const {
    data: unitOptionsResponse,
    isError: isUnitOptionsError,
    isLoading: isUnitOptionsLoading,
  } = useItemUnitOptions(label?.itemId || "", { activeOnly: true, limit: 50 });
  const unitOptions = useMemo(
    () =>
      (unitOptionsResponse?.data || []).filter(
        (option) => option.isActive && Number.isFinite(option.qtyPerUnit) && option.qtyPerUnit > 0
      ),
    [unitOptionsResponse?.data]
  );
  const defaultUnitOption = useMemo(
    () =>
      unitOptions.find((option) => option.isDefault) ||
      unitOptions.find((option) => option.isBase) ||
      unitOptions[0] ||
      null,
    [unitOptions]
  );
  const selectedUnitOption = unitOptions.find((option) => option.id === unitOptionId) || null;

  useEffect(() => {
    if (label) {
      setLabelCount("1");
      setUnitOptionId("");
    }
  }, [label]);

  useEffect(() => {
    if (!label || !defaultUnitOption) {
      return;
    }

    setUnitOptionId((currentUnitOptionId) =>
      unitOptions.some((option) => option.id === currentUnitOptionId)
        ? currentUnitOptionId
        : defaultUnitOption.id
    );
  }, [defaultUnitOption, label, unitOptions]);

  const parsedLabelCount = Number(labelCount);
  const isLabelCountValid =
    Number.isInteger(parsedLabelCount) &&
    parsedLabelCount >= 1 &&
    parsedLabelCount <= MAX_BATCH_LABEL_COUNT;

  const handleOpenChange = (open: boolean) => {
    if (!isPrinting) {
      onOpenChange(open);
    }
  };

  const handlePrint = async () => {
    if (!label || !isLabelCountValid) {
      toast.error(t("invalidBatchLabelCount", { max: MAX_BATCH_LABEL_COUNT }));
      return;
    }
    if (isUnitOptionsError) {
      toast.error(t("batchPrintUnitLoadError"));
      return;
    }
    if (!selectedUnitOption) {
      toast.error(t("selectBatchPrintUnit"));
      return;
    }

    try {
      setIsPrinting(true);
      const labels = Array.from({ length: parsedLabelCount }, (_, index) => ({
        ...label,
        boxId: createStockAdjustmentLabelId(label.boxId, index + 1),
        boxNumber: index + 1,
        qtyPerBox: selectedUnitOption.qtyPerUnit,
      }));
      const { printBarcodeLabels } = await import("@/lib/barcode");
      await printBarcodeLabels(labels);
      toast.success(t("printBatchSuccess", { count: parsedLabelCount }));
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to print stock adjustment batch QR labels", error);
      toast.error(t("printBatchError"));
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Dialog open={label !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("batchPrintDialogTitle")}</DialogTitle>
          <DialogDescription>
            {label
              ? t("batchPrintDialogDescription", {
                  batch: label.batchNumber,
                  quantity: label.qtyPerBox,
                })
              : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="stock-adjustment-batch-label-count">{t("batchLabelCount")}</Label>
          <Input
            id="stock-adjustment-batch-label-count"
            type="number"
            min="1"
            max={MAX_BATCH_LABEL_COUNT}
            step="1"
            value={labelCount}
            disabled={isPrinting}
            onChange={(event) => setLabelCount(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t("batchLabelCountHelp", { max: MAX_BATCH_LABEL_COUNT })}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock-adjustment-batch-print-unit">{t("batchPrintUnit")}</Label>
          <Select
            value={unitOptionId}
            disabled={isPrinting || isUnitOptionsLoading || isUnitOptionsError}
            onValueChange={setUnitOptionId}
          >
            <SelectTrigger id="stock-adjustment-batch-print-unit">
              <SelectValue placeholder={t("selectBatchPrintUnit")} />
            </SelectTrigger>
            <SelectContent>
              {unitOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.displayLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p
            className={
              isUnitOptionsError || (!isUnitOptionsLoading && unitOptions.length === 0)
                ? "text-xs text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            {isUnitOptionsError
              ? t("batchPrintUnitLoadError")
              : !isUnitOptionsLoading && unitOptions.length === 0
                ? t("batchPrintUnitUnavailable")
                : t("batchPrintUnitHelp")}
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPrinting}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={
              !isLabelCountValid ||
              !selectedUnitOption ||
              isUnitOptionsLoading ||
              isUnitOptionsError ||
              isPrinting
            }
            onClick={handlePrint}
          >
            {isPrinting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            {isPrinting ? t("printingBatchLabels") : t("printBatchLabels")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
