"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FolderTree } from "lucide-react";
import { getApiErrorCode } from "@/lib/api";
import {
  WAREHOUSE_LOCATION_TYPES,
  WAREHOUSE_LOCATION_USES,
  getDefaultWarehouseLocationUse,
  getWarehouseLocationErrorMessageKey,
  getWarehouseLocationUseFlags,
  isWarehouseLocationType,
  warehouseLocationMutationErrorCodes,
  warehouseLocationTypeLabelKeys,
  warehouseLocationUseLabelKeys,
  type WarehouseLocationType,
  type WarehouseLocationUse,
} from "@/lib/warehouse-location-form";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useWarehouseLocationBatchPreview } from "@/hooks/useWarehouseLocationBatchPreview";
import type { WarehouseLocationOption } from "@/components/warehouses/WarehouseLocationSelect";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";
import type {
  WarehouseLocationBatchRange,
  WarehouseLocationBatchResult,
} from "@/types/inventory-location";

export type WarehouseLocationBatchRequest = WarehouseLocationBatchRange & {
  locationType: WarehouseLocationType;
  isStorable: boolean;
  isPickable: boolean;
  isActive: boolean;
  maxCapacity: number | null;
};

type AddMultipleWarehouseLocationsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  parent: WarehouseLocationOption | null;
  suggestedType: WarehouseLocationType | null;
  isSubmitting: boolean;
  onSubmit: (request: WarehouseLocationBatchRequest) => Promise<WarehouseLocationBatchResult>;
};

const MAX_BATCH_SIZE = 100;

const parseWholeNumber = (value: string) =>
  /^\d{1,6}$/.test(value.trim()) ? Number(value.trim()) : null;

