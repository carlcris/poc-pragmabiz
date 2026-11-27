import { writeFile } from "node:fs/promises";
import path from "node:path";
import { Children, isValidElement, type ReactNode } from "react";
import { Font } from "@react-pdf/renderer";
import { createTranslator } from "next-intl";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { expect, it } from "vitest";
import { translations } from "@/lib/i18n/translations";
import { buildInventoryBoxCountReportPdf } from "@/lib/reports/build-inventory-box-count-report-pdf";
import {
  InventoryBoxCountReportPDF,
  type InventoryBoxCountReportPDFProps,
} from "./InventoryBoxCountReportPDF";

const t = createTranslator({
  locale: "en",
  messages: { inventoryBoxCountReport: translations.en.inventoryBoxCountReport },
  namespace: "inventoryBoxCountReport",
});
const box = { kind: "box", code: "BOX" };

const props: InventoryBoxCountReportPDFProps = {
  title: translations.en.reportsPage.inventoryBoxCountName,
  categoryName: "Moldings",
  businessUnitName: "Main-Bulacan",
  packingUnitName: "Box",
  generatedAtLine: "Generated At: Nov 26, 2026, 2:30 PM",
  totalFullPackingUnits: 20,
  totalItems: 3,
  itemsWithoutPackingUnitSize: 1,
  locale: "en",
  labels: {
    category: "Category",
    businessUnit: "Business Unit",
    packingUnit: "Unit",
    sortedByItemName: "Sorted By Item Name",
    totalFullPackingUnits: "Total Full Boxes",
    reportedItems: "Reported Items",
    excludedItems: "Excluded · No Box Size",
    fullPackingUnitsNote: t("fullPackingUnitsNote", box),
    item: "Item",
    onHand: "On Hand",
    qtyPerPackingUnit: t("qtyPerPackingUnit", box),
    looseUnits: "Loose Units",
    empty: "No items in this category have an active box size.",
  },
  rows: [
    {
      itemId: "item-1",
      itemCode: "MLD-001",
      itemName: "Black Moulding",
      baseUnit: "STICK",
      onHand: 1440,
      qtyPerPackingUnit: 144,
      fullPackingUnits: 10,
      looseUnits: 0,
    },
    {
      itemId: "item-2",
      itemCode: "MLD-002",
      itemName: "Oak Moulding",
      baseUnit: "STICK",
      onHand: 500,
      qtyPerPackingUnit: 50,
      fullPackingUnits: 10,
      looseUnits: 0,
    },
    {
      itemId: "item-3",
      itemCode: "MLD-003",
      itemName: "White Moulding",
      baseUnit: "PCS",
      onHand: 0,
      qtyPerPackingUnit: 40,
      fullPackingUnits: 0,
      looseUnits: 0,
    },
  ],
};

function textOf(node: ReactNode): string[] {
  return Children.toArray(node).flatMap((child) => {
    if (isValidElement<{ children?: ReactNode }>(child)) return textOf(child.props.children);
    return typeof child === "string" || typeof child === "number" ? [String(child)] : [];
  });
}

it("shows each item’s box size and the total of full boxes across different sizes", () => {
  const document = InventoryBoxCountReportPDF(props);
  const children = Children.toArray(document.props.children.props.children);
  const [header, headings, ...rows] = children.slice(0, -1);
  const footer = children.at(-1);
  expect(header).toMatchObject({ props: { wrap: false } });
  expect(textOf(header)).toEqual([
    props.title,
    "Category",
    "Moldings",
    "Business Unit",
    "Main-Bulacan",
    "Unit",
    "Box",
    props.generatedAtLine,
    "Sorted By Item Name",
    "Total Full Boxes",
    "20",
    "Reported Items",
    "3",
    "Excluded · No Box Size",
    "1",
    props.labels.fullPackingUnitsNote,
  ]);
  expect(headings).toMatchObject({ props: { fixed: true } });
  expect(textOf(headings)).toEqual(["Item", "On Hand", "Qty per Box", "Box", "Loose Units"]);
  expect(rows.map((row) => textOf(row).join("|"))).toEqual([
    "Black Moulding|MLD-001|1,440| STICK|144| STICK|10|0| STICK",
    "Oak Moulding|MLD-002|500| STICK|50| STICK|10|0| STICK",
    "White Moulding|MLD-003|0| PCS|40| PCS|0|0| PCS",
  ]);
  expect(footer).toMatchObject({ props: { fixed: true } });
  expect(textOf(footer)).toEqual(["Stock Count by Unit · Moldings · Main-Bulacan · Box"]);
  expect(textOf(InventoryBoxCountReportPDF({ ...props, showReportHeader: false }))).not.toContain(
    props.labels.totalFullPackingUnits
  );
});

