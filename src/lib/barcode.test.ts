import { describe, expect, it } from "vitest";

import { generateBarcodeLabelsPDF, type BarcodeData } from "./barcode";

const label: BarcodeData = {
  boxId: "box-1",
  batchLocationSku: "BATCH-LOCATION-00001",
  batchNumber: "BATCH-001",
  grnNumber: "GRN-001",
  itemCode: "ITEM-001",
  itemName: "A long item name that needs to wrap across the available label space",
  boxNumber: 1,
  qtyPerBox: 12,
  deliveryDate: "2026-10-19",
  warehouseCode: "MAIN-WAREHOUSE",
  locationCode: "LONG-RACK-LOCATION-CODE",
};

describe("generateBarcodeLabelsPDF", () => {
  it("creates one landscape 4 × 2-inch page for each label", async () => {
    const pdf = await generateBarcodeLabelsPDF([label, { ...label, boxId: "box-2" }]);
    const pdfText = await pdf.text();
    const mediaBoxes = [...pdfText.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)];

    expect(mediaBoxes).toHaveLength(2);
    for (const [, width, height] of mediaBoxes) {
      expect(Number(width)).toBeCloseTo(288, 1);
      expect(Number(height)).toBeCloseTo(144, 1);
    }
  });

  it("groups quantity directly below the warehouse and location", async () => {
    const pdf = await generateBarcodeLabelsPDF([
      { ...label, warehouseCode: "WH-BU02", locationCode: "WHB-A", qtyPerBox: 144 },
    ]);
    const pdfText = await pdf.text();
    const location = pdfText.match(/([\d.]+)\s+([\d.]+)\s+Td\s*\(WH-BU02 \| WHB-A\) Tj/);
    const quantity = pdfText.match(/([\d.]+)\s+([\d.]+)\s+Td\s*\(Qty: 144\) Tj/);

    expect(location).not.toBeNull();
    expect(quantity).not.toBeNull();
    // PDF coordinates rise upward; the baselines should be about 5 mm apart.
    const baselineGap = Number(location?.[2]) - Number(quantity?.[2]);
    expect(baselineGap).toBeGreaterThan(11);
    expect(baselineGap).toBeLessThan(20);
  });

  it("keeps quantity inside the label below a wrapped location", async () => {
    const pdfText = await (await generateBarcodeLabelsPDF([label])).text();
    const location = pdfText.match(
      /([\d.]+) TL\s+0 g\s+[\d.]+ ([\d.]+) Td\s+\(MAIN-WAREHOUSE \|\) Tj\s+T\* \(LONG-RACK-LOCATION-CODE\) Tj/
    );
    const quantity = pdfText.match(/[\d.]+ ([\d.]+) Td\s+\(Qty: 12\) Tj/);

    expect(location).not.toBeNull();
    expect(quantity).not.toBeNull();
    const lastLocationBaseline = Number(location?.[2]) - Number(location?.[1]);
    const quantityBaseline = Number(quantity?.[1]);
    expect(lastLocationBaseline - quantityBaseline).toBeGreaterThan(11);
    expect(quantityBaseline).toBeGreaterThan(6);
  });
});
