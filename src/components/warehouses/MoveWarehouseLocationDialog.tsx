"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { getApiErrorCode } from "@/lib/api";
import {
  getWarehouseLocationErrorField,
  getWarehouseLocationErrorMessageKey,
  warehouseLocationMutationErrorCodes,
} from "@/lib/warehouse-location-form";
import { getWarehouseLocationRestrictions } from "@/lib/warehouse-location-restrictions";
import { useWarehouseLocationDetail } from "@/hooks/useWarehouseLocationDetail";
import {
  WarehouseLocationSelect,
  type WarehouseLocationOption,
} from "@/components/warehouses/WarehouseLocationSelect";
import { WarehouseLocationBrowseButton } from "@/components/warehouses/WarehouseLocationBrowseButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type MoveWarehouseLocationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  warehouseLabel: string;
  location: { id: string; code: string; name?: string | null };
  isSubmitting: boolean;
  onSubmit: (parentId: string | null) => Promise<unknown>;
};

export function MoveWarehouseLocationDialog({
  open,
  onOpenChange,
  warehouseId,
  warehouseLabel,
  location,
  isSubmitting,
  onSubmit,
}: MoveWarehouseLocationDialogProps) {
  const t = useTranslations("warehouseLocationsPage");
  const format = useFormatter();
  const { data: detail, isLoading, error } = useWarehouseLocationDetail(warehouseId, location.id);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [destination, setDestination] = useState<WarehouseLocationOption | null>(null);
  const [parentError, setParentError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const currentParentId = detail?.parentId ?? "";
  const selectedParentId = destinationId ?? currentParentId;
  const restrictions = detail ? getWarehouseLocationRestrictions(detail) : null;
  const isBlocked = Boolean(restrictions?.move);
  const isUnchanged = selectedParentId === currentParentId;
  const isDestinationResolved =
    !selectedParentId ||
    (destination?.id === selectedParentId && Boolean(destination.locationPath));
  const newAddress =
    detail && !isUnchanged && isDestinationResolved
      ? `${selectedParentId ? destination?.locationNamePath || destination?.name || destination?.code : warehouseLabel} / ${detail.name || detail.code}`
      : null;
  const quantity = (value: number) => format.number(value, { maximumFractionDigits: 2 });

  const handleMove = async () => {
    setParentError(null);
    setFormError(null);
    try {
      await onSubmit(selectedParentId || null);
    } catch (moveError) {
      const code = getApiErrorCode(moveError, warehouseLocationMutationErrorCodes);
      const message = code ? t(getWarehouseLocationErrorMessageKey(code)) : t("moveError");
      if (code && getWarehouseLocationErrorField(code) === "parent") setParentError(message);
      else setFormError(message);
      return;
    }
    onOpenChange(false);
  };

  const title = location.name ? `${location.code} · ${location.name}` : location.code;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-dvh overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("moveTitle", { location: title })}</DialogTitle>
          <DialogDescription>{t("moveDescription")}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error || !detail ? (
          <Alert variant="destructive">
            <AlertDescription>{t("locationNotFound")}</AlertDescription>
          </Alert>
        ) : isBlocked ? (
          <Alert role="status" className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
            <AlertTitle>{t("moveBlockedTitle")}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{t("moveBlockedDescription")}</p>
              <ul className="list-disc space-y-1 pl-5">
                {detail.subtreeOnHand > 0 ? (
                  <li>
                    {t("blockedOnHand", {
                      quantity: quantity(detail.subtreeOnHand),
                      count: detail.stockedLocationCount,
                    })}
                  </li>
                ) : null}
                {detail.subtreeReserved > 0 ? (
                  <li>{t("blockedReserved", { quantity: quantity(detail.subtreeReserved) })}</li>
                ) : null}
                {detail.subtreePendingPutaway > 0 ? (
                  <li>{t("blockedPutaway", { count: detail.subtreePendingPutaway })}</li>
                ) : null}
              </ul>
              <p>{t("blockedAlternative")}</p>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="move-location-parent">{t("moveInto")}</Label>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <WarehouseLocationSelect
                    buttonClassName="w-full"
                    warehouseId={warehouseId}
                    value={selectedParentId}
                    selectedOption={destination}
                    onValueChange={(value) => {
                      setDestinationId(value);
                      if (!value) setDestination(null);
                      setParentError(null);
                      setFormError(null);
                    }}
                    onOptionChange={setDestination}
                    excludeSubtreeId={location.id}
                    allowNone
                    noneLabel={t("warehouseLevel")}
                    triggerId="move-location-parent"
                    invalid={Boolean(parentError)}
                    describedBy={
                      parentError ? "move-location-parent-error" : "move-location-parent-help"
                    }
                  />
                </div>
                <WarehouseLocationBrowseButton
                  warehouseId={warehouseId}
                  warehouseLabel={warehouseLabel}
                  value={selectedParentId}
                  disabledId={location.id}
                  onPick={(locationId) => {
                    setDestinationId(locationId);
                    setDestination(null);
                    setParentError(null);
                    setFormError(null);
                  }}
                />
              </div>
              {parentError ? (
                <p id="move-location-parent-error" className="text-sm text-destructive">
                  {parentError}
                </p>
              ) : (
                <p id="move-location-parent-help" className="text-xs text-muted-foreground">
                  {t("moveExcludedHelp")}
                </p>
              )}
            </div>
            <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">{t("addressPreview")}</p>
              <p
                className={
                  newAddress
                    ? "break-words font-mono text-muted-foreground line-through"
                    : "break-words font-mono"
                }
              >
                {detail.locationPath}
              </p>
              {newAddress ? (
                <p aria-live="polite" className="break-words font-mono">
                  {newAddress}
                </p>
              ) : null}
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>{t("moveSublocationsImpact", { count: detail.descendantCount })}</li>
              <li>{t("moveStockUnchanged")}</li>
            </ul>
            {formError ? (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {isBlocked ? t("close") : t("cancel")}
          </Button>
          {isBlocked ? null : (
            <Button
              type="button"
              disabled={!detail || isUnchanged || isSubmitting}
              onClick={() => void handleMove()}
            >
              {isSubmitting ? t("saving") : t("moveSubmit")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
