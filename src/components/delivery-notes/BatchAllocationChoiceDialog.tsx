"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Package, Split } from "lucide-react";
import type {
  PickListBatchAllocationChoiceError,
  PickListBatchAllocationMode,
  PickListBatchAllocationSource,
} from "@/types/pick-list";

type TranslationNamespace = "deliveryNotesPage" | "deliveryNoteDetailPage";

type BatchAllocationChoiceDialogProps = {
  open: boolean;
  choice: PickListBatchAllocationChoiceError | null;
  isPending: boolean;
  namespace: TranslationNamespace;
  onOpenChange: (open: boolean) => void;
  onChoose: (mode: PickListBatchAllocationMode) => void;
};

type LineAllocationChoice = "split" | "single";

const formatQty = (value: number) => {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
};

const sourceLabel = (source: PickListBatchAllocationSource | null) => {
  if (!source) return null;
  return source.batchCode;
};

export function BatchAllocationChoiceDialog({
  open,
  choice,
  isPending,
  namespace,
  onOpenChange,
  onChoose,
}: BatchAllocationChoiceDialogProps) {
  const t = useTranslations(namespace);

  // Track individual line choices - default all to "split"
  const [lineChoices, setLineChoices] = useState<Record<string, LineAllocationChoice>>({});

  // Reset choices when dialog opens with new data
  useEffect(() => {
    if (open && choice?.lines) {
      const initial: Record<string, LineAllocationChoice> = {};
      choice.lines.forEach((line) => {
        initial[line.deliveryNoteItemId] = "split";
      });
      setLineChoices(initial);
    }
  }, [open, choice]);

  const insufficientCount = choice?.lines.length || 0;

  const handleLineChoiceChange = (deliveryNoteItemId: string, value: LineAllocationChoice) => {
    setLineChoices((prev) => ({
      ...prev,
      [deliveryNoteItemId]: value,
    }));
  };

  const handleConfirm = () => {
    // Determine overall mode based on individual choices
    // If ANY line chose "split", use split mode; otherwise use single
    const hasSplit = Object.values(lineChoices).some((choice) => choice === "split");
    const mode: PickListBatchAllocationMode = hasSplit ? "split" : "single_sufficient";
    onChoose(mode);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t("batchAllocationChoiceTitle")}
          </DialogTitle>
          <DialogDescription>
            {insufficientCount} {insufficientCount === 1 ? "line needs" : "lines need"} a decision
            before the pick list can proceed.
          </DialogDescription>
        </DialogHeader>

        {/* Warning banner */}
        {insufficientCount > 0 && (
          <Alert variant="destructive" className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <span className="font-semibold">{insufficientCount} {insufficientCount === 1 ? "line has" : "lines have"}</span>{" "}
              insufficient stock in the suggested batch.
            </AlertDescription>
          </Alert>
        )}

        {/* Scrollable items list */}
        <div className="max-h-96 space-y-4 overflow-y-auto pr-2">
          {(choice?.lines || []).map((line) => {
            const suggestedSource = line.suggestedSource;
            const singleSource = line.singleSource;
            const splitSources = line.splitSources;

            const suggestedAvail = suggestedSource?.availableQty || 0;
            const singleAvail = singleSource?.availableQty || 0;

            const lineChoice = lineChoices[line.deliveryNoteItemId];

            return (
              <div
                key={line.deliveryNoteItemId}
                className="rounded-lg border bg-card p-4"
              >
                {/* Item header */}
                <div className="mb-4">
                  <h4 className="font-semibold text-base">{line.itemLabel}</h4>
                </div>

                {/* Allocation options */}
                <RadioGroup
                  value={lineChoice}
                  onValueChange={(value) =>
                    handleLineChoiceChange(line.deliveryNoteItemId, value as LineAllocationChoice)
                  }
                  className="space-y-3"
                >
                  {/* Split across batches option */}
                  <div className="flex items-start space-x-3 rounded-md border p-3 hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value="split" id={`${line.deliveryNoteItemId}-split`} className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <Label
                        htmlFor={`${line.deliveryNoteItemId}-split`}
                        className="flex items-center gap-2 cursor-pointer font-medium"
                      >
                        <Split className="h-4 w-4" />
                        Split across batches
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {suggestedSource ? (
                          <>
                            {formatQty(suggestedAvail)} from {sourceLabel(suggestedSource)} +{" "}
                            {splitSources.length > 1 ? `${splitSources.length - 1} more` : "others"}
                          </>
                        ) : (
                          <>
                            {splitSources.length} {splitSources.length === 1 ? "source" : "sources"} available
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Pick from single sufficient batch option */}
                  <div className="flex items-start space-x-3 rounded-md border p-3 hover:bg-accent/50 transition-colors">
                    <RadioGroupItem
                      value="single"
                      id={`${line.deliveryNoteItemId}-single`}
                      disabled={!singleSource || singleAvail < line.requiredQty}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-1">
                      <Label
                        htmlFor={`${line.deliveryNoteItemId}-single`}
                        className={`flex items-center gap-2 cursor-pointer font-medium ${
                          !singleSource || singleAvail < line.requiredQty ? "text-muted-foreground" : ""
                        }`}
                      >
                        <Package className="h-4 w-4" />
                        Pick from sufficient batch
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {singleSource ? (
                          <>
                            All {formatQty(line.requiredQty)} from {sourceLabel(singleSource)} (
                            {formatQty(singleAvail)} avail.)
                          </>
                        ) : (
                          "No single batch available"
                        )}
                      </p>
                    </div>
                  </div>
                </RadioGroup>

                {/* Quantity summary */}
                <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Required</span>
                    <p className="font-semibold">
                      {formatQty(line.requiredQty)} {line.unitLabel}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Suggested Batch {suggestedSource ? `(${sourceLabel(suggestedSource)})` : ""}
                    </span>
                    <p className={`font-semibold ${suggestedAvail < line.requiredQty ? "text-amber-600 dark:text-amber-400" : ""}`}>
                      {formatQty(suggestedAvail)} avail.
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Next Batch {singleSource ? `(${sourceLabel(singleSource)})` : ""}
                    </span>
                    <p className="font-semibold">
                      {singleSource ? `${formatQty(singleAvail)} avail.` : "—"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with Cancel and Confirm */}
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Confirming..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
