"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getApiErrorCode } from "@/lib/api";
import {
  getWarehouseLocationDisplayName,
  getWarehouseLocationErrorMessageKey,
  warehouseLocationMutationErrorCodes,
} from "@/lib/warehouse-location-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeleteWarehouseLocationDialogProps = {
  location: { code: string; name?: string | null };
  isPending: boolean;
  onClose: () => void;
  onDelete: () => Promise<unknown>;
};

export function DeleteWarehouseLocationDialog({
  location,
  isPending,
  onClose,
  onDelete,
}: DeleteWarehouseLocationDialogProps) {
  const t = useTranslations("warehouseLocationsPage");
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const submit = async () => {
    if (isPending || submitting.current) return;
    submitting.current = true;
    setError(null);
    try {
      await onDelete();
    } catch (cause) {
      const code = getApiErrorCode(cause, warehouseLocationMutationErrorCodes);
      if (code === "LOCATION_IN_USE") {
        setError(t("deleteLocationInUse"));
      } else {
        setError(code ? t(getWarehouseLocationErrorMessageKey(code)) : t("deleteLocationError"));
      }
    } finally {
      submitting.current = false;
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("deleteLocationTitle", { location: getWarehouseLocationDisplayName(location) })}
          </DialogTitle>
          <DialogDescription>{t("deleteLocationDescription")}</DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={submit}>
            {isPending ? t("deletingLocation") : t("deleteLocation")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
