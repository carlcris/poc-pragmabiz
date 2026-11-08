"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { getApiErrorCode } from "@/lib/api";
import {
  getWarehouseLocationErrorMessageKey,
  incrementTrailingNumber,
  isWarehouseLocationType,
  warehouseLocationMutationErrorCodes,
  warehouseLocationTypeLabelKeys,
} from "@/lib/warehouse-location-form";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useWarehouseLocationCopyPreview } from "@/hooks/useWarehouseLocationCopyPreview";
import {
  WarehouseLocationSelect,
  type WarehouseLocationOption,
} from "@/components/warehouses/WarehouseLocationSelect";
import { WarehouseLocationBrowseButton } from "@/components/warehouses/WarehouseLocationBrowseButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import type {
  WarehouseLocationCopyRequest,
  WarehouseLocationCopyResult,
} from "@/types/inventory-location";

type CopyWarehouseLocationStructureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  warehouseLabel: string;
  source: { id: string; code: string; name?: string | null; parentId?: string | null };
  isSubmitting: boolean;
  onSubmit: (request: WarehouseLocationCopyRequest) => Promise<WarehouseLocationCopyResult>;
};

const INDENT_REM = 1;

export function CopyWarehouseLocationStructureDialog({
  open,
  onOpenChange,
  warehouseId,
  warehouseLabel,
  source,
  isSubmitting,
  onSubmit,
}: CopyWarehouseLocationStructureDialogProps) {
  const t = useTranslations("warehouseLocationsPage");
  const [destinationId, setDestinationId] = useState(source.parentId ?? "");
  const [destination, setDestination] = useState<WarehouseLocationOption | null>(null);
  const [nameFind, setNameFind] = useState(source.name ?? "");
  const [nameReplace, setNameReplace] = useState(incrementTrailingNumber(source.name ?? ""));
  const [formError, setFormError] = useState<string | null>(null);

  const request: WarehouseLocationCopyRequest = {
    destinationParentId: destinationId || null,
    nameFind: nameFind.trim() ? nameFind : null,
    nameReplace: nameFind.trim() ? nameReplace : null,
  };
  // Query only once typing settles; the key is a primitive so debouncing stays stable.
  const requestKey = request ? JSON.stringify(request) : null;
  const isRequestSettled = useDebouncedValue(requestKey, 300) === requestKey;
  const preview = useWarehouseLocationCopyPreview(
    warehouseId,
    source.id,
    open && isRequestSettled ? request : null
  );
  const previewErrorCode = preview.error
    ? getApiErrorCode(preview.error, warehouseLocationMutationErrorCodes)
    : null;
  const rows = preview.data?.rows ?? [];
  const isPreviewCurrent =
    Boolean(request) && isRequestSettled && Boolean(preview.data) && !preview.isFetching;
  const canCopy = isPreviewCurrent && !preview.error && rows.length > 0;

  const handleCopy = async () => {
    if (!request || !canCopy) return;
    setFormError(null);
    try {
      await onSubmit(request);
    } catch (copyError) {
      const code = getApiErrorCode(copyError, warehouseLocationMutationErrorCodes);
      setFormError(code ? t(getWarehouseLocationErrorMessageKey(code)) : t("copyError"));
      void preview.refetch();
      return;
    }
    onOpenChange(false);
  };

  const sourceLabel = source.name ? `${source.code} · ${source.name}` : source.code;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("copyTitle", { location: sourceLabel })}</DialogTitle>
          <DialogDescription>{t("copyDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="copy-destination">{t("copyInto")}</Label>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <WarehouseLocationSelect
                  warehouseId={warehouseId}
                  value={destinationId}
                  selectedOption={destination}
                  onValueChange={(value) => {
                    setDestinationId(value);
                    if (!value) setDestination(null);
                    setFormError(null);
                  }}
                  onOptionChange={setDestination}
                  excludeSubtreeId={source.id}
                  allowNone
                  noneLabel={t("warehouseLevel")}
                  triggerId="copy-destination"
                  describedBy="copy-destination-help"
                  buttonClassName="w-full"
                />
              </div>
              <WarehouseLocationBrowseButton
                warehouseId={warehouseId}
                warehouseLabel={warehouseLabel}
                value={destinationId}
                disabledId={source.id}
                onPick={(locationId) => {
                  setDestinationId(locationId);
                  setDestination(null);
                  setFormError(null);
                }}
              />
            </div>
            <p id="copy-destination-help" className="text-xs text-muted-foreground">
              {t("copyDestinationHelp")}
            </p>
          </div>

          <fieldset className="space-y-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">{t("copyRename")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="copy-name-find">{t("copyNameFind")}</Label>
                <Input
                  id="copy-name-find"
                  value={nameFind}
                  maxLength={200}
                  onChange={(event) => setNameFind(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="copy-name-replace">{t("copyNameReplace")}</Label>
                <Input
                  id="copy-name-replace"
                  value={nameReplace}
                  maxLength={200}
                  disabled={!nameFind.trim()}
                  onChange={(event) => setNameReplace(event.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("copyRenameHelp")}</p>
          </fieldset>

          <section aria-labelledby="copy-preview-title" className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id="copy-preview-title" className="text-sm font-medium">
                {t("batchPreview")}
              </h3>
              {isPreviewCurrent && rows.length > 0 ? (
                <p aria-live="polite" className="text-sm text-muted-foreground">
                  {t("copyPreviewSummary", { count: rows.length })}
                </p>
              ) : null}
            </div>
            {previewErrorCode ? (
              <p className="text-sm text-destructive">
                {t(getWarehouseLocationErrorMessageKey(previewErrorCode))}
              </p>
            ) : preview.error ? (
              <p className="text-sm text-destructive">{t("copyPreviewError")}</p>
            ) : !isPreviewCurrent ? (
              <div className="space-y-2" aria-busy="true">
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("code")}</th>
                      <th className="px-3 py-2 font-medium">{t("type")}</th>
                      <th className="px-3 py-2 font-medium">{t("addressPreview")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.sourceId} className="border-t">
                        <td
                          className="whitespace-nowrap px-3 py-1.5 font-medium"
                          style={{ paddingLeft: `${0.75 + row.depth * INDENT_REM}rem` }}
                        >
                          {row.code}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5">
                          {isWarehouseLocationType(row.locationType)
                            ? t(warehouseLocationTypeLabelKeys[row.locationType])
                            : row.locationType}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
                          {row.locationPath}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="text-xs text-muted-foreground">{t("copyNotCopied")}</p>

          {formError ? (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter className="items-center gap-2">
          <p className="mr-auto text-xs text-muted-foreground">{t("batchAllOrNothing")}</p>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={!canCopy || isSubmitting}
            onClick={() => void handleCopy()}
          >
            {isSubmitting
              ? t("saving")
              : t("copyButton", { count: isPreviewCurrent ? rows.length : 0 })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
