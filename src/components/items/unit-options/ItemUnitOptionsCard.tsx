"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleOff,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  useCreateItemUnitOption,
  useDeleteItemUnitOption,
  useItemUnitOptions,
  useUpdateItemUnitOption,
} from "@/hooks/useItemUnitOptions";
import { useUnitsOfMeasure } from "@/hooks/useUnitsOfMeasure";
import type { ItemUnitOption } from "@/types/item";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ItemUnitOptionsCardProps = {
  itemId: string;
  baseUomCode: string;
  editable?: boolean;
};

type UnitOptionFormState = {
  uomId: string;
  qtyPerUnit: string;
  optionLabel: string;
  isDefault: boolean;
  isActive: boolean;
};

const INITIAL_FORM_STATE: UnitOptionFormState = {
  uomId: "",
  qtyPerUnit: "",
  optionLabel: "",
  isDefault: false,
  isActive: true,
};

const formatQtyPerUnit = (value: number | string): string => {
  if (value === "") return "0";

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return "";
  if (Number.isInteger(parsed)) return String(parsed);
  return parsed.toFixed(4).replace(/\.?0+$/, "");
};

export const ItemUnitOptionsCard = ({
  itemId,
  baseUomCode,
  editable = false,
}: ItemUnitOptionsCardProps) => {
  const t = useTranslations("inventoryItemPage");
  const { data, isLoading } = useItemUnitOptions(itemId);
  const { data: uomsData } = useUnitsOfMeasure();
  const createUnitOption = useCreateItemUnitOption(itemId);
  const updateUnitOption = useUpdateItemUnitOption(itemId);
  const deleteUnitOption = useDeleteItemUnitOption(itemId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnitOption, setEditingUnitOption] = useState<ItemUnitOption | null>(null);
  const [formState, setFormState] = useState<UnitOptionFormState>(INITIAL_FORM_STATE);
  const [isOptionLabelOverridden, setIsOptionLabelOverridden] = useState(false);

  const unitOptions = data?.data || [];
  const availableUoms = useMemo(
    () => (uomsData?.data || []).filter((unit) => unit.isActive !== false),
    [uomsData?.data]
  );

  const buildGeneratedOptionLabel = (
    uomId: string,
    qtyPerUnit: string,
    fallbackUomCode?: string
  ) => {
    const selectedUom = availableUoms.find((uom) => uom.id === uomId);
    const uomCode = selectedUom?.code || fallbackUomCode;
    const formattedQty = formatQtyPerUnit(qtyPerUnit);

    if (!uomCode || !formattedQty) {
      return "";
    }

    return `${uomCode} (${formattedQty})`;
  };

  useEffect(() => {
    if (!dialogOpen) {
      setFormState(INITIAL_FORM_STATE);
      setEditingUnitOption(null);
      setIsOptionLabelOverridden(false);
    }
  }, [dialogOpen]);

  const openCreateDialog = () => {
    setEditingUnitOption(null);
    setFormState({
      ...INITIAL_FORM_STATE,
      isActive: true,
    });
    setIsOptionLabelOverridden(false);
    setDialogOpen(true);
  };

  const openEditDialog = (unitOption: ItemUnitOption) => {
    const qtyPerUnit = String(unitOption.qtyPerUnit);
    const generatedOptionLabel = buildGeneratedOptionLabel(
      unitOption.uomId,
      qtyPerUnit,
      unitOption.uomCode
    );
    const optionLabel = unitOption.optionLabel || generatedOptionLabel;

    setEditingUnitOption(unitOption);
    setFormState({
      uomId: unitOption.uomId,
      qtyPerUnit,
      optionLabel,
      isDefault: unitOption.isDefault,
      isActive: unitOption.isActive,
    });
    setIsOptionLabelOverridden(
      !!unitOption.optionLabel && unitOption.optionLabel !== generatedOptionLabel
    );
    setDialogOpen(true);
  };

  const submitForm = async () => {
    const qtyPerUnit = Number(formState.qtyPerUnit);
    if (!formState.uomId || !Number.isFinite(qtyPerUnit) || qtyPerUnit <= 0) {
      toast.error(t("unitOptionValidationError"));
      return;
    }

    try {
      if (editingUnitOption) {
        await updateUnitOption.mutateAsync({
          unitOptionId: editingUnitOption.id,
          data: {
            uomId: formState.uomId,
            qtyPerUnit,
            optionLabel: formState.optionLabel,
            isDefault: formState.isDefault,
            isActive: formState.isActive,
          },
        });
        toast.success(t("unitOptionUpdated"));
      } else {
        await createUnitOption.mutateAsync({
          uomId: formState.uomId,
          qtyPerUnit,
          optionLabel: formState.optionLabel,
          isDefault: formState.isDefault,
          isActive: formState.isActive,
        });
        toast.success(t("unitOptionAdded"));
      }

      setDialogOpen(false);
    } catch (error) {
      toast.error((error as Error)?.message || t("unitOptionSaveError"));
    }
  };

  const setDefault = async (unitOption: ItemUnitOption) => {
    try {
      await updateUnitOption.mutateAsync({
        unitOptionId: unitOption.id,
        data: {
          isDefault: true,
          isActive: true,
        },
      });
      toast.success(t("unitOptionDefaultUpdated"));
    } catch (error) {
      toast.error((error as Error)?.message || t("unitOptionSaveError"));
    }
  };

  const toggleActive = async (unitOption: ItemUnitOption) => {
    try {
      await updateUnitOption.mutateAsync({
        unitOptionId: unitOption.id,
        data: {
          isActive: !unitOption.isActive,
        },
      });
      toast.success(unitOption.isActive ? t("unitOptionDeactivated") : t("unitOptionActivated"));
    } catch (error) {
      toast.error((error as Error)?.message || t("unitOptionSaveError"));
    }
  };

  const removeUnitOption = async (unitOption: ItemUnitOption) => {
    try {
      await deleteUnitOption.mutateAsync(unitOption.id);
      toast.success(t("unitOptionDeleted"));
    } catch (error) {
      toast.error((error as Error)?.message || t("unitOptionDeleteError"));
    }
  };

  const isMutating =
    createUnitOption.isPending || updateUnitOption.isPending || deleteUnitOption.isPending;

  // Edit stays visible; secondary and destructive actions live in the row menu.
  const renderRowActions = (unitOption: ItemUnitOption) => {
    const canEdit = !unitOption.isBase;
    const canSetDefault = !unitOption.isDefault;
    const canToggleActive = !unitOption.isBase;
    const canDelete = !unitOption.isBase && !unitOption.isDefault;

    return (
      <div className="flex justify-end gap-2">
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-md:h-11"
            onClick={() => openEditDialog(unitOption)}
            disabled={isMutating}
          >
            <Pencil className="mr-2 h-4 w-4" />
            {t("edit")}
          </Button>
        ) : null}
        {canSetDefault || canToggleActive || canDelete ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-9 p-0 max-md:h-11 max-md:w-11"
                aria-label={t("moreUnitOptionActions")}
                disabled={isMutating}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {canSetDefault ? (
                <DropdownMenuItem
                  className="max-md:min-h-11"
                  onClick={() => setDefault(unitOption)}
                >
                  <Star className="h-4 w-4" />
                  {t("setDefaultAction")}
                </DropdownMenuItem>
              ) : null}
              {canToggleActive ? (
                <DropdownMenuItem
                  className="max-md:min-h-11"
                  onClick={() => toggleActive(unitOption)}
                >
                  {unitOption.isActive ? (
                    <CircleOff className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {unitOption.isActive ? t("deactivateAction") : t("activateAction")}
                </DropdownMenuItem>
              ) : null}
              {canDelete ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive max-md:min-h-11"
                  onClick={() => removeUnitOption(unitOption)}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("deleteAction")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    );
  };

  const renderUnitBadges = (unitOption: ItemUnitOption) => (
    <>
      {unitOption.isBase ? <Badge variant="secondary">{t("baseLabel")}</Badge> : null}
      {unitOption.isDefault ? <Badge variant="outline">{t("defaultLabel")}</Badge> : null}
    </>
  );

  const renderStatus = (unitOption: ItemUnitOption, sizeClassName: string) => (
    <span
      className={
        unitOption.isActive
          ? `${sizeClassName} font-medium text-green-700 dark:text-green-400`
          : `${sizeClassName} font-medium text-muted-foreground`
      }
    >
      {unitOption.isActive ? t("activeLabel") : t("inactiveLabel")}
    </span>
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{t("unitOptionsTitle")}</CardTitle>
            <CardDescription className="text-sm">{t("unitOptionsDescription")}</CardDescription>
          </div>
          {editable ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
              <Button onClick={openCreateDialog} className="max-md:h-11">
                <Plus className="mr-2 h-4 w-4" />
                {t("addUnitOption")}
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              {[1, 2].map((row) => (
                <Skeleton key={row} className="h-16 w-full" />
              ))}
            </div>
          ) : unitOptions.length === 0 ? (
            <div className="flex min-h-[160px] flex-col items-center justify-center px-4 py-8 text-center text-sm text-muted-foreground">
              <p className="font-medium">{t("noUnitOptions")}</p>
              {editable ? <p className="mt-2">{t("noUnitOptionsDescription")}</p> : null}
            </div>
          ) : (
            <>
              {/* Phones: stacked rows. Unit option lists are short, so both layouts render. */}
              <ul className="divide-y rounded-md border md:hidden">
                {unitOptions.map((unitOption) => (
                  <li key={unitOption.id} className="flex items-start gap-3 p-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{unitOption.displayLabel}</span>
                        {renderUnitBadges(unitOption)}
                      </div>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {t("qtyPerUnitLabel")}: {unitOption.qtyPerUnit} {baseUomCode}
                      </p>
                      <p className="break-all text-xs tabular-nums text-muted-foreground">
                        {t("barcodeLabel")}: {unitOption.barcode}
                      </p>
                      {renderStatus(unitOption, "text-xs")}
                    </div>
                    {editable ? renderRowActions(unitOption) : null}
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("unitLabel")}</TableHead>
                      <TableHead>{t("qtyPerUnitLabel")}</TableHead>
                      <TableHead>{t("barcodeLabel")}</TableHead>
                      <TableHead>{t("statusLabel")}</TableHead>
                      {editable ? (
                        <TableHead className="text-right">{t("actionsLabel")}</TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unitOptions.map((unitOption) => (
                      <TableRow key={unitOption.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{unitOption.displayLabel}</div>
                            <div className="flex flex-wrap gap-2">
                              {renderUnitBadges(unitOption)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {unitOption.qtyPerUnit} {baseUomCode}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">{unitOption.barcode}</TableCell>
                        <TableCell>{renderStatus(unitOption, "text-sm")}</TableCell>
                        {editable ? (
                          <TableCell className="text-right">
                            {renderRowActions(unitOption)}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingUnitOption ? t("editUnitOption") : t("addUnitOption")}
            </DialogTitle>
            <DialogDescription>{t("unitOptionDialogDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("unitLabel")}</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formState.uomId}
                onChange={(event) => {
                  const nextUomId = event.target.value;
                  setFormState((current) =>
                    isOptionLabelOverridden
                      ? { ...current, uomId: nextUomId }
                      : {
                          ...current,
                          uomId: nextUomId,
                          optionLabel: buildGeneratedOptionLabel(nextUomId, current.qtyPerUnit),
                        }
                  );
                }}
              >
                <option value="">{t("selectUom")}</option>
                {availableUoms.map((uom) => (
                  <option key={uom.id} value={uom.id}>
                    {uom.name} ({uom.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("qtyPerUnitLabel")}</label>
              <Input
                type="number"
                min="0.0001"
                step="0.0001"
                value={formState.qtyPerUnit}
                onChange={(event) => {
                  const nextQtyPerUnit = event.target.value;
                  setFormState((current) =>
                    isOptionLabelOverridden
                      ? { ...current, qtyPerUnit: nextQtyPerUnit }
                      : {
                          ...current,
                          qtyPerUnit: nextQtyPerUnit,
                          optionLabel: buildGeneratedOptionLabel(current.uomId, nextQtyPerUnit),
                        }
                  );
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("displayLabelLabel")}</label>
              <Input
                value={formState.optionLabel}
                placeholder={t("displayLabelPlaceholder")}
                onChange={(event) => {
                  setIsOptionLabelOverridden(true);
                  setFormState((current) => ({ ...current, optionLabel: event.target.value }));
                }}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">{t("defaultLabel")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("defaultUnitOptionDescription")}
                </div>
              </div>
              <Switch
                checked={formState.isDefault}
                onCheckedChange={(checked) =>
                  setFormState((current) => ({
                    ...current,
                    isDefault: checked,
                    isActive: checked ? true : current.isActive,
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">{t("activeLabel")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("activeUnitOptionDescription")}
                </div>
              </div>
              <Switch
                checked={formState.isActive}
                onCheckedChange={(checked) =>
                  setFormState((current) => ({
                    ...current,
                    isActive: checked,
                    isDefault: checked ? current.isDefault : false,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" onClick={submitForm} disabled={isMutating}>
              {isMutating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("saveUnitOption")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
