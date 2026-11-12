import type { ItemLocationBatchReportRow } from "@/hooks/useItemLocationBatchReport";
import type { Locale } from "@/lib/i18n";

export type ItemLocationReportGroupBy = "item" | "batch";

export const isItemLocationReportGroupBy = (value: string): value is ItemLocationReportGroupBy =>
  value === "item" || value === "batch";

// A batch code represents the report batch across item/warehouse batch records.
// Missing codes must not combine unrelated batches into one group.
export const itemLocationBatchGroupKey = (row: ItemLocationBatchReportRow): string =>
  row.batchCode ? `code:${row.batchCode}` : `id:${row.itemBatchId}`;

export function orderItemLocationReportRows(
  rows: ItemLocationBatchReportRow[],
  groupBy: ItemLocationReportGroupBy,
  locale: Locale
): ItemLocationBatchReportRow[] {
  // Collate in the viewer's locale so group order matches the language they read.
  const collator = new Intl.Collator(locale);
  const compare = (left: string | null, right: string | null) =>
    collator.compare(left ?? "", right ?? "");
  return [...rows].sort((left, right) => {
    const batchOrder = compare(itemLocationBatchGroupKey(left), itemLocationBatchGroupKey(right));
    const itemOrder =
      compare(left.itemName, right.itemName) ||
      compare(left.itemCode, right.itemCode) ||
      compare(left.itemId, right.itemId);
    return (
      (groupBy === "batch" ? batchOrder || itemOrder : itemOrder || batchOrder) ||
      compare(left.warehouseCode, right.warehouseCode) ||
      compare(left.locationPath, right.locationPath) ||
      compare(left.id, right.id)
    );
  });
}

export type ItemLocationGroupSubtotal = {
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
};

// Key each subtotal by its group's last location row, so it is rendered once
// even when the group crosses database, PDF-job, or page-section boundaries.
export function getItemLocationGroupSubtotals(
  rows: ItemLocationBatchReportRow[],
  groupBy: ItemLocationReportGroupBy
): Record<string, ItemLocationGroupSubtotal> {
  const groups = new Map<string, ItemLocationGroupSubtotal & { lastRowId: string }>();
  for (const row of rows) {
    const key = groupBy === "item" ? row.itemId : itemLocationBatchGroupKey(row);
    const total = groups.get(key) ?? {
      qtyOnHand: 0,
      qtyReserved: 0,
      qtyAvailable: 0,
      lastRowId: row.id,
    };
    total.qtyOnHand += row.qtyOnHand;
    total.qtyReserved += row.qtyReserved;
    total.qtyAvailable += row.qtyAvailable;
    total.lastRowId = row.id;
    groups.set(key, total);
  }
  return Object.fromEntries(
    [...groups.values()].map(({ lastRowId, ...total }) => [lastRowId, total])
  );
}
