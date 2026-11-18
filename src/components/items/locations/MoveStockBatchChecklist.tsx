"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useMoveStockSourceBatches } from "@/hooks/useMoveStockSourceBatches";
import type { StockMoveBatchSelectionState } from "@/lib/stock-move-batch-selection";
import {
  countSelectedBatches,
  isBatchChecked,
  masterCheckedState,
} from "@/lib/stock-move-batch-selection";

type MoveStockBatchChecklistProps = {
  itemId: string;
  businessUnitId: string | undefined;
  warehouseId: string;
  locationId: string;
  baseUnit: string;
  selection: StockMoveBatchSelectionState;
  namedAvailability?: ReadonlyMap<string, number>;
  onToggleBatch: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  disabled?: boolean;
  listId: string;
};

const PAGE_SIZE = 5;

export function MoveStockBatchChecklist({
  itemId,
  businessUnitId,
  warehouseId,
  locationId,
  baseUnit,
  selection,
  namedAvailability,
  onToggleBatch,
  onToggleAll,
  disabled = false,
  listId,
}: MoveStockBatchChecklistProps) {
  const t = useTranslations("itemLocationsTab");
  const pagination = useTranslations("pagination");
  const [paging, setPaging] = useState({ scope: "", page: 1 });
  // Paging resets whenever the source changes, so a page number never carries
  // over to a different result set.
  const scope = JSON.stringify([warehouseId, locationId]);
  const page = paging.scope === scope ? paging.page : 1;
  useEffect(() => {
    if (paging.scope !== scope) setPaging({ scope, page: 1 });
  }, [paging.scope, scope]);

  const { data, isFetching, isError, refetch } = useMoveStockSourceBatches({
    itemId,
    businessUnitId,
    warehouseId,
    locationId,
    page,
  });

  const options = data?.data ?? [];
  const isLoading = isFetching;
  const selectedCount = countSelectedBatches(selection);
  // The master box reflects the whole eligible set, not the loaded page: "all"
  // is exclude mode with no exceptions, "none" is include mode with no picks.
  const masterState = masterCheckedState(selection);

  return (
    <div className="space-y-2">
      <div className="rounded-md border" id={listId}>
        <div className="flex items-center gap-2 border-b p-2">
          <Checkbox
            id={`${listId}-all`}
            checked={masterState}
            disabled={disabled}
            onCheckedChange={(checked) => onToggleAll(checked === true)}
          />
          <Label htmlFor={`${listId}-all`} className="cursor-pointer">
            {t("moveBatchSelectAll")}
          </Label>
        </div>
        <ul className="divide-y" aria-busy={isLoading}>
          {options.map((batch) => (
            <li key={batch.id} className="flex items-start gap-2 p-2">
              <Checkbox
                id={`${listId}-${batch.id}`}
                className="mt-1"
                checked={isBatchChecked(selection, batch.id)}
                disabled={disabled}
                onCheckedChange={(checked) => onToggleBatch(batch.id, checked === true)}
              />
              <Label htmlFor={`${listId}-${batch.id}`} className="min-w-0 cursor-pointer">
                <span className="block truncate">{batch.batchCode}</span>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {t("moveBatchAvailable", {
                    quantity: namedAvailability?.get(batch.id) ?? batch.qtyAvailable,
                    unit: baseUnit,
                  })}
                </span>
              </Label>
            </li>
          ))}
        </ul>
        {isLoading || isError || options.length === 0 ? (
          <div className="flex items-center justify-between gap-2 border-t p-2">
            <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
              {isLoading
                ? t("moveBatchesLoading")
                : isError
                  ? t("moveBatchesError")
                  : t("moveBatchesEmpty")}
            </p>
            {isError && !isLoading ? (
              <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                {t("moveBatchesRetry")}
              </Button>
            ) : null}
          </div>
        ) : null}
        {page > 1 || data?.hasMore ? (
          <div className="flex items-center justify-between border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={pagination("goToPreviousPage")}
              disabled={disabled || page === 1 || isLoading}
              onClick={() => setPaging({ scope, page: page - 1 })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={pagination("goToNextPage")}
              disabled={disabled || !data?.hasMore || isLoading}
              onClick={() => setPaging({ scope, page: page + 1 })}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {selection.mode === "exclude"
          ? selectedCount === 0
            ? t("moveBatchAllSelected")
            : t("moveBatchAllExceptSelected", { count: selectedCount })
          : selectedCount === 0
            ? t("moveBatchNoneSelected")
            : t("moveBatchCountSelected", { count: selectedCount })}{" "}
        {page > 1 || data?.hasMore ? t("moveBatchPageContext", { page, size: PAGE_SIZE }) : null}
      </p>
    </div>
  );
}
