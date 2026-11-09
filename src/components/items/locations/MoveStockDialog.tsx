"use client";

import { useQuery } from "@tanstack/react-query";
import { ITEM_LOCATIONS_QUERY_KEY } from "@/hooks/queryKeys";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { apiClient } from "@/lib/api";
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
import type { ItemLocation } from "@/types/inventory-location";
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
import { useMoveStock } from "@/hooks/useMoveStock";
import { getApiErrorCode } from "@/lib/api";
import { stockMoveSchema } from "@/lib/validations/stock-move";
import { STOCK_MOVE_ERROR_CODES } from "@/types/stock-move";

type MoveStockDialogProps = {
  itemId: string;
  baseUnit: string;
  unitOptions: ItemUnitOption[];
  sourceLocations: ItemLocation[] | undefined;
  // Pre-fills the source when moving from a selected location.
  initialSource?: { warehouseId: string; locationId: string };
  onOpenChange: (open: boolean) => void;
};

export function MoveStockDialog({
  itemId,
  baseUnit,
  unitOptions,
  sourceLocations,
  initialSource,
  onOpenChange,
}: MoveStockDialogProps) {
  const t = useTranslations("itemLocationsTab");
  const moveStock = useMoveStock();
  const [sourceWarehouseId, setSourceWarehouseId] = useState(initialSource?.warehouseId ?? "");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [fromLocationId, setFromLocationId] = useState(initialSource?.locationId ?? "");
  const [toLocationId, setToLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitOptionId, setUnitOptionId] = useState("base");
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
  // Remove floating-point multiplication noise without rounding fractional base stock.
  const baseQuantity = Number((Number(quantity) * (conversionFactor ?? NaN)).toPrecision(15));
  const quantityIsValid =
    stockMoveSchema.shape.items.element.shape.quantity.safeParse(Number(quantity)).success &&
    stockMoveSchema.shape.items.element.shape.quantity.safeParse(baseQuantity).success;
  const businessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  const loadedSource = sourceLocations?.find(
    (location) =>
      location.itemId === itemId &&
      location.warehouseId === sourceWarehouseId &&
      location.locationId === fromLocationId
  );
  const sourceQuery = useQuery<{ data: ItemLocation[] }>({
    queryKey: [ITEM_LOCATIONS_QUERY_KEY, itemId, businessUnitId, "move-source", fromLocationId],
    queryFn: () =>
      apiClient.get(`/api/items/${itemId}/locations`, {
        params: { locationId: fromLocationId, limit: 1 },
      }),
    enabled: Boolean(fromLocationId && sourceWarehouseId && !loadedSource),
  });
  const sourceAvailable =
    loadedSource?.qtyAvailable ??
    (sourceQuery.data
      ? (sourceQuery.data.data.find(
          (location) =>
            location.warehouseId === sourceWarehouseId &&
            location.locationId === fromLocationId &&
            location.itemId === itemId
        )?.qtyAvailable ?? 0)
      : undefined);
  const hasSufficientStock =
    sourceAvailable !== undefined &&
    Number.isFinite(sourceAvailable) &&
    baseQuantity <= sourceAvailable;
  const payload = stockMoveSchema.safeParse({
    transactionType: "transfer",
    warehouseId: sourceWarehouseId,
    toWarehouseId: destinationWarehouseId,
    fromLocationId,
    toLocationId,
    transactionDate: format(new Date(), "yyyy-MM-dd"),
    items: [{ itemId, quantity: baseQuantity }],
  });

  const errorMessage = () => {
    switch (getApiErrorCode(moveStock.error, STOCK_MOVE_ERROR_CODES)) {
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
      case "STOCK_MOVE_INSUFFICIENT_STOCK":
        return t("moveInsufficientStock");
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
                moveStock.reset();
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
                moveStock.reset();
              }}
            />
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
              onChange={(event) => {
                setQuantity(event.target.value);
                moveStock.reset();
              }}
              placeholder={t("quantityPlaceholder")}
              aria-describedby="move-stock-quantity-help"
            />
            <p id="move-stock-quantity-help" className="text-sm text-muted-foreground">
              {t("moveQuantityHelp", { unit: baseUnit })}
            </p>
            {quantity && Number.isFinite(baseQuantity) ? (
              <p className="text-sm font-medium" aria-live="polite">
                {t("moveTotalQuantity", { quantity: baseQuantity, unit: baseUnit })}
              </p>
            ) : null}
            {fromLocationId && sourceAvailable !== undefined ? (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {t("moveSourceAvailable", { quantity: sourceAvailable, unit: baseUnit })}
              </p>
            ) : null}
            {fromLocationId && sourceAvailable === undefined ? (
              <p role="alert" className="text-sm text-destructive">
                {t("moveAvailabilityUnavailable")}
              </p>
            ) : null}
            {fromLocationId &&
            quantityIsValid &&
            sourceAvailable !== undefined &&
            !hasSufficientStock ? (
              <p role="alert" className="text-sm text-destructive">
                {t("moveInsufficientStock")}
              </p>
            ) : null}
            {quantity && !quantityIsValid ? (
              <p role="alert" className="text-sm text-destructive">
                {t("moveQuantityInvalid")}
              </p>
            ) : null}
          </div>
          {fromLocationId && fromLocationId === toLocationId ? (
            <p role="alert" className="text-sm text-destructive">
              {t("selectDifferentLocations")}
            </p>
          ) : null}
          {moveStock.error ? (
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
              moveStock.isPending || !quantityIsValid || !hasSufficientStock || !payload.success
            }
            onClick={() => {
              if (
                moveStock.isPending ||
                !quantityIsValid ||
                !hasSufficientStock ||
                !payload.success
              )
                return;
              moveStock.mutate(payload.data, {
                onSuccess: () => {
                  toast.success(t("stockMoved"));
                  onOpenChange(false);
                },
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
