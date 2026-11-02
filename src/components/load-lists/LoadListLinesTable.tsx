"use client";

import { useLocale, useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatLoadListAmount, formatLoadListQuantity } from "@/lib/load-lists/load-list-display";
import { getLoadListLineColumnWidth, type LoadListLineColumn } from "./load-list-line-columns";

export type LoadListLinesTableRow = {
  key: string;
  itemCode: string;
  itemName: string;
  unitLabel: string;
  qtyPerUnit: number;
  loadListQty: number;
  unitPrice: number | null;
  lineTotal: number | null;
  receivedQty?: number;
  damagedQty?: number;
  shortageQty?: number;
  isUnsaved?: boolean;
};

type LoadListLinesTableProps = {
  rows: LoadListLinesTableRow[];
  columns: LoadListLineColumn[];
  currency: string;
  totalAmount: number | null;
  emptyTitle: string;
  emptyDescription: string;
  onRemove?: (key: string) => void;
};

const NUMERIC_COLUMNS = new Set<LoadListLineColumn>([
  "qty",
  "totalQty",
  "receivedQty",
  "damagedQty",
  "shortageQty",
  "unitCost",
  "lineTotal",
]);

const cellPadding = "px-2 first:pl-0 last:pr-0";

export function LoadListLinesTable({
  rows,
  columns,
  currency,
  totalAmount,
  emptyTitle,
  emptyDescription,
  onRemove,
}: LoadListLinesTableProps) {
  const t = useTranslations("loadListPage");
  const locale = useLocale();
  const columnLabels: Record<LoadListLineColumn, string> = {
    item: t("item"),
    unit: t("unit"),
    qty: t("qty"),
    totalQty: t("totalQty"),
    receivedQty: t("receivedQty"),
    damagedQty: t("damagedQty"),
    shortageQty: t("shortageQty"),
    unitCost: t("unitCost"),
    lineTotal: t("lineTotal"),
    action: t("actions"),
  };
  const formatAmount = (value: number | null) =>
    value == null ? t("noValue") : formatLoadListAmount(value, currency, locale);
  const lineTotalIndex = columns.indexOf("lineTotal");

  const renderCell = (row: LoadListLinesTableRow, column: LoadListLineColumn) => {
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
          </>
        );
      case "unit":
        return (
          <>
            <div>{row.unitLabel}</div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              {t("qtyPerUnit", {
                qty: formatLoadListQuantity(row.qtyPerUnit, locale),
                unit: row.unitLabel,
              })}
            </div>
          </>
        );
      case "qty":
        return (
          <span className="font-semibold">{formatLoadListQuantity(row.loadListQty, locale)}</span>
        );
      case "totalQty":
        return formatLoadListQuantity(row.loadListQty * row.qtyPerUnit, locale);
      case "receivedQty":
        return formatLoadListQuantity(row.receivedQty ?? 0, locale);
      case "damagedQty":
        return (
          <span
            className={cn(
              (row.damagedQty ?? 0) > 0 && "font-semibold text-red-700 dark:text-red-400"
            )}
          >
            {formatLoadListQuantity(row.damagedQty ?? 0, locale)}
          </span>
        );
      case "shortageQty":
        return (
          <span
            className={cn(
              (row.shortageQty ?? 0) > 0 && "font-semibold text-orange-700 dark:text-orange-400"
            )}
          >
            {formatLoadListQuantity(row.shortageQty ?? 0, locale)}
          </span>
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

  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <caption className="sr-only">{t("itemsTitle")}</caption>
      <colgroup>
        {columns.map((column) => (
          <col key={column} style={{ width: getLoadListLineColumnWidth(columns, column) }} />
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
  );
}