it("shows the selected unit name and repeats the per-item PACK column on continuation pages", () => {
  const unit = { kind: "other", code: "PACK" };
  const rows = [
    {
      ...props.rows[0],
      baseUnit: "PCS",
      onHand: 125,
      qtyPerPackingUnit: 10,
      fullPackingUnits: 12,
      looseUnits: 5,
    },
    {
      ...props.rows[1],
      baseUnit: "PCS",
      onHand: 96,
      qtyPerPackingUnit: 50,
      fullPackingUnits: 1,
      looseUnits: 46,
    },
  ];
  const pack = {
    ...props,
    packingUnitName: "Pack",
    totalFullPackingUnits: 13,
    totalItems: 2,
    itemsWithoutPackingUnitSize: 2,
    labels: {
      ...props.labels,
      packingUnit: t("calculationUnit"),
      totalFullPackingUnits: t("totalFullPackingUnits", unit),
      excludedItems: t("excludedItems", unit),
      fullPackingUnitsNote: t("fullPackingUnitsNote", unit),
      qtyPerPackingUnit: t("qtyPerPackingUnit", unit),
      empty: t("empty", unit),
    },
    rows,
  };
  const document = InventoryBoxCountReportPDF(pack);
  const children = Children.toArray(document.props.children.props.children);
  expect(textOf(children[0])).toEqual(
    expect.arrayContaining(["Unit", "Pack", "Total Full PACK", "13", "Excluded · No PACK Size"])
  );
  expect(textOf(children[0]).join(" ")).toContain("largest active PACK size");
  const headings = ["Item", "On Hand", "Qty per PACK", "Pack", "Loose Units"];
  expect(textOf(children[1])).toEqual(headings);
  expect(textOf(children[2]).join("|")).toBe("Black Moulding|MLD-001|125| PCS|10| PCS|12|5| PCS");
  expect(textOf(children[3]).join("|")).toBe("Oak Moulding|MLD-002|96| PCS|50| PCS|1|46| PCS");
  expect(textOf(children.at(-1))).toEqual(["Stock Count by Unit · Moldings · Main-Bulacan · Pack"]);
  const nextDocument = InventoryBoxCountReportPDF({ ...pack, showReportHeader: false });
  const nextPage = textOf(nextDocument);
  const [continuationHeadings] = Children.toArray(nextDocument.props.children.props.children);
  expect(textOf(continuationHeadings)).toEqual(headings);
  expect(nextPage).toContain("Stock Count by Unit · Moldings · Main-Bulacan · Pack");
  expect(nextPage).not.toContain("Total Full PACK");
  expect(nextPage).not.toContain("Unit");
});

it("renders zero eligible items with the excluded count on a single numbered page", async () => {
  const empty = {
    ...props,
    rows: [],
    totalFullPackingUnits: 0,
    totalItems: 0,
    itemsWithoutPackingUnitSize: 4,
  };
  const document = InventoryBoxCountReportPDF(empty);
  const [header, headings, emptyMessage, footer] = Children.toArray(
    document.props.children.props.children
  );
  expect(textOf(header).slice(5, 7)).toEqual(["Unit", "Box"]);
  expect(textOf(header).slice(9)).toEqual([
    "Total Full Boxes",
    "0",
    "Reported Items",
    "0",
    "Excluded · No Box Size",
    "4",
    props.labels.fullPackingUnitsNote,
  ]);
  expect(textOf(emptyMessage)).toEqual([props.labels.empty]);
  expect(headings).toMatchObject({ props: { fixed: true } });
  expect(footer).toMatchObject({ props: { fixed: true } });
  expect(textOf(footer)).toEqual(["Stock Count by Unit · Moldings · Main-Bulacan · Box"]);
  Font.register({ family: "ArialUnicode", src: path.resolve("public/fonts/ArialUnicode.ttf") });
  const blob = await buildInventoryBoxCountReportPdf(empty);
  const pdf = await PDFDocument.load(await blob.arrayBuffer());
  expect(pdf.getPageCount()).toBe(1);
});

it("renders the full item list across multiple jobs with continuous physical page numbers", async () => {
  Font.register({ family: "ArialUnicode", src: path.resolve("public/fonts/ArialUnicode.ttf") });
  const count = Number(process.env.INVENTORY_BOX_COUNT_PDF_TEST_ROWS || 275);
  const rows = Array.from({ length: count }, (_, index) => ({
    ...props.rows[index % props.rows.length],
    ...(index === count - 1
      ? { onHand: 251.25, qtyPerPackingUnit: 125.625, fullPackingUnits: 2, looseUnits: 0 }
      : {}),
    itemId: `inventory-row-${index}`,
    itemCode: `MLD-${String(index + 1).padStart(4, "0")}`,
    itemName:
      index % 13 === 0
        ? "山形木线条 Moulding with a long description that wraps across lines while its quantities stay on the same item row"
        : props.rows[index % props.rows.length].itemName,
  }));
  const startedAt = performance.now();
  const blob = await buildInventoryBoxCountReportPdf({
    ...props,
    rows,
    totalFullPackingUnits: rows.reduce((sum, row) => sum + row.fullPackingUnits, 0),
    totalItems: rows.length,
    itemsWithoutPackingUnitSize: 68,
  });
  const bytes = await blob.arrayBuffer();
  const document = await PDFDocument.load(bytes);
  expect(document.getTitle()).toBe("Stock Count by Unit");
  const pages = document.getPages();
  expect(pages.length).toBeGreaterThan(4);
  pages.forEach((page, index) => {
    const contents = page.node.Contents();
    if (!(contents instanceof PDFArray)) throw new Error("Expected numbered page content streams");
    const footer = contents.lookup(contents.size() - 1, PDFRawStream);
    const decoded = decodePDFRawStream(footer).decode();
    expect(Buffer.from(decoded).toString("ascii").toLowerCase()).toContain(
      Buffer.from(`${index + 1} / ${pages.length}`).toString("hex")
    );
  });
  console.info(
    `Stock Count by Unit PDF: ${count} rows, ${pages.length} pages, ${Math.round(performance.now() - startedAt)}ms`
  );
  if (process.env.INVENTORY_BOX_COUNT_PDF_OUTPUT) {
    await writeFile(process.env.INVENTORY_BOX_COUNT_PDF_OUTPUT, Buffer.from(bytes));
  }
}, 180_000);
