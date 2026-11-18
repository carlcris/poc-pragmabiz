"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ItemUnitOption } from "@/types/item";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WarehouseSelect } from "@/components/warehouses/WarehouseSelect";
import { WarehouseLocationSelect } from "@/components/warehouses/WarehouseLocationSelect";
import { MoveStockBatchChecklist } from "@/components/items/locations/MoveStockBatchChecklist";
import { useMoveStock } from "@/hooks/useMoveStock";
import { useMoveStockSourceAvailability } from "@/hooks/useMoveStockSourceAvailability";
import { moveStockSourceBatchesKey } from "@/hooks/useMoveStockSourceBatches";
import { getApiErrorCode } from "@/lib/api";
import { stockMoveSchema } from "@/lib/validations/stock-move";
import {
  countSelectedBatches,
  emptyBatchSelection,
  hasBatchSelection,
  toggleAllBatches,
  toggleBatch,
} from "@/lib/stock-move-batch-selection";
import { MAX_STOCK_MOVE_BATCH_SELECTION, STOCK_MOVE_ERROR_CODES } from "@/types/stock-move";

// A numeric draft that is not yet a number: "", "-", ".", "-." or a trailing
// dot such as "1.". The shared Input swallows exactly these before calling
// `onChange`, so the dialog reads them off the DOM event instead.
const INCOMPLETE_QUANTITY = /^-?(?:\d*\.)?$/;

type MoveStockDialogProps = {
  itemId: string;
  baseUnit: string;
  unitOptions: ItemUnitOption[];
  // Pre-fills the source when moving from a selected location.
  initialSource?: { warehouseId: string; locationId: string };
  onOpenChange: (open: boolean) => void;
};

