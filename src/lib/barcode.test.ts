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

  it("prints item details, batch SKU, and quantity", async () => {
    const pdfText = await (await generateBarcodeLabelsPDF([label])).text();

    expect(pdfText).toContain("BATCH-001");
    expect(pdfText).toContain("ITEM-001");
    expect(pdfText).toContain("BATCH-LOCATION-00001");
    expect(pdfText).toContain("Qty: 12");
  });

  it("keeps quantity below a wrapped item name and inside the label", async () => {
    const pdfText = await (await generateBarcodeLabelsPDF([label])).text();
    const name = pdfText.match(
      /([\d.]+) TL\s+0 g\s+[\d.]+ ([\d.]+) Td\s+\(A long item name[^]*?ET/
    );
    const quantity = pdfText.match(/[\d.]+ ([\d.]+) Td\s+\(Qty: 12\) Tj/);

    expect(name).not.toBeNull();
    expect(quantity).not.toBeNull();
    const wrappedLines = (name?.[0].match(/T\*/g) ?? []).length;
    const lastNameBaseline = Number(name?.[2]) - Number(name?.[1]) * wrappedLines;
    const quantityBaseline = Number(quantity?.[1]);
    expect(lastNameBaseline - quantityBaseline).toBeGreaterThan(11);
    expect(lastNameBaseline - quantityBaseline).toBeLessThan(20);
    expect(quantityBaseline).toBeGreaterThan(6);
  });
});
