import { expect, it } from "vitest";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { StockAgingReportPDF, partitionStockAgingPdfGroups } from "./StockAgingReportPDF";
import type { StockAgingReportRow } from "@/types/stock-aging-report";

it.each(["item", "batch"] as const)(
  "renders a complete multi-page %s report with Unicode stock labels",
  async (groupBy) => {
    Font.getFont({ fontFamily: "ArialUnicode" }).src = path.resolve(
      "public/fonts/ArialUnicode.ttf"
    );
    const rows: StockAgingReportRow[] = Array.from({ length: 1000 }, (_, i) => ({
      id: `row-${i}`,
      itemId: "item",
      itemCode: "ITEM",
      itemName: "Matboard 木板",
      category: "Boards",
      warehouseId: "warehouse",
      warehouseCode: "WH",
      warehouseName: "Warehouse 仓库",
      locationId: `location-${i}`,
      locationCode: "BIN",
      locationName: "Bin",
      locationPath: "Rack 01 / Shelf 02 / Bin 03",
      itemBatchId: `batch-${i}`,
      batchCode: `BATCH-${i}`,
      batchReceivedAt: "2025-01-01T00:00:00Z",
      batchAgeDays: 399,
      batchAgeDuration: { years: 1, months: 1, days: 3 },
      ageBucket: "181_plus",
      qtyOnHand: 2,
      qtyReserved: 0,
      qtyAvailable: 2,
      unitCost: 3,
      stockValue: 6,
      batchLocationSku: null,
      updatedAt: "2026-01-01T00:00:00Z",
    }));
    const groups = [
      {
        id: "group",
        title: groupBy === "item" ? "Matboard 木板" : "LOT-001",
        subtitle: groupBy === "item" ? "ITEM • Boards" : null,
        rows,
        subtotalQtyOnHand: 2000,
        subtotalQtyReserved: 0,
        subtotalQtyAvailable: 2000,
        subtotalStockValue: 6000,
        oldestAgeDays: 399,
      },
    ];
    const sections = partitionStockAgingPdfGroups(groups);
    expect(sections.flatMap((section) => section.flatMap((group) => group.rows))).toEqual(rows);
    expect(
      sections.every((section) => section.reduce((sum, group) => sum + group.rows.length, 0) <= 50)
    ).toBe(true);
    expect(sections.flat().filter((group) => group.showSubtotal)).toEqual([
      { ...groups[0], rows: rows.slice(-50), showSubtotal: true, totalRows: 1000 },
    ]);
    expect(partitionStockAgingPdfGroups([])).toEqual([[]]);
    let pageCount = 0;
    const durations = new Set<string>();
    const start = performance.now();
    const buffer = await renderToBuffer(
      <StockAgingReportPDF
        title="Stock Aging"
        subtitle="Stock by location"
        generatedAtLabel="Generated"
        warehouseLocationLabel="Location"
        detailLabel={groupBy === "item" ? "Batch" : "Item"}
        groupBy={groupBy}
        ageDaysLabel="Age"
        ageDurationLabel={(years, months, days) => {
          const label = `${years} y ${months} m ${days} d`;
          durations.add(label);
          return label;
        }}
        qtyOnHandLabel="On Hand"
        qtyReservedLabel="Reserved"
        qtyAvailableLabel="Available"
        stockValueLabel="Value"
        subtotalLabel={groupBy === "item" ? "Item Subtotal" : "Batch Subtotal"}
        oldestAgeLabel={(value) => `Oldest: ${value} days`}
        rowCountLabel={(count) => `${count} stock rows`}
        noValueLabel="--"
        groups={groups}
        pageLabel={(page, total) => {
          if (Number.isFinite(total)) pageCount = Math.max(pageCount, total);
          return `${page} / ${total}`;
        }}
      />
    );
    console.info(
      `Stock aging PDF: ${Math.round(performance.now() - start)}ms, ${buffer.length} bytes, ${pageCount} pages`
    );
    if (process.env.STOCK_AGING_PDF_OUTPUT)
      await writeFile(`${process.env.STOCK_AGING_PDF_OUTPUT}-${groupBy}.pdf`, buffer);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(pageCount).toBeGreaterThan(1);
    expect([...durations]).toEqual(["1 y 1 m 3 d"]);
  },
  120000
);