export function MoveStockDialog({
  itemId,
  baseUnit,
  unitOptions,
  initialSource,
  onOpenChange,
}: MoveStockDialogProps) {
  const t = useTranslations("itemLocationsTab");
  const moveStock = useMoveStock();
  const [sourceWarehouseId, setSourceWarehouseId] = useState(initialSource?.warehouseId ?? "");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [fromLocationId, setFromLocationId] = useState(initialSource?.locationId ?? "");
  const [toLocationId, setToLocationId] = useState("");
  // `null` means the quantity follows the checked batches automatically; any
  // string, including "", is a value the user typed and must be honoured
  // verbatim so a deliberately erased field never moves the whole balance.
  const [quantityDraft, setQuantityDraft] = useState<string | null>(null);
  const [unitOptionId, setUnitOptionId] = useState("base");
  const [batchSelection, setBatchSelection] = useState(emptyBatchSelection);
  const alternateUnits = unitOptions.filter(
    (option) =>
      !option.isBase &&
      option.isActive &&
      Number.isFinite(option.qtyPerUnit) &&
      option.qtyPerUnit > 0
  );
  const conversionFactor =
    unitOptionId === "base"
      ? 1
      : alternateUnits.find((option) => option.id === unitOptionId)?.qtyPerUnit;
  const businessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  const [selectionBusinessUnitId, setSelectionBusinessUnitId] = useState(businessUnitId);
  const queryClient = useQueryClient();
  // Switching business unit rescopes the warehouses, so batch selections made in
  // the previous unit must not survive into a move they no longer describe.
  if (selectionBusinessUnitId !== businessUnitId) {
    setSelectionBusinessUnitId(businessUnitId);
    setSourceWarehouseId("");
    setDestinationWarehouseId("");
    setFromLocationId("");
    setToLocationId("");
    setBatchSelection(emptyBatchSelection);
    setQuantityDraft(null);
    setUnitOptionId("base");
  }
  const source = {
    itemId,
    businessUnitId,
    warehouseId: sourceWarehouseId,
    locationId: fromLocationId,
  };
  const availabilityQuery = useMoveStockSourceAvailability(source, batchSelection);
  const isCheckingAvailability = availabilityQuery.fetchStatus !== "idle";
  const availability = availabilityQuery.isError ? undefined : availabilityQuery.data;
  const sourceAvailable = availability?.availableQuantity;
  const namedAvailability = availability
    ? new Map([
        ...batchSelection.batchLocationIds.map((id) => [id, 0] as const),
        ...availability.namedBatches.map(({ id, qtyAvailable }) => [id, qtyAvailable] as const),
      ])
    : undefined;
  const unavailableCheckedIds =
    batchSelection.mode === "include" && namedAvailability
      ? batchSelection.batchLocationIds.filter((id) => namedAvailability.get(id) === 0)
      : [];
  const batchIsSelected = hasBatchSelection(batchSelection);
  const namedBatchCount = countSelectedBatches(batchSelection);
  const selectionExceedsLimit = namedBatchCount > MAX_STOCK_MOVE_BATCH_SELECTION;
  // Until the user types, the field auto-fills with the checked balance so the
  // amount shown is always the amount submitted. The auto value only exists in
  // the base unit: an alternate unit has no unambiguous equivalent, so the user
  // must state the quantity in that unit instead.
  const autoQuantity =
    unitOptionId === "base" && sourceAvailable !== undefined && sourceAvailable > 0
      ? String(sourceAvailable)
      : "";
  const quantity = quantityDraft ?? autoQuantity;
  const quantityRule = stockMoveSchema.shape.items.element.shape.quantity;
  // Remove floating-point multiplication noise without rounding fractional base stock.
  const baseQuantity = Number((Number(quantity) * (conversionFactor ?? NaN)).toPrecision(15));
  // The shown value and the converted base value are both checked, so the
  // submitted amount is exactly the one rendered in the field and the preview.
  // `Number("")`, `Number("-")` and `Number("1.")` all coerce to a number the
  // rule would accept or reject for the wrong reason, so an unfinished draft is
  // rejected as text before any coercion happens.
  const quantityIsValid =
    !INCOMPLETE_QUANTITY.test(quantity) &&
    quantityRule.safeParse(Number(quantity)).success &&
    quantityRule.safeParse(baseQuantity).success;
  const hasSufficientStock =
    !isCheckingAvailability &&
    unavailableCheckedIds.length === 0 &&
    sourceAvailable !== undefined &&
    Number.isFinite(sourceAvailable) &&
    quantityIsValid &&
    baseQuantity <= sourceAvailable;
  const payload = stockMoveSchema.safeParse({
    transactionType: "transfer",
    warehouseId: sourceWarehouseId,
    toWarehouseId: destinationWarehouseId,
    fromLocationId,
    toLocationId,
    transactionDate: format(new Date(), "yyyy-MM-dd"),
    items: [
      {
        itemId,
        batchSelection,
        quantity: baseQuantity,
      },
    ],
  });

  // Source changes invalidate the batch selection and any quantity derived from
  // it, so a move never silently retargets batches the user never saw.
  const resetSourceSelection = () => {
    setBatchSelection(emptyBatchSelection);
    setQuantityDraft(null);
    setUnitOptionId("base");
    moveStock.reset();
  };
  // Checking or unchecking one batch only re-derives an auto quantity. A typed
  // amount, including a deliberately emptied field, is the user's and survives.
  const changeBatchSelection = (next: typeof batchSelection) => {
    setBatchSelection(next);
    moveStock.reset();
  };

  // A known positive balance that the quantity rule rejects (too many decimal
  // places, or above the maximum) cannot be moved in one transfer. This is
  // about the balance itself, so it must not fire for a whole-payload failure
  // such as an unset or identical destination, or a selection over the cap.
  const unmovableFullAvailability =
    quantityDraft === null &&
    batchIsSelected &&
    sourceAvailable !== undefined &&
    sourceAvailable > 0 &&
    !quantityRule.safeParse(sourceAvailable).success
      ? sourceAvailable
      : undefined;
  const quantityBlocksSubmission = !quantityIsValid && unmovableFullAvailability === undefined;

  const errorCode = getApiErrorCode(moveStock.error, STOCK_MOVE_ERROR_CODES);
  // The availability query follows named IDs across pages. Invalidate the same
  // source prefix for it and the batch pages, without changing the selection.
  const refreshStaleBatchChoices = (error: unknown) => {
    const code = getApiErrorCode(error, STOCK_MOVE_ERROR_CODES);
    if (code !== "STOCK_MOVE_BATCH_UNAVAILABLE" && code !== "STOCK_MOVE_INSUFFICIENT_STOCK") return;
    void queryClient.invalidateQueries({ queryKey: moveStockSourceBatchesKey(source) });
  };

  const errorMessage = () => {
    switch (errorCode) {
      case "STOCK_MOVE_UNAUTHORIZED":
        return t("moveUnauthorized");
      case "STOCK_MOVE_FORBIDDEN":
        return t("moveForbidden");
      case "STOCK_MOVE_CONTEXT_INVALID":
        return t("moveContextInvalid");
      case "STOCK_MOVE_DETAILS_INVALID":
        return t("moveDetailsInvalid");
      case "STOCK_MOVE_WAREHOUSE_INVALID":
        return t("moveWarehouseInvalid");
      case "STOCK_MOVE_LOCATION_INVALID":
        return t("moveLocationInvalid");
      case "STOCK_MOVE_ITEM_UNAVAILABLE":
        return t("moveItemUnavailable");
      case "STOCK_MOVE_BATCH_UNAVAILABLE":
        return t("moveBatchUnavailable");
      case "STOCK_MOVE_INSUFFICIENT_STOCK":
        return batchSelection.mode === "include"
          ? t("moveBatchInsufficientStock")
          : t("moveInsufficientStock");
      case "STOCK_MOVE_DESTINATION_UNAVAILABLE":
        return t("moveDestinationUnavailable");
      case "STOCK_MOVE_BATCH_CONFLICT":
        return t("moveBatchConflict");
      default:
        return t("moveStockError");
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!moveStock.isPending) onOpenChange(open);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("moveDialogTitle")}</DialogTitle>
          <DialogDescription>{t("moveDialogDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("sourceWarehouseLabel")}</legend>
            <WarehouseSelect
              scope="current_business_unit"
              value={sourceWarehouseId}
              disabled={moveStock.isPending}
              onValueChange={(id) => {
                setSourceWarehouseId(id);
                setFromLocationId("");
                resetSourceSelection();
              }}
            />
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("fromLocationLabel")}</legend>
            <WarehouseLocationSelect
              key={sourceWarehouseId}
              warehouseId={sourceWarehouseId}
              itemId={itemId}
              value={fromLocationId}
              storableOnly
              disabled={moveStock.isPending}
              onValueChange={(id) => {
                setFromLocationId(id);
                resetSourceSelection();
              }}
            />
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("moveBatchLabel")}</legend>
            <MoveStockBatchChecklist
              itemId={itemId}
              businessUnitId={businessUnitId}
              warehouseId={sourceWarehouseId}
              locationId={fromLocationId}
              baseUnit={baseUnit}
              selection={batchSelection}
              namedAvailability={namedAvailability}
              onToggleBatch={(id, checked) =>
                changeBatchSelection(toggleBatch(batchSelection, id, checked))
              }
              onToggleAll={(checked: boolean) => changeBatchSelection(toggleAllBatches(checked))}
              disabled={moveStock.isPending || !fromLocationId}
              listId="move-stock-batches"
            />
            <p className="text-sm text-muted-foreground">
              {batchSelection.mode === "exclude"
                ? t("moveAllBatchesHelp")
                : t("moveSelectedBatchesHelp")}
            </p>
            {selectionExceedsLimit ? (
              <p role="alert" className="text-sm text-destructive">
                {t("moveBatchLimitExceeded", { limit: MAX_STOCK_MOVE_BATCH_SELECTION })}
              </p>
            ) : null}
            {unavailableCheckedIds.length > 0 && !isCheckingAvailability ? (
              <div className="flex flex-wrap items-center gap-2">
                <p role="alert" className="text-sm text-destructive">
                  {t("moveBatchUnavailable")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={moveStock.isPending}
                  onClick={() =>
                    changeBatchSelection({
                      ...batchSelection,
                      batchLocationIds: batchSelection.batchLocationIds.filter(
                        (id) => namedAvailability?.get(id) !== 0
                      ),
                    })
                  }
                >
                  {t("moveRemoveUnavailableBatches")}
                </Button>
              </div>
            ) : null}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("destinationWarehouseLabel")}</legend>
            <WarehouseSelect
              scope="current_business_unit"
              value={destinationWarehouseId}
              disabled={moveStock.isPending}
              onValueChange={(id) => {
                setDestinationWarehouseId(id);
                setToLocationId("");
                moveStock.reset();
              }}
            />
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("toLocationLabel")}</legend>
            <WarehouseLocationSelect
              key={destinationWarehouseId}
              warehouseId={destinationWarehouseId}
              value={toLocationId}
              storableOnly
              disabled={moveStock.isPending}
              onValueChange={(id) => {
                setToLocationId(id);
                moveStock.reset();
              }}
            />
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="move-stock-unit">{t("moveUnitLabel")}</Label>
            <Select
              value={unitOptionId}
              disabled={moveStock.isPending}
              onValueChange={(value) => {
                setUnitOptionId(value);
                // An auto base quantity has no unambiguous equivalent in an
                // alternate unit, so the field stays on auto and simply empties
                // until the user states the amount in the unit they picked.
                moveStock.reset();
              }}
            >
              <SelectTrigger id="move-stock-unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="base">{baseUnit}</SelectItem>
                {alternateUnits.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.displayLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="move-stock-quantity">{t("quantityLabel")}</Label>
            <Input
              id="move-stock-quantity"
              type="number"
              min="0.01"
              step="0.01"
              max="1000000000"
              value={quantity}
              disabled={moveStock.isPending}
              // The shared Input keeps an unfinished numeric draft in its own
              // display state and never calls `onChange` for it, which would
              // leave an emptied field still submitting its previous amount.
              // `onInput` is forwarded untouched, so the draft is captured here
              // and `onChange` still owns every completed numeric value.
              onInput={(event) => {
                const draft = event.currentTarget.value;
                if (!INCOMPLETE_QUANTITY.test(draft)) return;
                setQuantityDraft(draft);
                moveStock.reset();
              }}
              onChange={(event) => {
                setQuantityDraft(event.target.value);
                moveStock.reset();
              }}
              placeholder={t("quantityPlaceholder")}
              aria-describedby="move-stock-quantity-help"
            />
            <p id="move-stock-quantity-help" className="text-sm text-muted-foreground">
              {t("moveQuantityHelp", { unit: baseUnit })}
            </p>
            {!INCOMPLETE_QUANTITY.test(quantity) && Number.isFinite(baseQuantity) ? (
              <p className="text-sm font-medium" aria-live="polite">
                {t("moveTotalQuantity", { quantity: baseQuantity, unit: baseUnit })}
              </p>
            ) : null}
            {fromLocationId && batchIsSelected && sourceAvailable !== undefined ? (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {batchSelection.mode === "include"
                  ? t("moveSelectedBatchesAvailable", {
                      count: namedBatchCount,
                      quantity: sourceAvailable,
                      unit: baseUnit,
                    })
                  : t("moveSourceAvailable", { quantity: sourceAvailable, unit: baseUnit })}
              </p>
            ) : null}
            {batchIsSelected && isCheckingAvailability ? (
              <p role="status" className="text-sm text-muted-foreground">
                {t("moveAvailabilityLoading")}
              </p>
            ) : null}
            {fromLocationId &&
            batchIsSelected &&
            !selectionExceedsLimit &&
            !isCheckingAvailability &&
            sourceAvailable === undefined ? (
              <div className="flex flex-wrap items-center gap-2">
                <p role="alert" className="text-sm text-destructive">
                  {t("moveAvailabilityUnavailable")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void availabilityQuery.refetch()}
                >
                  {t("moveBatchesRetry")}
                </Button>
              </div>
            ) : null}
            {fromLocationId && !batchIsSelected ? (
              <p role="alert" className="text-sm text-destructive">
                {t("moveBatchSelectionRequired")}
              </p>
            ) : null}
            {fromLocationId &&
            batchIsSelected &&
            quantityIsValid &&
            sourceAvailable !== undefined &&
            !isCheckingAvailability &&
            baseQuantity > sourceAvailable ? (
              <p role="alert" className="text-sm text-destructive">
                {batchSelection.mode === "include"
                  ? t("moveBatchInsufficientStock")
                  : t("moveInsufficientStock")}
              </p>
            ) : null}
            {/* Only complain about the amount once there is something to move;
                an untouched dialog has no quantity to be wrong about yet. */}
            {quantityBlocksSubmission &&
            batchIsSelected &&
            sourceAvailable !== undefined &&
            !isCheckingAvailability ? (
              <p role="alert" className="text-sm text-destructive">
                {t("moveStockQuantityInvalid")}
              </p>
            ) : null}
            {unmovableFullAvailability !== undefined ? (
              <p role="alert" className="text-sm text-destructive">
                {t("moveFullAvailabilityNotMovable", {
                  quantity: unmovableFullAvailability,
                  unit: baseUnit,
                })}
              </p>
            ) : null}
          </div>
          {fromLocationId && fromLocationId === toLocationId ? (
            <p role="alert" className="text-sm text-destructive">
              {t("selectDifferentLocations")}
            </p>
          ) : null}
          {moveStock.error &&
          !(errorCode === "STOCK_MOVE_BATCH_UNAVAILABLE" && unavailableCheckedIds.length > 0) ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage()}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={moveStock.isPending}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            disabled={
              moveStock.isPending ||
              !batchIsSelected ||
              selectionExceedsLimit ||
              quantityBlocksSubmission ||
              !hasSufficientStock ||
              !payload.success
            }
            onClick={() => {
              if (
                moveStock.isPending ||
                !batchIsSelected ||
                selectionExceedsLimit ||
                quantityBlocksSubmission ||
                !hasSufficientStock ||
                !payload.success
              )
                return;
              moveStock.mutate(payload.data, {
                onSuccess: () => {
                  toast.success(t("stockMoved"));
                  onOpenChange(false);
                },
                onError: refreshStaleBatchChoices,
              });
            }}
          >
            {moveStock.isPending ? t("moving") : t("moveStock")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
