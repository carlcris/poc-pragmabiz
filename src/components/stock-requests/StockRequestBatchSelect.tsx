"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { DocumentLineBatchFieldState } from "@/components/document-page/DocumentLineEntry";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLookupStockRequestBatches } from "@/hooks/useLookups";
import { formatDocumentQuantity } from "@/lib/documents/document-display";
import type { StockRequestLineBatch } from "@/types/stock-request";

type StockRequestBatchSelectProps = DocumentLineBatchFieldState<StockRequestLineBatch> & {
  fulfillingBusinessUnitId: string;
};

// Picking this entry clears the pinned batch so the line falls back to FIFO allocation.
const AUTO_BATCH_ID = "auto";

export function StockRequestBatchSelect({
  fulfillingBusinessUnitId,
  itemId,
  value,
  onChange,
  triggerId,
  triggerRef,
  invalid,
  describedBy,
}: StockRequestBatchSelectProps) {
  const t = useTranslations("stockRequestPage");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const { data, isLoading } = useLookupStockRequestBatches({
    fulfillingBusinessUnitId,
    itemId: itemId ?? undefined,
    search: debouncedSearch || undefined,
    page: 1,
  });
  const options = useMemo<StockRequestLineBatch[]>(
    () => [
      { id: AUTO_BATCH_ID, code: t("autoBatch"), warehouseCode: "" },
      ...(data?.data ?? []).map((batch) => ({
        id: batch.id,
        code: batch.batchCode,
        warehouseCode: batch.warehouseCode,
        availableBaseQty: batch.availableBaseQty,
      })),
    ],
    [data?.data, t]
  );

  return (
    <AsyncSearchCombobox
      value={value?.id ?? ""}
      onValueChange={(batchId) =>
        onChange(
          batchId === AUTO_BATCH_ID
            ? null
            : (options.find((option) => option.id === batchId) ?? null)
        )
      }
      searchValue={search}
      onSearchValueChange={setSearch}
      options={options}
      selectedOption={value}
      getOptionValue={(batch) => batch.id}
      getOptionLabel={(batch) =>
        batch.warehouseCode ? `${batch.code} · ${batch.warehouseCode}` : batch.code
      }
      getOptionSearchValue={(batch) => `${batch.code} ${batch.warehouseCode}`}
      renderOption={(batch) => (
        <div className="min-w-0">
          <div className="truncate">{batch.code}</div>
          {batch.id !== AUTO_BATCH_ID ? (
            <div className="text-xs text-muted-foreground">
              {[
                batch.warehouseCode,
                batch.availableBaseQty !== undefined
                  ? t("batchAvailable", {
                      qty: formatDocumentQuantity(batch.availableBaseQty, locale),
                    })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">{t("autoBatchHint")}</div>
          )}
        </div>
      )}
      placeholder={fulfillingBusinessUnitId ? t("autoBatch") : t("selectRequestedToFirst")}
      searchPlaceholder={t("searchBatch")}
      emptyMessage={t("noBatchesAvailable")}
      loadingMessage={t("loadingBatches")}
      isLoading={isLoading}
      disabled={!fulfillingBusinessUnitId || !itemId}
      triggerRef={triggerRef}
      triggerId={triggerId}
      invalid={invalid}
      describedBy={describedBy}
      buttonClassName="h-10 bg-background"
      popoverClassName="lg:w-80"
    />
  );
}
