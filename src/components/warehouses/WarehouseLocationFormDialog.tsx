"use client";

import { type FormEvent, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FolderTree } from "lucide-react";
import { getApiErrorCode } from "@/lib/api";
import {
  WAREHOUSE_LOCATION_TYPES,
  WAREHOUSE_LOCATION_USES,
  formatWarehouseLocationAddress,
  getDefaultWarehouseLocationUse,
  getWarehouseLocationErrorField,
  getWarehouseLocationErrorMessageKey,
  getWarehouseLocationUse,
  getWarehouseLocationUseFlags,
  incrementTrailingNumber,
  isWarehouseLocationType,
  warehouseLocationMutationErrorCodes,
  warehouseLocationTypeLabelKeys,
  warehouseLocationUseHelpKeys,
  warehouseLocationUseLabelKeys,
  type WarehouseLocationFormField,
  type WarehouseLocationType,
  type WarehouseLocationUse,
} from "@/lib/warehouse-location-form";
import {
  getWarehouseLocationRestrictionMessage,
  getWarehouseLocationRestrictions,
  type WarehouseLocationRestrictionReason,
} from "@/lib/warehouse-location-restrictions";
import { useWarehouseLocationDetail } from "@/hooks/useWarehouseLocationDetail";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { WarehouseLocation } from "@/types/inventory-location";

export type WarehouseLocationFormValues = {
  name: string;
  locationType: WarehouseLocationType;
  isPickable: boolean;
  isStorable: boolean;
  isActive: boolean;
  maxCapacity: number | null;
};

export type WarehouseLocationEditable = Pick<
  WarehouseLocation,
  | "id"
  | "code"
  | "name"
  | "parentId"
  | "locationType"
  | "isPickable"
  | "isStorable"
  | "isActive"
  | "maxCapacity"
>;

type WarehouseLocationFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  warehouseLabel: string;
  location: WarehouseLocationEditable | null;
  defaultParent: WarehouseLocationOption | null;
  suggestedType: WarehouseLocationType | null;
  canSubmit: boolean;
  isSubmitting: boolean;
  // parentId is only used when creating; Move owns parent changes for existing locations.
  onSubmit: (values: WarehouseLocationFormValues, parentId: string | null) => Promise<unknown>;
};

const FORM_ID = "warehouse-location-form";

