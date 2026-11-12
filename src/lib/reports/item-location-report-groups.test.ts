import { expect, it } from "vitest";
import {
  orderItemLocationReportRows,
  itemLocationBatchGroupKey,
} from "./item-location-report-groups";
import type { ItemLocationBatchReportRow } from "@/hooks/useItemLocationBatchReport";

const row = (id: string, itemId: string, batchCode: string | null, warehouseCode = "WH1") =>
  ({
    id,
    itemId,
    itemCode: itemId,
    itemName: itemId,
    batchCode,
    itemBatchId: `record-${id}`,
    warehouseCode,
    locationPath: `Bin ${id}`,
  }) as ItemLocationBatchReportRow;
const rows = [
  row("1", "item 2", "batch 2"),
  row("2", "item 1", "batch 1"),
  row("3", "item 3", "batch 1"),
  row("4", "item 1", "batch 2"),
  row("5", "item 2", "batch 1"),
  row("6", "item 1", "batch 1", "WH2"),
];
it("combines the same batch code across item and warehouse batch records", () => {
  const grouped = orderItemLocationReportRows(rows, "batch", "en");
  expect(grouped.map((r) => [r.batchCode, r.itemId])).toEqual([
    ["batch 1", "item 1"],
    ["batch 1", "item 1"],
    ["batch 1", "item 2"],
    ["batch 1", "item 3"],
    ["batch 2", "item 1"],
    ["batch 2", "item 2"],
  ]);
  expect(itemLocationBatchGroupKey(grouped[0])).toBe(itemLocationBatchGroupKey(grouped[1]));
  expect(grouped[0].itemBatchId).not.toBe(grouped[1].itemBatchId);
});
it("nests batches beneath each item and preserves every location row", () => {
  const grouped = orderItemLocationReportRows(rows, "item", "en");
  expect(grouped.map((r) => [r.itemId, r.batchCode])).toEqual([
    ["item 1", "batch 1"],
    ["item 1", "batch 1"],
    ["item 1", "batch 2"],
    ["item 2", "batch 1"],
    ["item 2", "batch 2"],
    ["item 3", "batch 1"],
  ]);
  expect(grouped.map((r) => r.id).sort()).toEqual(rows.map((r) => r.id).sort());
  expect(rows[0].id).toBe("1");
});
it("collates item groups in the requested locale", () => {
  const named = ["张", "阿", "李"].map((name, index) => ({
    ...row(String(index), name, "batch"),
    itemName: name,
  }));
  expect(orderItemLocationReportRows(named, "item", "zh").map((r) => r.itemName)).toEqual(
    [...named.map((r) => r.itemName)].sort(new Intl.Collator("zh").compare)
  );
});
it("keeps batches without codes separate", () => {
  expect(itemLocationBatchGroupKey(row("1", "item", null))).not.toBe(
    itemLocationBatchGroupKey(row("2", "item", null))
  );
});

it.each(["batch", "item"] as const)(
  "totals complete %s groups only at their final row across chunk boundaries",
  async (groupBy) => {
    const { getItemLocationGroupSubtotals } = await import("./item-location-report-groups");
    const locations = Array.from({ length: 501 }, (_, index) => ({
      ...row(String(index), index < 500 ? "item 1" : "item 2", index < 500 ? "batch 1" : "batch 2"),
      qtyOnHand: 1.25,
      qtyReserved: 0.25,
      qtyAvailable: 1,
    }));
    const subtotals = getItemLocationGroupSubtotals(locations, groupBy);
    expect(Object.keys(subtotals)).toEqual(["499", "500"]);
    expect(subtotals["499"]).toEqual({ qtyOnHand: 625, qtyReserved: 125, qtyAvailable: 500 });
    expect(subtotals["500"]).toEqual({ qtyOnHand: 1.25, qtyReserved: 0.25, qtyAvailable: 1 });
    expect(subtotals["24"]).toBeUndefined();
    expect(subtotals["249"]).toBeUndefined();
  }
);
it("totals shared batch codes across distinct items and warehouses, including empty stock", async () => {
  const { getItemLocationGroupSubtotals } = await import("./item-location-report-groups");
  const locations = [
    { ...row("1", "item 1", "batch 1"), qtyOnHand: 10.5, qtyReserved: 2, qtyAvailable: 8.5 },
    { ...row("2", "item 2", "batch 1", "WH2"), qtyOnHand: 4.5, qtyReserved: 1.5, qtyAvailable: 3 },
    { ...row("3", "item 3", "batch 1"), qtyOnHand: 0, qtyReserved: 0, qtyAvailable: 0 },
  ];
  expect(getItemLocationGroupSubtotals(locations, "batch")).toEqual({
    "3": { qtyOnHand: 15, qtyReserved: 3.5, qtyAvailable: 11.5 },
  });
  expect(getItemLocationGroupSubtotals([], "batch")).toEqual({});
});
