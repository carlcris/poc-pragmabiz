"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
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
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTransformationAdditionalOutputItems } from "@/hooks/useTransformationAdditionalOutputItems";
import type { TransformationAdditionalOutputItem } from "@/types/transformation-template";

export type TemplateAdditionalOutputDialogValue = {
  item: TransformationAdditionalOutputItem;
  quantity: number;
  notes?: string;
};

type TemplateAdditionalOutputDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (value: TemplateAdditionalOutputDialogValue) => void;
  excludedItemIds: string[];
};

export function TemplateAdditionalOutputDialog({
  open,
  onOpenChange,
  onSave,
  excludedItemIds,
}: TemplateAdditionalOutputDialogProps) {
  const t = useTranslations("transformation");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<TransformationAdditionalOutputItem | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());
  const { data, isLoading, isError } = useTransformationAdditionalOutputItems({
    search: debouncedSearch || undefined,
    limit: 5,
    excludedItemIds,
  });

  const options = useMemo(() => data?.data ?? [], [data?.data]);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelectedItem(null);
    setQuantity("1");
    setNotes("");
    setError(null);
  }, [open]);

  const handleSave = () => {
    const outputQuantity = Number(quantity);
    if (!selectedItem) {
      setError(t("additionalOutputItemRequired"));
      return;
    }
    if (!Number.isFinite(outputQuantity) || outputQuantity <= 0) {
      setError(t("plannedQuantityGreaterThanZero"));
      return;
    }

    onSave({
      item: selectedItem,
      quantity: outputQuantity,
      notes: notes.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("addAdditionalOutput")}</DialogTitle>
          <DialogDescription>{t("additionalOutputDialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{tCommon("item")} *</label>
            <AsyncSearchCombobox
              value={selectedItem?.id ?? ""}
              onValueChange={(itemId) => {
                setSelectedItem(options.find((item) => item.id === itemId) ?? null);
                setError(null);
              }}
              searchValue={search}
              onSearchValueChange={setSearch}
              options={options}
              selectedOption={selectedItem}
              getOptionValue={(item) => item.id}
              getOptionLabel={(item) => `${item.item_code} - ${item.item_name}`}
              getOptionSearchValue={(item) => `${item.item_code} ${item.item_name}`}
              placeholder={t("selectAdditionalOutputItem")}
              searchPlaceholder={t("searchAdditionalOutputItems")}
              emptyMessage={
                isError ? t("additionalOutputItemsLoadError") : t("noAdditionalOutputItems")
              }
              loadingMessage={tCommon("loading")}
              isLoading={isLoading}
              renderOption={(item, selected) => (
                <div className="flex min-w-0 items-center gap-2">
                  <Check className={`h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`} />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{item.item_code}</div>
                    <div className="truncate text-xs text-muted-foreground">{item.item_name}</div>
                  </div>
                </div>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("quantityPerTemplate")} *</label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setError(null);
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("baseUnit")}</label>
              <Input
                value={
                  selectedItem
                    ? `${selectedItem.uom_code} - ${selectedItem.uom_name}`
                    : t("selectItemForBaseUnit")
                }
                disabled
              />
              <p className="text-xs text-muted-foreground">{t("baseUnitIsAutomatic")}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{tCommon("notes")}</label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t("additionalOutputNotesPlaceholder")}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" onClick={handleSave}>
            {t("addOutput")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