export function WarehouseLocationFormDialog({
  open,
  onOpenChange,
  warehouseId,
  warehouseLabel,
  location,
  defaultParent,
  suggestedType,
  canSubmit,
  isSubmitting,
  onSubmit,
}: WarehouseLocationFormDialogProps) {
  const t = useTranslations("warehouseLocationsPage");
  const isEditing = Boolean(location);
  const initialType: WarehouseLocationType =
    location && isWarehouseLocationType(location.locationType)
      ? location.locationType
      : (suggestedType ?? "bin");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const submissionPending = useRef(false);
  const capacityInputRef = useRef<HTMLInputElement>(null);
  const [parentId, setParentId] = useState(
    location ? (location.parentId ?? "") : (defaultParent?.id ?? "")
  );
  const [parentOption, setParentOption] = useState<WarehouseLocationOption | null>(
    location ? null : defaultParent
  );
  const [isChoosingParent, setIsChoosingParent] = useState(false);
  const [name, setName] = useState(location?.name ?? "");
  const [locationType, setLocationType] = useState<WarehouseLocationType>(initialType);

  const [use, setUse] = useState<WarehouseLocationUse>(
    location ? getWarehouseLocationUse(location) : getDefaultWarehouseLocationUse(initialType)
  );
  const [isUseChosen, setIsUseChosen] = useState(isEditing);
  const [maxCapacity, setMaxCapacity] = useState(
    location?.maxCapacity == null ? "" : String(location.maxCapacity)
  );
  const [isActive, setIsActive] = useState(location ? location.isActive : true);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<WarehouseLocationFormField, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);

  const clearFieldError = (field: WarehouseLocationFormField) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  const { data: detail } = useWarehouseLocationDetail(warehouseId, location?.id);
  const code =
    location && location.locationType === locationType ? location.code : "";
  const restrictions = detail ? getWarehouseLocationRestrictions(detail) : null;
  const restrictionText = (reason: WarehouseLocationRestrictionReason) => {
    if (!detail) return "";
    const message = getWarehouseLocationRestrictionMessage(reason, detail);
    return t(message.key, message.values);
  };
  const parentAddress = location
    ? (detail?.ancestors.at(-1)?.locationPath ?? null)
    : (parentOption?.locationPath ?? null);
  const isParentResolved = location
    ? !location.parentId || Boolean(detail)
    : !parentId || (parentOption?.id === parentId && Boolean(parentOption.locationPath));
  const addressPreview =
    code.trim() && isParentResolved
      ? formatWarehouseLocationAddress(parentId ? parentAddress : null, code, name)
      : null;
  const getUseRestriction = (option: WarehouseLocationUse) => {
    if (!location || !restrictions) return null;
    if (option === "organizeOnly" && location.isStorable) {
      return restrictions.stopStoring ?? restrictions.stopPicking;
    }
    if (option === "storeOnly" && location.isPickable) return restrictions.stopPicking;
    return null;
  };
  const activeRestriction =
    location && restrictions && isActive === location.isActive
      ? location.isActive
        ? restrictions.disable
        : restrictions.enable
      : null;
  const isRenamed =
    Boolean(location) && (code.trim() !== location?.code || name.trim() !== (location?.name ?? ""));
  const renamedDescendantCount = isRenamed ? (detail?.descendantCount ?? 0) : 0;
  const showTypeSuggestion = !isEditing && suggestedType !== null && locationType === suggestedType;
  const isStorable = use !== "organizeOnly";

  const submit = async (addAnother: boolean) => {
    if (submissionPending.current || isSubmitting || !canSubmit) return;
    const capacityValue = maxCapacity.trim();
    const nextErrors: Partial<Record<WarehouseLocationFormField, string>> = {};
    if (
      isStorable &&
      capacityValue &&
      (!Number.isFinite(Number(capacityValue)) || Number(capacityValue) <= 0)
    ) {
      nextErrors.maxCapacity = t("capacityPositive");
    }
    setFieldErrors(nextErrors);
    setFormError(null);
    if (nextErrors.maxCapacity) {
      capacityInputRef.current?.focus();
      return;
    }

    const flags = getWarehouseLocationUseFlags(use);
    submissionPending.current = true;
    try {
      await onSubmit(
        {
          name: name.trim(),
          locationType,
          isStorable: flags.isStorable,
          isPickable: flags.isPickable,
          isActive,
          maxCapacity: flags.isStorable && capacityValue ? Number(capacityValue) : null,
        },
        parentId || null
      );
    } catch (error) {
      const errorCode = getApiErrorCode(error, warehouseLocationMutationErrorCodes);
      const message = errorCode
        ? t(getWarehouseLocationErrorMessageKey(errorCode))
        : t(isEditing ? "updateError" : "createError");
      const field = errorCode ? getWarehouseLocationErrorField(errorCode) : null;
      if (!field) {
        setFormError(message);
        return;
      }
      setFieldErrors({ [field]: message });
      if (field === "parent" && !isEditing) setIsChoosingParent(true);
      if (field === "maxCapacity") capacityInputRef.current?.focus();
      return;
    } finally {
      submissionPending.current = false;
    }

    if (!addAnother) {
      onOpenChange(false);
      return;
    }
    setName((current) => incrementTrailingNumber(current.trim()));
    nameInputRef.current?.focus();
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(false);
  };

  const title = isEditing ? t("editTitle") : parentId ? t("addSublocationTitle") : t("addTitle");
  const description = isEditing
    ? t("editDescription")
    : parentId
      ? t("addSublocationDescription")
      : t("addDescription");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-dvh overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form id={FORM_ID} className="space-y-4" onSubmit={handleFormSubmit} noValidate>
          {isChoosingParent ? (
            <div className="space-y-2">
              <Label htmlFor="location-parent">{t("parentLocation")}</Label>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <WarehouseLocationSelect
                    warehouseId={warehouseId}
                    value={parentId}
                    selectedOption={parentOption}
                    onValueChange={(value) => {
                      setParentId(value);
                      if (!value) setParentOption(null);
                      clearFieldError("parent");
                    }}
                    onOptionChange={setParentOption}
                    allowNone
                    noneLabel={t("warehouseLevel")}
                    triggerId="location-parent"
                    invalid={Boolean(fieldErrors.parent)}
                    describedBy={
                      fieldErrors.parent ? "location-parent-error" : "location-parent-help"
                    }
                    buttonClassName="w-full"
                  />
                </div>
                <WarehouseLocationBrowseButton
                  warehouseId={warehouseId}
                  warehouseLabel={warehouseLabel}
                  value={parentId}
                  onPick={(locationId) => {
                    setParentId(locationId);
                    setParentOption(null);
                    clearFieldError("parent");
                  }}
                />
              </div>
              {fieldErrors.parent ? (
                <p id="location-parent-error" className="text-sm text-destructive">
                  {fieldErrors.parent}
                </p>
              ) : (
                <p id="location-parent-help" className="text-xs text-muted-foreground">
                  {t("parentHelp")}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p id="location-parent-label" className="text-sm font-medium leading-none">
                {t("insideLabel")}
              </p>
              <div
                role="group"
                aria-labelledby="location-parent-label"
                className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2"
              >
                <FolderTree className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {parentId ? (parentAddress ?? "…") : t("warehouseLevel")}
                </span>
                {isEditing ? null : (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-1 py-0"
                    onClick={() => setIsChoosingParent(true)}
                  >
                    {t("changeParent")}
                  </Button>
                )}
              </div>
              {fieldErrors.parent ? (
                <p className="text-sm text-destructive">{fieldErrors.parent}</p>
              ) : isEditing ? (
                <p className="text-xs text-muted-foreground">{t("useMoveToChangeParent")}</p>
              ) : null}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="location-type">{t("locationType")}</Label>
            <Select
              value={locationType}
              onValueChange={(value) => {
                if (!isWarehouseLocationType(value)) return;
                setLocationType(value);
                if (!isUseChosen) {
                  const nextUse = getDefaultWarehouseLocationUse(value);
                  setUse(nextUse);
                  if (nextUse === "organizeOnly") setMaxCapacity("");
                }
              }}
            >
              <SelectTrigger id="location-type" aria-describedby="location-type-help">
                <SelectValue placeholder={t("selectType")} />
              </SelectTrigger>
              <SelectContent>
                {WAREHOUSE_LOCATION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(warehouseLocationTypeLabelKeys[type])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p id="location-type-help" className="text-xs text-muted-foreground">
              {showTypeSuggestion ? <span className="block">{t("typeSuggested")}</span> : null}
              <span className="block">{t("typeHelp")}</span>
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location-code">{t("code")}</Label>
              <Input id="location-code" placeholder={t("codeGenerated")} readOnly value={code} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-name">{t("name")}</Label>
              <Input
                id="location-name"
                ref={nameInputRef}
                placeholder={t("namePlaceholder")}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          </div>
          {renamedDescendantCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("renameImpact", { count: renamedDescendantCount })}
            </p>
          ) : null}

          <div className="space-y-2">
            <p id="location-use-label" className="text-sm font-medium leading-none">
              {t("use")}
            </p>
            <RadioGroup
              aria-labelledby="location-use-label"
              value={use}
              onValueChange={(value) => {
                const nextUse = WAREHOUSE_LOCATION_USES.find((option) => option === value);
                if (!nextUse) return;
                setUse(nextUse);
                setIsUseChosen(true);
                if (nextUse === "organizeOnly") {
                  setMaxCapacity("");
                  clearFieldError("maxCapacity");
                }
              }}
            >
              {WAREHOUSE_LOCATION_USES.map((option) => {
                const restriction = getUseRestriction(option);
                return (
                  <Label
                    key={option}
                    htmlFor={`location-use-${option}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal",
                      use === option && "border-primary bg-muted/40",
                      restriction && "cursor-not-allowed opacity-70"
                    )}
                  >
                    <RadioGroupItem
                      id={`location-use-${option}`}
                      value={option}
                      disabled={Boolean(restriction)}
                      className="mt-0.5"
                      aria-labelledby={`location-use-${option}-label`}
                      aria-describedby={`location-use-${option}-help`}
                    />
                    <span className="space-y-1">
                      <span
                        id={`location-use-${option}-label`}
                        className="block text-sm font-medium"
                      >
                        {t(warehouseLocationUseLabelKeys[option])}
                      </span>
                      <span
                        id={`location-use-${option}-help`}
                        className="block text-xs text-muted-foreground"
                      >
                        {t(warehouseLocationUseHelpKeys[option])}
                        {restriction ? (
                          <span className="block text-amber-700 dark:text-amber-400">
                            {restrictionText(restriction)}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </Label>
                );
              })}
            </RadioGroup>
          </div>

          {isStorable ? (
            <div className="space-y-2">
              <Label htmlFor="location-max-capacity">{t("maxCapacity")}</Label>
              <Input
                id="location-max-capacity"
                ref={capacityInputRef}
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                placeholder={t("maxCapacityPlaceholder")}
                value={maxCapacity}
                aria-invalid={Boolean(fieldErrors.maxCapacity)}
                className={cn(fieldErrors.maxCapacity && "border-destructive")}
                aria-describedby={
                  fieldErrors.maxCapacity
                    ? "location-max-capacity-error"
                    : "location-max-capacity-help"
                }
                onChange={(event) => {
                  setMaxCapacity(event.target.value);
                  clearFieldError("maxCapacity");
                }}
              />
              {fieldErrors.maxCapacity ? (
                <p id="location-max-capacity-error" className="text-sm text-destructive">
                  {fieldErrors.maxCapacity}
                </p>
              ) : (
                <p id="location-max-capacity-help" className="text-xs text-muted-foreground">
                  {t("maxCapacityHelp")}
                </p>
              )}
            </div>
          ) : null}

          <div className="space-y-1 rounded-lg border border-dashed bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">{t("addressPreview")}</p>
            <p aria-live="polite" className="break-words font-mono text-sm">
              {addressPreview ?? (
                <span className="font-sans text-muted-foreground">
                  {code.trim() ? t("addressPreviewLoading") : t("codeGenerated")}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">{t("addressPreviewHelp")}</p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="location-active">{t("active")}</Label>
              <p id="location-active-help" className="text-xs text-muted-foreground">
                {activeRestriction ? restrictionText(activeRestriction) : t("activeHelp")}
              </p>
            </div>
            <Switch
              id="location-active"
              checked={isActive}
              disabled={Boolean(activeRestriction)}
              aria-describedby="location-active-help"
              onCheckedChange={setIsActive}
            />
          </div>

          {formError ? (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
        </form>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          {isEditing ? null : (
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting || !canSubmit}
              onClick={() => void submit(true)}
            >
              {t("saveAndAddAnother")}
            </Button>
          )}
          <Button type="submit" form={FORM_ID} disabled={isSubmitting || !canSubmit}>
            {isSubmitting
              ? t("saving")
              : isEditing
                ? t("updateLocation")
                : parentId
                  ? t("createSublocation")
                  : t("createLocation")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
