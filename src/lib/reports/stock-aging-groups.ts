import type {
  StockAgingGroupBy,
  StockAgingReportGroup,
  StockAgingReportRow,
} from "@/types/stock-aging-report";

// Group the complete bounded export once. Metadata indexes reference the returned
// row array, so the API does not duplicate thousands of rows in its JSON payload.
// Input is sorted by age descending: Map insertion order keeps groups ordered by
// their oldest row, and each bucket retains descending age within the group.
export function groupStockAgingRows(rows: StockAgingReportRow[], groupBy: StockAgingGroupBy) {
  const buckets = new Map<string, StockAgingReportRow[]>();
  for (const row of rows) {
    const key =
      groupBy === "item"
        ? row.itemId
        : row.batchCode
          ? `code:${row.batchCode}`
          : `id:${row.itemBatchId}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }
  const data: StockAgingReportRow[] = [];
  const groups: StockAgingReportGroup[] = [];
  for (const [id, bucket] of buckets) {
    const first = bucket[0];
    const group: StockAgingReportGroup = {
      id,
      title:
        groupBy === "item"
          ? first.itemName || first.itemCode || first.itemId
          : first.batchCode || first.itemBatchId,
      subtitle:
        groupBy === "item" ? [first.itemCode, first.category].filter(Boolean).join(" • ") : null,
      startIndex: data.length,
      rowCount: bucket.length,
      subtotalQtyOnHand: 0,
      subtotalQtyReserved: 0,
      subtotalQtyAvailable: 0,
      subtotalStockValue: 0,
      oldestAgeDays: 0,
    };
    for (const row of bucket) {
      group.subtotalQtyOnHand += row.qtyOnHand;
      group.subtotalQtyReserved += row.qtyReserved;
      group.subtotalQtyAvailable += row.qtyAvailable;
      group.subtotalStockValue += row.stockValue;
      group.oldestAgeDays = Math.max(group.oldestAgeDays, row.batchAgeDays);
      data.push(row);
    }
    groups.push(group);
  }
  return { data, groups };
}
