import { expect, it } from "vitest";
import { Font } from "@react-pdf/renderer";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getItemLocationGroupSubtotals,
  orderItemLocationReportRows,
} from "@/lib/reports/item-location-report-groups";
import { PDFDocument } from "pdf-lib";
import { buildItemLocationReportPdf } from "@/lib/reports/build-item-location-report-pdf";
import {
  ItemLocationBatchReportPDF,
  type ItemLocationBatchReportPDFProps,
} from "./ItemLocationBatchReportPDF";

it("renders a large Unicode location report across bounded render jobs", async () => {
  Font.register({ family: "ArialUnicode", src: path.resolve("public/fonts/ArialUnicode.ttf") });
  const count = Number(process.env.ITEM_LOCATION_PDF_TEST_ROWS || 1000);
  const props: ItemLocationBatchReportPDFProps = {
    title: "Item Locations 商品库位",
    subtitle: "Grouped by batch",
    generatedAtLabel: "Generated",
    generatedAt: "2026-11-12 14:30:00",
    itemLabel: "Item",
    warehouseLocationLabel: "Warehouse / Location",
    batchLabel: "Batch",
    locationSkuLabel: "Location SKU",
    onHandLabel: "On Hand",
    reservedLabel: "Reserved",
    availableLabel: "Available",
    noValueLabel: "--",
    groupBy: process.env.ITEM_LOCATION_PDF_GROUP_BY === "item" ? "item" : "batch",
    noRowsLabel: "No rows",
    subtotalLabel: "Subtotal",
    groupSubtotals: {},
    rows: Array.from({ length: count }, (_, index) => ({
      id: String(index),
      itemId: `item-${index % 3}`,
      itemCode: `GLASS-${index % 3}`,
      itemName: "玻璃 Clear Glass",
      warehouseId: "wh",
      warehouseCode: "WH01",
      warehouseName: "Warehouse",
      locationId: String(index),
      locationCode: "BIN",
      locationName: "Bin",
      locationPath: "Zone / Rack / Shelf / Bin",
      itemBatchId: `batch-record-${index}`,
      batchCode: `BATCH-${Math.floor(index / 5)}`,
      batchReceivedAt: "2026-01-01",
      batchAgeDays: 100,
      batchLocationSku: String(index).padStart(10, "0"),
      qtyOnHand: 10,
      qtyReserved: 1,
      qtyAvailable: 9,
      updatedAt: "2026-11-11T00:00:00Z",
    })),
  };
  props.rows = orderItemLocationReportRows(props.rows, props.groupBy, "en");
  props.groupSubtotals = getItemLocationGroupSubtotals(props.rows, props.groupBy);
  const document = ItemLocationBatchReportPDF(props);
  // A render job wraps a single table so smaller sections do not force new pages.
  expect(document.props.children.type).toBe("PAGE");
  const started = performance.now();
  const buffer = Buffer.from(await (await buildItemLocationReportPdf(props)).arrayBuffer());
  const pages = (await PDFDocument.load(buffer)).getPageCount();
  console.info(
    `Item locations PDF: ${count} rows, ${Math.round(performance.now() - started)}ms, ${buffer.length} bytes, ${pages} pages`
  );
  expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  expect(pages).toBeGreaterThan(1);
  if (process.env.ITEM_LOCATION_PDF_OUTPUT)
    await writeFile(process.env.ITEM_LOCATION_PDF_OUTPUT, buffer);
}, 180_000);
