"use client";

import { useLocale, useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { formatDocumentAmount, formatDocumentQuantity } from "@/lib/documents/document-display";
import {
  getDocumentLineColumnWidth,
  getDocumentLineTableMinWidth,
  type DocumentLineColumn,
  type DocumentTrackingColumn,
} from "./document-line-columns";

export type DocumentLinesTableRow = {
  key: string;
  itemCode: string;
  itemName: string;
  unitLabel: string;
  uomCode: string;
  qtyPerUnit: number;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  tracking?: Partial<Record<DocumentTrackingColumn, number>>;
  /** Pinned source batch; null means the line is allocated automatically. */
  batch?: { code: string; warehouseCode?: string } | null;
  note?: string;
  isUnsaved?: boolean;
};

type DocumentLinesTableProps = {
  rows: DocumentLinesTableRow[];
  columns: DocumentLineColumn[];
  currency: string;
  totalAmount: number | null;
  emptyTitle: string;
  emptyDescription: string;
  onRemove?: (key: string) => void;
};

const NUMERIC_COLUMNS = new Set<DocumentLineColumn>([
  "qty",
  "totalQty",
  "receivedQty",
  "damagedQty",
  "shortageQty",
  "fulfilledQty",
  "outstandingQty",
  "deliveredQty",
  "unitCost",
  "lineTotal",
]);

// Nonzero values in these columns need attention, so they carry a semantic color.
const TRACKING_ALERT_CLASSES: Partial<Record<DocumentTrackingColumn, string>> = {
  damagedQty: "font-semibold text-red-700 dark:text-red-400",
  shortageQty: "font-semibold text-orange-700 dark:text-orange-400",
  outstandingQty: "font-semibold text-orange-700 dark:text-orange-400",
};

const cellPadding = "px-2 first:pl-0 last:pr-0";

export function DocumentLinesTable({
  rows,
  columns,
  currency,
  totalAmount,
  emptyTitle,
  emptyDescription,
  onRemove,
}: DocumentLinesTableProps) {
  const t = useTranslations("documentLines");
  const locale = useLocale();
  const columnLabels: Record<DocumentLineColumn, string> = {
    item: t("item"),
    unit: t("unit"),
    qty: t("qty"),
    totalQty: t("totalQty"),
    receivedQty: t("receivedQty"),
    damagedQty: t("damagedQty"),
    shortageQty: t("shortageQty"),
    fulfilledQty: t("fulfilledQty"),
    outstandingQty: t("outstandingQty"),
    deliveredQty: t("deliveredQty"),
    batch: t("batch"),
    unitCost: t("unitCost"),
    lineTotal: t("lineTotal"),
    action: t("actions"),
  };
  const formatAmount = (value: number | null) =>
    value == null ? t("noValue") : formatDocumentAmount(value, currency, locale);
  const lineTotalIndex = columns.indexOf("lineTotal");
  // Phones get one stacked row per line; md and up keep the table. Callers render these
  // lines after their data loads on the client, so the hydration-time table never shows.
  const isStackedLayout = useMediaQuery("(max-width: 767px)") === true;

  const renderTrackingCell = (row: DocumentLinesTableRow, column: DocumentTrackingColumn) => {
    const value = row.tracking?.[column] ?? 0;
    return (
      <span className={cn(value > 0 && TRACKING_ALERT_CLASSES[column])}>
        {formatDocumentQuantity(value, locale)}
      </span>
    );
  };

  const renderCell = (row: DocumentLinesTableRow, column: DocumentLineColumn) => {
    switch (column) {
      case "item":
        return (
          <>
            <div className="font-semibold">
              {row.itemCode}
              {row.isUnsaved ? (
                <span className="ml-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {t("notSaved")}
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">{row.itemName}</div>
            {row.note ? (
              <div className="mt-0.5 text-xs italic text-muted-foreground">{row.note}</div>
            ) : null}
          </>
        );
      case "unit":
        return (
          <>
            <div>{row.unitLabel}</div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              {t("qtyPerUnit", {
                qty: formatDocumentQuantity(row.qtyPerUnit, locale),
                unit: row.uomCode || row.unitLabel,
              })}
            </div>
          </>
        );
      case "qty":
        return (
          <span className="font-semibold">{formatDocumentQuantity(row.quantity, locale)}</span>
        );
      case "totalQty":
        return formatDocumentQuantity(row.quantity * row.qtyPerUnit, locale);
      case "receivedQty":
      case "damagedQty":
      case "shortageQty":
      case "fulfilledQty":
      case "outstandingQty":
      case "deliveredQty":
        return renderTrackingCell(row, column);
      case "batch":
        return row.batch ? (
          <>
            <div className="font-medium">{row.batch.code}</div>
            {row.batch.warehouseCode ? (
              <div className="mt-0.5 text-sm text-muted-foreground">{row.batch.warehouseCode}</div>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">{t("autoBatch")}</span>
        );
      case "unitCost":
        return formatAmount(row.unitPrice);
      case "lineTotal":
        return <span className="font-semibold">{formatAmount(row.lineTotal)}</span>;
      case "action":
        return onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(row.key)}
            aria-label={t("removeLine", { code: row.itemCode })}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null;
    }
  };

  if (isStackedLayout) {
    // Quantity, unit and amounts collapse into one summary line; only tracking and batch
    // columns stay as labelled values.
    const SUMMARY_COLUMNS = new Set<DocumentLineColumn>([
      "item",
      "action",
      "unit",
      "qty",
      "totalQty",
      "unitCost",
      "lineTotal",
    ]);
    const detailColumns = columns.filter((column) => !SUMMARY_COLUMNS.has(column));
    const showTotal = lineTotalIndex > 0 && rows.length > 0;

    return (
      <div className="text-sm">
        {rows.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-medium">{emptyTitle}</p>
            <p className="mt-1 text-muted-foreground">{emptyDescription}</p>
          </div>
        ) : (
          <ul>
            {rows.map((row) => (
              <li key={row.key} className="flex flex-col gap-3 border-b py-4 last:border-b-0">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">{renderCell(row, "item")}</div>
                  {columns.includes("action") && onRemove ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onRemove(row.key)}
                      aria-label={t("removeLine", { code: row.itemCode })}
                      className="-mr-2.5 -mt-2 h-11 w-11 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div>
                      <span className="font-semibold tabular-nums">
                        {formatDocumentQuantity(row.quantity, locale)}
                      </span>{" "}
                      {row.unitLabel}
                    </div>
                    <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                      {[
                        columns.includes("totalQty") &&
                          row.qtyPerUnit !== 1 &&
                          `${columnLabels.totalQty} ${formatDocumentQuantity(row.quantity * row.qtyPerUnit, locale)}`,
                        columns.includes("unitCost") &&
                          `${columnLabels.unitCost} ${formatAmount(row.unitPrice)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  {columns.includes("lineTotal") ? (
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatAmount(row.lineTotal)}
                    </span>
                  ) : null}
                </div>
                {detailColumns.length > 0 ? (
                  <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
                    {detailColumns.map((column) => (
                      <div key={column} className="flex min-w-0 flex-col">
                        <dt className="text-xs text-muted-foreground">{columnLabels[column]}</dt>
                        <dd className={cn(NUMERIC_COLUMNS.has(column) && "tabular-nums")}>
                          {renderCell(row, column)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {showTotal ? (
          <div className="flex items-baseline justify-between border-t py-4">
            <span className="text-muted-foreground">{t("total")}</span>
            <span className="text-base font-bold tabular-nums">{formatAmount(totalAmount)}</span>
          </div>
        ) : null}
      </div>
    );
  }

  // From md the table keeps a column-based minimum width and scrolls instead of squeezing.
  return (
    <div className="overflow-x-auto">
      <table
        className="w-full table-fixed border-collapse text-sm"
        style={{ minWidth: getDocumentLineTableMinWidth(columns) }}
      >
        <caption className="sr-only">{t("itemsTitle")}</caption>
        <colgroup>
          {columns.map((column) => (
            <col key={column} style={{ width: getDocumentLineColumnWidth(columns, column) }} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b">
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className={cn(
                  cellPadding,
                  "py-3 font-medium text-muted-foreground",
                  NUMERIC_COLUMNS.has(column) ? "text-right" : "text-left"
                )}
              >
                <span className={cn(column === "action" && "sr-only")}>{columnLabels[column]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-10 text-center">
                <p className="font-medium">{emptyTitle}</p>
                <p className="mt-1 text-muted-foreground">{emptyDescription}</p>
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.key} className="border-b last:border-b-0">
                {columns.map((column) => (
                  <td
                    key={column}
                    className={cn(
                      cellPadding,
                      "py-3.5 align-middle",
                      NUMERIC_COLUMNS.has(column) && "text-right tabular-nums",
                      column === "action" && "text-right"
                    )}
                  >
                    {renderCell(row, column)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {lineTotalIndex > 0 && rows.length > 0 ? (
          <tfoot>
            <tr className="border-t">
              <td
                colSpan={lineTotalIndex}
                className={cn(cellPadding, "py-4 text-right text-muted-foreground")}
              >
                {t("total")}
              </td>
              <td className={cn(cellPadding, "py-4 text-right text-base font-bold tabular-nums")}>
                {formatAmount(totalAmount)}
              </td>
              {columns.length > lineTotalIndex + 1 ? (
                <td colSpan={columns.length - lineTotalIndex - 1} />
              ) : null}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
