"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, AlertTriangle, Edit2, Search, Filter, X, Check } from "lucide-react";
import type { ReorderSeasonItemPolicy, ReorderSeason } from "@/types/reorder";
import { ItemSelect } from "@/components/common/ItemSelect";
import { useItemUnitOptions } from "@/hooks/useItemUnitOptions";

type SeasonItemPolicyDialogProps = {
  open: boolean;
  season: ReorderSeason | null;
  policies: ReorderSeasonItemPolicy[];
  onOpenChange: (open: boolean) => void;
  onCreatePolicy: (policy: {
    seasonId: string;
    itemId: string;
    itemUnitOptionId?: string | null;
    reorderLevel: number;
    reorderQuantity: number;
    isActive: boolean;
  }) => Promise<void>;
  onUpdatePolicy: (
    policyId: string,
    updates: {
      reorderLevel?: number;
      reorderQuantity?: number;
      itemUnitOptionId?: string | null;
      isActive?: boolean;
    }
  ) => Promise<void>;
  onDeletePolicy: (policyId: string) => Promise<void>;
};

type PolicyFormState = {
  itemId: string;
  itemUnitOptionId: string;
  reorderLevel: string;
  reorderQuantity: string;
  isActive: boolean;
};

type PolicyStatusFilter = "all" | "active" | "inactive";

const initialFormState: PolicyFormState = {
  itemId: "",
  itemUnitOptionId: "",
  reorderLevel: "",
  reorderQuantity: "",
  isActive: true,
};

const formatQuantity = (value: number) => {
  if (!Number.isFinite(value)) return "0";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(4).replace(/\.?0+$/, "");
};

