"use client";

import { useId, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RESOURCES } from "@/constants/resources";
import { useUpdateSettings } from "@/hooks/settings/useSettings";
import { useCanEdit } from "@/hooks/usePermissions";
import { getApiErrorCode } from "@/lib/api";
import { generatedCodePaddingLimits } from "@/lib/validations/settings/generated-code-padding";
import type { CompanySettings, GeneratedCodePaddingErrorCode } from "@/types/settings";

type CodePaddingSettings = Pick<
  CompanySettings,
  "document_code_digits" | "warehouse_location_code_digits"
>;

export function GeneratedCodePaddingForm({ settings }: { settings: CodePaddingSettings }) {
  const t = useTranslations("adminSettings.generatedCodePadding");
  const tCommon = useTranslations("common");
  const formId = useId();
  const canEdit = useCanEdit(RESOURCES.COMPANY_SETTINGS);
  const { mutate, reset, isPending, error } = useUpdateSettings("company");
  const [draft, setDraft] = useState<Partial<CodePaddingSettings>>({});
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const saveInProgress = useRef(false);

  const documentDigits = draft.document_code_digits ?? settings.document_code_digits;
  const locationDigits =
    draft.warehouse_location_code_digits ?? settings.warehouse_location_code_digits;
  const documentChanged = documentDigits !== settings.document_code_digits;
  const locationChanged = locationDigits !== settings.warehouse_location_code_digits;
  const hasChanges = documentChanged || locationChanged;
  const canSave = canEdit && !isPending && hasChanges;
  const locationNumber = "1".padStart(locationDigits, "0");
  const fields = [
    {
      key: "document_code_digits",
      label: t("documentDigits"),
      value: documentDigits,
      limits: generatedCodePaddingLimits.document,
      example: `PO-${"1".padStart(documentDigits, "0")}`,
    },
    {
      key: "warehouse_location_code_digits",
      label: t("warehouseLocationDigits"),
      value: locationDigits,
      limits: generatedCodePaddingLimits.warehouseLocation,
      example: `Z${locationNumber}-R${locationNumber}-B${locationNumber}`,
    },
  ] as const;

  const confirmSave = () => {
    if (!confirmationOpen || !canSave || saveInProgress.current) return;

    saveInProgress.current = true;
    mutate(
      {
        ...(documentChanged && { document_code_digits: documentDigits }),
        ...(locationChanged && { warehouse_location_code_digits: locationDigits }),
      },
      {
        onSuccess: () => {
          setDraft({});
          setConfirmationOpen(false);
          toast.success(t("saveSuccess"));
        },
        onSettled: () => {
          saveInProgress.current = false;
        },
      }
    );
  };

  const errorCode = getApiErrorCode<GeneratedCodePaddingErrorCode>(error, [
    "INVALID_GENERATED_CODE_PADDING",
  ]);

  return (
    <AlertDialog
      open={confirmationOpen}
      onOpenChange={(open) => {
        if (saveInProgress.current) return;

        setConfirmationOpen(open);
        if (!open) reset();
      }}
    >
      <Card role="form" aria-labelledby={formId} aria-busy={isPending}>
        <CardHeader>
          <CardTitle id={formId}>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(({ key, label, value, limits, example }) => {
              const fieldId = `${formId}-${key}`;
              const descriptionId = `${fieldId}-example`;
              return (
                <div key={key} className="space-y-2">
                  <Label htmlFor={fieldId}>{label}</Label>
                  <Select
                    value={String(value)}
                    disabled={!canEdit || isPending}
                    onValueChange={(selected) => {
                      reset();
                      const digits = Number(selected);
                      setDraft((current) => ({
                        ...current,
                        [key]: digits === settings[key] ? undefined : digits,
                      }));
                    }}
                  >
                    <SelectTrigger
                      id={fieldId}
                      aria-describedby={descriptionId}
                      className="w-full sm:w-48"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: limits.max - limits.min + 1 }, (_, index) => {
                        const digits = limits.min + index;
                        return (
                          <SelectItem key={digits} value={String(digits)}>
                            {digits}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p id={descriptionId} className="text-sm text-muted-foreground">
                    {t("example", { example })}
                  </p>
                </div>
              );
            })}
          </div>
          {hasChanges && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 [&>svg]:text-current">
              <AlertTriangle aria-hidden="true" className="h-4 w-4" />
              <AlertDescription>{t("changeWarning")}</AlertDescription>
            </Alert>
          )}
          {canEdit && (
            <div className="flex justify-end">
              <AlertDialogTrigger asChild>
                <Button type="button" disabled={!canSave}>
                  {t("save")}
                </Button>
              </AlertDialogTrigger>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialogContent aria-busy={isPending}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("confirmDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <dl className="space-y-2 rounded-md border p-3 text-sm">
          {fields
            .filter(({ key, value }) => value !== settings[key])
            .map(({ key, label, value }) => (
              <div key={key} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="shrink-0 font-medium">
                  {t("digitChange", { previous: settings[key], next: value })}
                </dd>
              </div>
            ))}
        </dl>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {errorCode === "INVALID_GENERATED_CODE_PADDING"
                ? t("invalidPadding", {
                    documentMax: generatedCodePaddingLimits.document.max,
                    locationMax: generatedCodePaddingLimits.warehouseLocation.max,
                  })
                : t("saveError")}
            </AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{tCommon("cancel")}</AlertDialogCancel>
          <Button type="button" disabled={!canSave} onClick={confirmSave}>
            {isPending && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
            {isPending ? t("applying") : t("apply")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
