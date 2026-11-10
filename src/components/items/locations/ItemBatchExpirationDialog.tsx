"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useUpdateItemBatchExpiration } from "@/hooks/useUpdateItemBatchExpiration";
import { getApiErrorCode } from "@/lib/api";
import {
  itemBatchExpirationSchema,
  ITEM_BATCH_EXPIRATION_ERROR_CODES,
} from "@/lib/item-batch-expiration";
import type { ItemLocationBatch } from "@/types/inventory-location";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ItemBatchExpirationDialog({
  itemId,
  batch,
  onClose,
}: {
  itemId: string;
  batch: ItemLocationBatch;
  onClose: () => void;
}) {
  const t = useTranslations("itemLocationsTab");
  const common = useTranslations("common");
  const [date, setDate] = useState(batch.expirationDate || "");
  const [error, setError] = useState("");
  const mutation = useUpdateItemBatchExpiration(itemId);
  const save = async () => {
    setError("");
    const payload = itemBatchExpirationSchema.safeParse({ expirationDate: date || null });
    if (!payload.success) {
      setError(t("expirationInvalid"));
      return;
    }
    try {
      await mutation.mutateAsync({ batchLocationId: batch.id, ...payload.data });
      onClose();
    } catch (failure) {
      const code = getApiErrorCode(failure, ITEM_BATCH_EXPIRATION_ERROR_CODES);
      setError(
        code === "BATCH_EXPIRATION_INVALID"
          ? t("expirationInvalid")
          : code === "BATCH_EXPIRATION_NOT_FOUND"
            ? t("expirationNotFound")
            : code === "BATCH_EXPIRATION_FORBIDDEN"
              ? t("expirationForbidden")
              : t("expirationSaveFailed")
      );
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("editExpiration")}</DialogTitle>
          <DialogDescription>
            {t("expirationBatchDescription", { batch: batch.batchCode })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="batch-expiration-date">{t("expirationDate")}</Label>
          <Input
            id="batch-expiration-date"
            type="date"
            value={date}
            disabled={mutation.isPending}
            onChange={(event) => {
              setDate(event.target.value);
              setError("");
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending || !date}
            onClick={() => {
              setDate("");
              setError("");
            }}
          >
            {t("clearExpiration")}
          </Button>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
            {common("cancel")}
          </Button>
          <Button disabled={mutation.isPending} onClick={save}>
            {common("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