export function AddMultipleWarehouseLocationsDialog({
  open,
  onOpenChange,
  warehouseId,
  parent,
  suggestedType,
  isSubmitting,
  onSubmit,
}: AddMultipleWarehouseLocationsDialogProps) {
  const t = useTranslations("warehouseLocationsPage");
  const initialType = suggestedType ?? "bin";
  const [locationType, setLocationType] = useState<WarehouseLocationType>(initialType);
  const [use, setUse] = useState<WarehouseLocationUse>(getDefaultWarehouseLocationUse(initialType));
  const [isUseChosen, setIsUseChosen] = useState(false);
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("10");
  const [namePrefix, setNamePrefix] = useState(
    `${t(warehouseLocationTypeLabelKeys[initialType])} `
  );
  const [isNamePrefixChosen, setIsNamePrefixChosen] = useState(false);
  const [maxCapacity, setMaxCapacity] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const fromNumber = parseWholeNumber(from);
  const toNumber = parseWholeNumber(to);
  const rangeError =
    fromNumber === null || toNumber === null
      ? t("batchRangeWholeNumbers")
      : toNumber < fromNumber || toNumber - fromNumber >= MAX_BATCH_SIZE
        ? t("batchRangeLimit", { max: MAX_BATCH_SIZE })
        : null;
  const isStorable = use !== "organizeOnly";
  const capacityValue = maxCapacity.trim();
  const capacityError =
    isStorable &&
    capacityValue &&
    (!Number.isFinite(Number(capacityValue)) || Number(capacityValue) <= 0)
      ? t("capacityPositive")
      : null;

  const range: WarehouseLocationBatchRange | null =
    rangeError || fromNumber === null || toNumber === null
      ? null
      : {
          parentId: parent?.id ?? null,
          locationType,
          from: fromNumber,
          to: toNumber,
          namePrefix: namePrefix.trim() ? namePrefix : null,
        };
  // Query only once typing settles; the key is a primitive so debouncing stays stable.
  const rangeKey = range ? JSON.stringify(range) : null;
  const isRangeSettled = useDebouncedValue(rangeKey, 300) === rangeKey;
  const preview = useWarehouseLocationBatchPreview(
    warehouseId,
    open && isRangeSettled ? range : null
  );
  const previewErrorCode = preview.error
    ? getApiErrorCode(preview.error, warehouseLocationMutationErrorCodes)
    : null;
  const rows = preview.data?.rows ?? [];
  const newCount = rows.length;
  const isPreviewCurrent =
    Boolean(range) && isRangeSettled && Boolean(preview.data) && !preview.isFetching;
  const canCreate = isPreviewCurrent && !preview.error && !capacityError && newCount > 0;

  const changeType = (value: string) => {
    if (!isWarehouseLocationType(value)) return;
    setLocationType(value);
    if (!isUseChosen) setUse(getDefaultWarehouseLocationUse(value));
    if (!isNamePrefixChosen) setNamePrefix(`${t(warehouseLocationTypeLabelKeys[value])} `);
  };

  const handleCreate = async () => {
    if (!range || !canCreate) return;
    setFormError(null);
    const flags = getWarehouseLocationUseFlags(use);
    try {
      await onSubmit({
        ...range,
        locationType,
        isStorable: flags.isStorable,
        isPickable: flags.isPickable,
        isActive,
        maxCapacity: flags.isStorable && capacityValue ? Number(capacityValue) : null,
      });
    } catch (createError) {
      const code = getApiErrorCode(createError, warehouseLocationMutationErrorCodes);
      setFormError(code ? t(getWarehouseLocationErrorMessageKey(code)) : t("batchCreateError"));
      void preview.refetch();
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {parent ? t("addMultipleSublocationsTitle") : t("addMultipleTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("addMultipleDescription", { max: MAX_BATCH_SIZE })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p id="batch-parent-label" className="text-sm font-medium leading-none">
              {t("insideLabel")}
            </p>
            <div
              role="group"
              aria-labelledby="batch-parent-label"
              className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2"
            >
              <FolderTree className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {parent?.locationPath || t("warehouseLevel")}
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="batch-type">{t("locationType")}</Label>
              <Select value={locationType} onValueChange={changeType}>
                <SelectTrigger id="batch-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_LOCATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(warehouseLocationTypeLabelKeys[type])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-use">{t("use")}</Label>
              <Select
                value={use}
                onValueChange={(value) => {
                  const nextUse = WAREHOUSE_LOCATION_USES.find((option) => option === value);
                  if (!nextUse) return;
                  setUse(nextUse);
                  setIsUseChosen(true);
                  if (nextUse === "organizeOnly") setMaxCapacity("");
                }}
              >
                <SelectTrigger id="batch-use">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_LOCATION_USES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(warehouseLocationUseLabelKeys[option])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <fieldset className="space-y-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">{t("batchNumbering")}</legend>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="batch-from">{t("batchFrom")}</Label>
                <Input
                  id="batch-from"
                  inputMode="numeric"
                  value={from}
                  aria-invalid={Boolean(rangeError)}
                  aria-describedby={rangeError ? "batch-range-error" : undefined}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-to">{t("batchTo")}</Label>
                <Input
                  id="batch-to"
                  inputMode="numeric"
                  value={to}
                  aria-invalid={Boolean(rangeError)}
                  aria-describedby={rangeError ? "batch-range-error" : undefined}
                  onChange={(event) => setTo(event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="batch-name-prefix">{t("batchNamePrefix")}</Label>
                <Input
                  id="batch-name-prefix"
                  value={namePrefix}
                  maxLength={190}
                  onChange={(event) => {
                    setNamePrefix(event.target.value);
                    setIsNamePrefixChosen(true);
                  }}
                />
              </div>
            </div>
            {rangeError ? (
              <p id="batch-range-error" className="text-sm text-destructive">
                {rangeError}
              </p>
            ) : null}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            {isStorable ? (
              <div className="space-y-2">
                <Label htmlFor="batch-capacity">{t("batchCapacityEach")}</Label>
                <Input
                  id="batch-capacity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  placeholder={t("maxCapacityPlaceholder")}
                  value={maxCapacity}
                  aria-invalid={Boolean(capacityError)}
                  aria-describedby={capacityError ? "batch-capacity-error" : undefined}
                  onChange={(event) => setMaxCapacity(event.target.value)}
                />
                {capacityError ? (
                  <p id="batch-capacity-error" className="text-sm text-destructive">
                    {capacityError}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="flex items-center gap-2 sm:pt-8">
              <Checkbox
                id="batch-active"
                checked={isActive}
                onCheckedChange={(value) => setIsActive(value === true)}
              />
              <Label htmlFor="batch-active" className="font-normal">
                {t("batchCreateActive")}
              </Label>
            </div>
          </div>

          <section aria-labelledby="batch-preview-title" className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id="batch-preview-title" className="text-sm font-medium">
                {t("batchPreview")}
              </h3>
              {isPreviewCurrent && rows.length > 0 ? (
                <p aria-live="polite" className="text-sm text-muted-foreground">
                  {t("batchPreviewSummary", { newCount })}
                </p>
              ) : null}
            </div>
            {previewErrorCode ? (
              <p className="text-sm text-destructive">
                {t(getWarehouseLocationErrorMessageKey(previewErrorCode))}
              </p>
            ) : preview.error ? (
              <p className="text-sm text-destructive">{t("batchPreviewError")}</p>
            ) : !range ? null : !isPreviewCurrent ? (
              <div className="space-y-2" aria-busy="true">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <>
                <div className="max-h-64 overflow-y-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">{t("code")}</th>
                        <th className="px-3 py-2 font-medium">{t("name")}</th>
                        <th className="px-3 py-2 font-medium">{t("addressPreview")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={index} className="border-t">
                          <td className="whitespace-nowrap px-3 py-1.5 font-medium">{row.code}</td>
                          <td className="whitespace-nowrap px-3 py-1.5">{row.name ?? "—"}</td>
                          <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
                            {row.locationPath}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

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
            disabled={!canCreate || isSubmitting}
            onClick={() => void handleCreate()}
          >
            {isSubmitting
              ? t("saving")
              : t("batchCreateButton", { count: isPreviewCurrent ? newCount : 0 })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
