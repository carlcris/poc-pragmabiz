"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  onOpenChange: (open: boolean) => void;
};

export function MoveStockDialog({ itemId, baseUnit, onOpenChange }: MoveStockDialogProps) {
  const t = useTranslations("itemLocationsTab");
  const moveStock = useMoveStock();
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const quantityIsValid = stockMoveSchema.shape.items.element.shape.quantity.safeParse(
    Number(quantity)
  ).success;
  const payload = stockMoveSchema.safeParse({
    transactionType: "transfer",
    warehouseId: sourceWarehouseId,
    toWarehouseId: destinationWarehouseId,
    fromLocationId,
    toLocationId,
    transactionDate: format(new Date(), "yyyy-MM-dd"),
    items: [{ itemId, quantity: Number(quantity) }],
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
            {quantity && !quantityIsValid ? (
              <p role="alert" className="text-sm text-destructive">
                {t("enterValidQuantity")}
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
            disabled={moveStock.isPending || !payload.success}
            onClick={() => {
              if (!payload.success) return;
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
