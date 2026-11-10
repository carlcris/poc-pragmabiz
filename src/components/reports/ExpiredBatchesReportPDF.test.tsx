import { expect, it } from "vitest";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { ExpiredBatchesReportPDF } from "./ExpiredBatchesReportPDF";
import type { ExpiredBatchRow } from "@/types/expired-batches-report";

it.each(["item", "batch"] as const)(
  "renders a grouped %s report with Unicode labels and subtotals",
  async (groupBy) => {
    Font.getFont({ fontFamily: "ArialUnicode" }).src = path.resolve(
      "public/fonts/ArialUnicode.ttf"
    );
    const rows: ExpiredBatchRow[] = Array.from({ length: 31 }, (_, index) => ({
      id: String(index),
      itemId: "item",
      itemCode: "GLS 0018",
      itemName: "玻璃 JIS CLEAR GLASS",
      warehouseId: "wh",
      warehouse: "WH01 - Warehouse 仓库",
      batchCode: `LOT-${index}`,
      expirationDate: "2026-04-01",
      daysExpired: 223,
      qtyOnHand: 12,
      qtyReserved: 1,
      qtyAvailable: 11,
      unit: "SHEET",
      groupKey: index < 16 ? "a" : "b",
      groupLabel: index < 16 ? "GLASS 玻璃" : "Other 其他",
    }));
    const buffer = await renderToBuffer(
      <ExpiredBatchesReportPDF
        rows={rows}
        groupBy={groupBy}
        locale="en"
        subtitle="31 expired batches before 2026-11-10"
        labels={{
          title: "Expired Batches",
          subtotal: "Subtotal",
          generatedAt: "Generated At",
          empty: "No expired batches",
          item: "Item",
          batch: "Batch",
          warehouse: "Warehouse",
          expiration: "Expiration",
          daysExpired: "Days expired",
          onHand: "On Hand",
          reserved: "Reserved",
          available: "Available",
          unit: "Unit",
        }}
      />
    );
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    const pageCount = buffer.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;
    expect(pageCount).toBeGreaterThanOrEqual(3);
    expect(pageCount).toBeLessThanOrEqual(5);
    await writeFile(`/tmp/expired-batches-report-${groupBy}-test.pdf`, buffer);
  },
  30000
);