export function SeasonItemPolicyDialog({
  open,
  season,
  policies,
  onOpenChange,
  onCreatePolicy,
  onUpdatePolicy,
  onDeletePolicy,
}: SeasonItemPolicyDialogProps) {
  const t = useTranslations("reorderManagementPage");

  const [form, setForm] = useState<PolicyFormState>(initialFormState);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PolicyFormState>>({});
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PolicyStatusFilter>("all");
  const { data: formUnitOptionsData, isLoading: formUnitOptionsLoading } = useItemUnitOptions(
    form.itemId
  );
  const formUnitOptions = useMemo(
    () => (formUnitOptionsData?.data || []).filter((option) => option.isActive),
    [formUnitOptionsData?.data]
  );
  const selectedFormUnitOption =
    formUnitOptions.find((option) => option.id === form.itemUnitOptionId) || null;
  const formUnitLevel = Number.parseFloat(form.reorderLevel);
  const formUnitQty = Number.parseFloat(form.reorderQuantity);
  const formTotalLevel =
    Number.isFinite(formUnitLevel) && selectedFormUnitOption
      ? formUnitLevel * selectedFormUnitOption.qtyPerUnit
      : null;
  const formTotalQty =
    Number.isFinite(formUnitQty) && selectedFormUnitOption
      ? formUnitQty * selectedFormUnitOption.qtyPerUnit
      : null;

  // Filter and search policies
  const filteredPolicies = useMemo(() => {
    let filtered = [...policies];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (policy) =>
          policy.itemName.toLowerCase().includes(query) ||
          policy.itemCode.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter === "active") {
      filtered = filtered.filter((policy) => policy.isActive);
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter((policy) => !policy.isActive);
    }

    return filtered;
  }, [policies, searchQuery, statusFilter]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setForm(initialFormState);
      setIsAdding(false);
      setEditingId(null);
      setEditForm({});
      setError(null);
      setSearchQuery("");
      setStatusFilter("all");
    }
  }, [open]);

  useEffect(() => {
    if (!form.itemId) {
      if (form.itemUnitOptionId) {
        setForm((current) => ({ ...current, itemUnitOptionId: "" }));
      }
      return;
    }

    if (form.itemUnitOptionId || formUnitOptions.length === 0) return;

    const defaultOption =
      formUnitOptions.find((option) => option.isDefault) ||
      formUnitOptions.find((option) => option.isBase) ||
      formUnitOptions[0];

    setForm((current) => ({ ...current, itemUnitOptionId: defaultOption.id }));
  }, [form.itemId, form.itemUnitOptionId, formUnitOptions]);

  const handleCreate = async () => {
    if (!season) return;

    const reorderUnitLevel = parseFloat(form.reorderLevel);
    const reorderUnitQuantity = parseFloat(form.reorderQuantity);
    const selectedUnitOption = formUnitOptions.find((option) => option.id === form.itemUnitOptionId);

    if (
      !form.itemId ||
      !form.itemUnitOptionId ||
      !selectedUnitOption ||
      isNaN(reorderUnitLevel) ||
      isNaN(reorderUnitQuantity)
    ) {
      setError(t("policyRequiredFieldsInvalid"));
      return;
    }

    if (reorderUnitLevel < 0 || reorderUnitQuantity <= 0) {
      setError(t("policyQuantityInvalid"));
      return;
    }

    setIsPending(true);
    setError(null);
    try {
      await onCreatePolicy({
        seasonId: season.id,
        itemId: form.itemId,
        itemUnitOptionId: form.itemUnitOptionId,
        reorderLevel: reorderUnitLevel,
        reorderQuantity: reorderUnitQuantity,
        isActive: form.isActive,
      });
      setForm(initialFormState);
      setIsAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("policyCreateFailed"));
    } finally {
      setIsPending(false);
    }
  };

  const handleUpdate = async (policyId: string) => {
    const updates: {
      reorderLevel?: number;
      reorderQuantity?: number;
      itemUnitOptionId?: string | null;
      isActive?: boolean;
    } = {};

    const policy = policies.find((currentPolicy) => currentPolicy.id === policyId);
    if (!policy) return;

    const selectedUnitOptionId = editForm.itemUnitOptionId ?? policy.itemUnitOptionId ?? "";
    const selectedUnitOption = policy.unitOptions.find(
      (option) => option.id === selectedUnitOptionId
    );
    const editLevel =
      editForm.reorderLevel !== undefined
        ? parseFloat(editForm.reorderLevel)
        : policy.reorderUnitLevel;
    const editQuantity =
      editForm.reorderQuantity !== undefined
        ? parseFloat(editForm.reorderQuantity)
        : policy.reorderUnitQuantity;

    if (editForm.reorderLevel !== undefined || editForm.itemUnitOptionId !== undefined) {
      if (isNaN(editLevel) || editLevel < 0 || !selectedUnitOption) {
        setError(t("reorderLevelInvalid"));
        return;
      }
      updates.reorderLevel = editLevel;
      updates.itemUnitOptionId = selectedUnitOption.id;
    }

    if (editForm.reorderQuantity !== undefined || editForm.itemUnitOptionId !== undefined) {
      if (isNaN(editQuantity) || editQuantity <= 0 || !selectedUnitOption) {
        setError(t("reorderQuantityInvalid"));
        return;
      }
      updates.reorderQuantity = editQuantity;
      updates.itemUnitOptionId = selectedUnitOption.id;
    }

    if (editForm.isActive !== undefined) {
      updates.isActive = editForm.isActive;
    }

    if (Object.keys(updates).length === 0) {
      setEditingId(null);
      setEditForm({});
      return;
    }

    setIsPending(true);
    setError(null);
    try {
      await onUpdatePolicy(policyId, updates);
      setEditingId(null);
      setEditForm({});
    } catch (err) {
      setError(err instanceof Error ? err.message : t("policyUpdateFailed"));
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async (policyId: string) => {
    if (!confirm(t("deleteItemPolicyConfirm"))) {
      return;
    }

    setIsPending(true);
    setError(null);
    try {
      await onDeletePolicy(policyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("policyDeleteFailed"));
    } finally {
      setIsPending(false);
    }
  };

  const startEditing = (policy: ReorderSeasonItemPolicy) => {
    setEditingId(policy.id);
    setEditForm({
      reorderLevel: policy.reorderUnitLevel.toString(),
      reorderQuantity: policy.reorderUnitQuantity.toString(),
      itemUnitOptionId: policy.itemUnitOptionId ?? "",
      isActive: policy.isActive,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
    setError(null);
  };

  if (!season) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-[1200px] h-[85vh] p-0 gap-0 flex flex-col">
        {/* Header - Fixed */}
        <DialogHeader className="px-6 py-4 pr-14 border-b bg-slate-50 dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
                {t("seasonItemPolicyTitle", { seasonName: season.name })}
              </DialogTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {t("seasonItemPolicySubtitle", {
                  seasonCode: season.code,
                  effectiveFrom: season.effectiveFrom,
                  effectiveTo: season.effectiveTo,
                })}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-6 space-y-4">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Add Policy Form - Collapsible */}
            {isAdding && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="new-item" className="text-sm font-medium">
                      {t("item")} <span className="text-destructive">*</span>
                    </Label>
                    <ItemSelect
                      value={form.itemId}
                      onValueChange={(value) =>
                        setForm({ ...form, itemId: value, itemUnitOptionId: "" })
                      }
                      disabled={isPending}
                      placeholder={t("selectItem")}
                      searchPlaceholder={t("searchItems")}
                      emptyMessage={t("noItemsFound")}
                      loadingMessage={t("loading")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-unit" className="text-sm font-medium">
                      {t("unit")} <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={form.itemUnitOptionId}
                      onValueChange={(value) => setForm({ ...form, itemUnitOptionId: value })}
                      disabled={isPending || !form.itemId || formUnitOptionsLoading}
                    >
                      <SelectTrigger id="new-unit" className="cursor-pointer">
                        <SelectValue
                          placeholder={
                            formUnitOptionsLoading ? t("loading") : t("selectUnit")
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {formUnitOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id} className="cursor-pointer">
                            {option.displayLabel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-reorder-level" className="text-sm font-medium">
                      {t("reorderLevel")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="new-reorder-level"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.reorderLevel}
                      onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
                      placeholder={t("reorderLevelPlaceholder")}
                      disabled={isPending}
                      className="cursor-text"
                    />
                    {formTotalLevel !== null && (
                      <p className="text-xs text-muted-foreground">
                        {t("baseReorderLevel")}: {formatQuantity(formTotalLevel)}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-reorder-quantity" className="text-sm font-medium">
                      {t("reorderQty")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="new-reorder-quantity"
                      type="number"
                      min="1"
                      step="0.01"
                      value={form.reorderQuantity}
                      onChange={(e) => setForm({ ...form, reorderQuantity: e.target.value })}
                      placeholder={t("reorderQuantityPlaceholder")}
                      disabled={isPending}
                      className="cursor-text"
                    />
                    {formTotalQty !== null && (
                      <p className="text-xs text-muted-foreground">
                        {t("totalQty")}: {formatQuantity(formTotalQty)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="new-is-active"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      disabled={isPending}
                      className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                    />
                    <Label htmlFor="new-is-active" className="text-sm cursor-pointer">
                      {t("activeOnCreation")}
                    </Label>
                  </div>
                  <Button
                    onClick={handleCreate}
                    disabled={
                      isPending ||
                      !form.itemId ||
                      !form.itemUnitOptionId ||
                      !form.reorderLevel ||
                      !form.reorderQuantity
                    }
                    size="sm"
                    className="cursor-pointer"
                  >
                    {isPending ? t("creating") : t("createPolicy")}
                  </Button>
                </div>
              </div>
            )}

            {/* Toolbar - Search & Filters */}
            {!isAdding && (
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="flex-1 w-full sm:w-auto relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t("searchByItemNameOrCode")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full cursor-text"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as PolicyStatusFilter)}
                  >
                    <SelectTrigger className="w-[140px] cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="cursor-pointer">{t("allStatus")}</SelectItem>
                      <SelectItem value="active" className="cursor-pointer">{t("activeOnly")}</SelectItem>
                      <SelectItem value="inactive" className="cursor-pointer">{t("inactiveOnly")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => setIsAdding(true)}
                    size="sm"
                    disabled={isPending || !!editingId}
                    className="shrink-0 cursor-pointer"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    {t("addPolicy")}
                  </Button>
                  {(searchQuery || statusFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setStatusFilter("all");
                      }}
                      className="shrink-0 cursor-pointer"
                    >
                      {t("clear")}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Results Counter */}
            {(searchQuery || statusFilter !== "all") && policies.length > 0 && (
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {t("policyResultsCount", {
                  filtered: filteredPolicies.length,
                  total: policies.length,
                })}
              </div>
            )}

            {/* Data Table */}
            {policies.length > 0 ? (
              filteredPolicies.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900">
                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-[35%]">
                            {t("item").toUpperCase()}
                          </TableHead>
                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {t("reorderLevel").toUpperCase()}
                          </TableHead>
                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {t("reorderQuantity").toUpperCase()}
                          </TableHead>
                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {t("unit").toUpperCase()}
                          </TableHead>
                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {t("qtyPerUnit").toUpperCase()}
                          </TableHead>
                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {t("totalQty").toUpperCase()}
                          </TableHead>
                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {t("status").toUpperCase()}
                          </TableHead>
                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">
                            {t("actions").toUpperCase()}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPolicies.map((policy) => {
                          const isEditing = editingId === policy.id;
                          const selectedEditUnitOptionId =
                            editForm.itemUnitOptionId ?? policy.itemUnitOptionId ?? "";
                          const selectedEditUnitOption =
                            policy.unitOptions.find(
                              (option) => option.id === selectedEditUnitOptionId
                            ) || null;
                          const editUnitQuantity = Number.parseFloat(
                            String(editForm.reorderQuantity ?? policy.reorderUnitQuantity)
                          );
                          const editTotalQuantity =
                            isEditing && selectedEditUnitOption && Number.isFinite(editUnitQuantity)
                              ? editUnitQuantity * selectedEditUnitOption.qtyPerUnit
                              : policy.totalQuantity;

                          return (
                            <TableRow
                              key={policy.id}
                              className={`${
                                isEditing ? "bg-blue-50 dark:bg-blue-950/20" : ""
                              } hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors duration-150`}
                            >
                              <TableCell className="font-medium">
                                <div className="space-y-0.5">
                                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {policy.itemName}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {policy.itemCode}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editForm.reorderLevel ?? policy.reorderUnitLevel}
                                    onChange={(e) =>
                                      setEditForm({ ...editForm, reorderLevel: e.target.value })
                                    }
                                    className="w-28 h-8 text-sm cursor-text"
                                    disabled={isPending}
                                  />
                                ) : (
                                  <span className="text-sm font-mono">
                                    {formatQuantity(policy.reorderUnitLevel)}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    value={editForm.reorderQuantity ?? policy.reorderQuantity}
                                    onChange={(e) =>
                                      setEditForm({ ...editForm, reorderQuantity: e.target.value })
                                    }
                                    className="w-28 h-8 text-sm cursor-text"
                                    disabled={isPending}
                                  />
                                ) : (
                                  <span className="text-sm font-mono">
                                    {formatQuantity(policy.reorderUnitQuantity)}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Select
                                    value={selectedEditUnitOptionId}
                                    onValueChange={(value) =>
                                      setEditForm({ ...editForm, itemUnitOptionId: value })
                                    }
                                    disabled={isPending || policy.unitOptions.length === 0}
                                  >
                                    <SelectTrigger className="h-8 min-w-36 cursor-pointer">
                                      <SelectValue placeholder={t("selectUnit")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {policy.unitOptions.map((option) => (
                                        <SelectItem
                                          key={option.id}
                                          value={option.id}
                                          className="cursor-pointer"
                                        >
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className="text-sm text-slate-700 dark:text-slate-300">
                                    {policy.unitLabel || policy.baseUnitLabel || t("notAvailable")}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm font-mono">
                                  {formatQuantity(
                                    isEditing && selectedEditUnitOption
                                      ? selectedEditUnitOption.qtyPerUnit
                                      : policy.qtyPerUnit
                                  )}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm font-mono">
                                  {formatQuantity(editTotalQuantity)}
                                  {policy.baseUnitLabel ? ` ${policy.baseUnitLabel}` : ""}
                                </span>
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <button
                                    onClick={() =>
                                      setEditForm({
                                        ...editForm,
                                        isActive: !(editForm.isActive ?? policy.isActive),
                                      })
                                    }
                                    disabled={isPending}
                                    className="cursor-pointer"
                                  >
                                    <Badge
                                      variant={
                                        editForm.isActive ?? policy.isActive ? "default" : "secondary"
                                      }
                                      className="text-xs px-2.5 py-0.5 cursor-pointer"
                                    >
                                      {(editForm.isActive ?? policy.isActive)
                                        ? t("active")
                                        : t("inactive")}
                                    </Badge>
                                  </button>
                                ) : (
                                  <Badge
                                    variant={policy.isActive ? "default" : "secondary"}
                                    className="text-xs px-2.5 py-0.5"
                                  >
                                    {policy.isActive ? t("active") : t("inactive")}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {isEditing ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleUpdate(policy.id)}
                                        disabled={isPending}
                                        className="h-8 gap-1 cursor-pointer"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                        {t("save")}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={cancelEditing}
                                        disabled={isPending}
                                        className="h-8 cursor-pointer"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => startEditing(policy)}
                                        disabled={isPending || !!editingId}
                                        className="h-8 gap-1 cursor-pointer"
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                        {t("edit")}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(policy.id)}
                                        disabled={isPending || !!editingId}
                                        className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Search className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {t("noMatchingPolicies")}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mb-4">
                    {t("adjustPolicyFilters")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                    }}
                    className="cursor-pointer"
                  >
                    {t("clearFilters")}
                  </Button>
                </div>
              )
            ) : !isAdding ? (
              <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Plus className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                  {t("noItemPoliciesDefined")}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("addPolicyEmptyHint")}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="px-6 py-3 border-t bg-slate-50 dark:bg-slate-900 shrink-0 flex items-center justify-between">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            {t("policyTotalCount", { count: policies.length })}
          </div>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            size="sm"
            className="cursor-pointer"
          >
            {t("close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
