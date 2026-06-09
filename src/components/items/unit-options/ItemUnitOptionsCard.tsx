"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
              <Button onClick={openCreateDialog}>
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
            <div className="overflow-x-auto">
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
                            {unitOption.isBase ? (
                              <Badge variant="secondary">{t("baseLabel")}</Badge>
                            ) : null}
                            {unitOption.isDefault ? (
                              <Badge variant="outline">{t("defaultLabel")}</Badge>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {unitOption.qtyPerUnit} {baseUomCode}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{unitOption.barcode}</TableCell>
                      <TableCell>
                        <span
                          className={
                            unitOption.isActive
                              ? "text-sm font-medium text-green-700 dark:text-green-400"
                              : "text-sm font-medium text-muted-foreground"
                          }
                        >
                          {unitOption.isActive ? t("activeLabel") : t("inactiveLabel")}
                        </span>
                      </TableCell>
                      {editable ? (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {!unitOption.isBase ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(unitOption)}
                                disabled={isMutating}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                {t("edit")}
                              </Button>
                            ) : null}
                            {!unitOption.isDefault ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setDefault(unitOption)}
                                disabled={isMutating}
                              >
                                {t("setDefaultAction")}
                              </Button>
                            ) : null}
                            {!unitOption.isBase ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => toggleActive(unitOption)}
                                disabled={isMutating}
                              >
                                {unitOption.isActive ? t("deactivateAction") : t("activateAction")}
                              </Button>
                            ) : null}
                            {!unitOption.isBase && !unitOption.isDefault ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeUnitOption(unitOption)}
                                disabled={isMutating}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t("deleteAction")}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
