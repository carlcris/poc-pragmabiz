import { expect, it } from "vitest";
import { Font } from "@react-pdf/renderer";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getItemLocationGroupSubtotals,
  isItemLocationReportGroupBy,
  orderItemLocationReportRows,
} from "@/lib/reports/item-location-report-groups";
import { PDFDocument } from "pdf-lib";
import { buildItemLocationReportPdf } from "@/lib/reports/build-item-location-report-pdf";
import {
  ItemLocationBatchReportPDF,
  type ItemLocationBatchReportPDFProps,
} from "./ItemLocationBatchReportPDF";
import type { ItemLocationBatchReportRow } from "@/hooks/useItemLocationBatchReport";

const labels = {
  title: "Item Locations 商品库位",
  subtitle: "Grouped by batch",
  generatedAtLabel: "Generated",
  generatedAt: "2026-11-12 14:30:00",
  itemLabel: "Item",
  warehouseLocationLabel: "Warehouse / Location",
  batchLabel: "Batch",
  locationLabel: "Location",
  locationSkuLabel: "Location SKU",
  onHandLabel: "On Hand",
  reservedLabel: "Reserved",
  availableLabel: "Available",
  noValueLabel: "--",
  noRowsLabel: "No rows",
  subtotalLabel: "Subtotal",
};

const row = (overrides: Partial<ItemLocationBatchReportRow>): ItemLocationBatchReportRow => ({
  id: "row",
  itemId: "item-1",
  itemCode: "GLASS-1",
  itemName: "玻璃 Clear Glass",
  warehouseId: "wh-1",
  // Codes stay on the fixture on purpose: the API still returns them for
  // ordering and identity, and no location label may ever display them.
  warehouseCode: "WH-BU01",
  warehouseName: "Main Warehouse",
  locationId: "loc-1",
  locationCode: "Z01-R01-B01",
  locationName: "Bin 1",
  // locationPath is resolved server-side to ancestor-to-leaf names only.
  locationPath: "Zone 1 / Rack A / Bin 1",
  itemBatchId: "batch-record-1",
  batchCode: "BATCH-1",
  batchReceivedAt: "2026-01-01",
  batchAgeDays: 100,
  batchLocationSku: "0000000001",
  qtyOnHand: 10,
  qtyReserved: 1,
  qtyAvailable: 9,
  updatedAt: "2026-11-11T00:00:00Z",
  ...overrides,
});

// Walk the rendered react-pdf element tree so heading structure is asserted
// without paying for a full PDF render on every grouping case.
type Node =
  | { props?: { children?: unknown; style?: unknown } }
  | string
  | number
  | null
  | undefined;
const textOf = (node: Node): string => {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  const children = (node as { props?: { children?: unknown } }).props?.children;
  return Array.isArray(children)
    ? children.map((child) => textOf(child as Node)).join("")
    : textOf(children as Node);
};
type RowWrapper = { key: string; props: { children: Node[] } };
const pageBlocks = (props: ItemLocationBatchReportPDFProps, extra = {}): Node[] => {
  const page = ItemLocationBatchReportPDF({ ...props, ...extra }).props.children;
  return (page.props.children as Node[]).flat();
};
const renderedTexts = (props: ItemLocationBatchReportPDFProps, extra = {}): string[] =>
  pageBlocks(props, extra)
    .flatMap((block) => {
      const children = (block as { props?: { children?: unknown } })?.props?.children;
      return Array.isArray(children) ? (children as Node[]) : [block];
    })
    .map((node) => textOf(node))
    .filter((text) => text.length > 0);

// Each data row renders as one wrapper View keyed by its row id, holding the
// optional group heading, the optional subgroup heading, the row, and finally
// the optional subtotal. Walking that nesting instead of a flat text list is
// what lets a subtotal be asserted against the exact row it closes.
const rowWrappers = (props: ItemLocationBatchReportPDFProps, extra = {}): RowWrapper[] =>
  pageBlocks(props, extra).filter(
    (block): block is RowWrapper =>
      typeof (block as { key?: unknown })?.key === "string" &&
      Array.isArray((block as { props?: { children?: unknown } }).props?.children)
  );
// Report the subtotal cells of every row that closes a group: the label cell
// followed by the group's on-hand, reserved, and available quantities.
const subtotalCells = (
  props: ItemLocationBatchReportPDFProps,
  extra = {}
): { rowId: string; cells: string[] }[] =>
  rowWrappers(props, extra).flatMap((wrapper) => {
    // The subtotal is the group's closing block, so it is always the last child.
    const closing = wrapper.props.children.at(-1);
    const cells = (closing as { props?: { children?: unknown } })?.props?.children;
    if (!Array.isArray(cells)) return [];
    return [{ rowId: wrapper.key, cells: (cells as Node[]).map((cell) => textOf(cell)) }];
  });

// Headings and the subtotal are conditional, so find the data row by its shape
// rather than by position: it is the only block holding five cells.
const dataRowCells = (wrapper: RowWrapper): Node[] => {
  const dataRow = wrapper.props.children.find((child) => {
    const cells = (child as { props?: { children?: unknown } })?.props?.children;
    return Array.isArray(cells) && cells.length === 5;
  });
  const cells = (dataRow as { props?: { children?: unknown } })?.props?.children;
  return Array.isArray(cells) ? (cells as Node[]) : [];
};

// Report the warehouse/location cell of every data row in item and batch
// grouping: the cell is the first child of the row block, and holds the
// warehouse name then the location path. Reading that cell structurally keeps
// the assertion off the primary heading.
const warehouseLocationCells = (
  props: ItemLocationBatchReportPDFProps,
  extra = {}
): { rowId: string; warehouse: string; location: string }[] =>
  rowWrappers(props, extra).flatMap((wrapper) => {
    const cells = dataRowCells(wrapper);
    // The warehouse/location cell leads the row and pairs the warehouse name
    // with the names-only location path.
    const labelTexts = (cells[0] as { props?: { children?: unknown } })?.props?.children;
    if (!Array.isArray(labelTexts)) return [];
    return [
      {
        rowId: wrapper.key,
        warehouse: textOf(labelTexts[0] as Node),
        location: textOf(labelTexts[1] as Node),
      },
    ];
  });

// Report the leading detail cell of every data row as rendered text. In
// location grouping that cell carries the batch code, so asserting it reads
// the real first cell rather than the group heading that repeats above it.
const leadingDetailCells = (
  props: ItemLocationBatchReportPDFProps,
  extra = {}
): { rowId: string; detail: string }[] =>
  rowWrappers(props, extra).flatMap((wrapper) => {
    const cells = dataRowCells(wrapper);
    if (cells.length === 0) return [];
    return [{ rowId: wrapper.key, detail: textOf(cells[0]) }];
  });

// Report the subgroup heading each data row emits directly above it, or null
// when the row continues the current subgroup. The heading is the block
// immediately before the data row, so a repeated or missing item subheading is
// visible per row rather than only in aggregate.
const subgroupHeadings = (
  props: ItemLocationBatchReportPDFProps,
  extra = {}
): { rowId: string; heading: string | null }[] =>
  rowWrappers(props, extra).map((wrapper) => {
    const dataRowIndex = wrapper.props.children.findIndex((child) => {
      const cells = (child as { props?: { children?: unknown } })?.props?.children;
      return Array.isArray(cells) && cells.length === 5;
    });
    const preceding = dataRowIndex > 0 ? wrapper.props.children[dataRowIndex - 1] : undefined;
    // The primary group heading holds its own cell-styled text; the subgroup
    // heading is the one that is not a primary heading, told apart by the
    // label prefixes the primary headings always carry.
    const text = preceding ? textOf(preceding) : "";
    const isPrimary = ["Item: ", "Batch: ", "Location: "].some((p) => text.startsWith(p));
    return { rowId: wrapper.key, heading: text && !isPrimary ? text : null };
  });

// Every warehouse and location code the fixtures carry. None may surface in a
// heading or a warehouse/location cell, in any group mode.
const locationCodeFragments = ["WH-BU01", "WH-BU02", "Z01", "Z01-R01", "Z01-R01-B01", "BIN"];
const expectNoLocationCodes = (texts: string[]) => {
  const locationTexts = texts.filter(
    (text) => text.startsWith("Location: ") || text.includes(" / ")
  );
  expect(locationTexts.length).toBeGreaterThan(0);
  for (const text of locationTexts)
    for (const code of locationCodeFragments) expect(text).not.toContain(code);
};

it("heads each location group with its warehouse name and names-only location path", () => {
  const rows = [
    row({ id: "a", locationId: "loc-1", locationPath: "Zone 1 / Rack A / Bin 1" }),
    row({ id: "b", locationId: "loc-2", locationPath: "Zone 1 / Rack A / Bin 2" }),
  ];
  const texts = renderedTexts({ ...labels, groupBy: "location", groupSubtotals: {}, rows });
  expect(texts.filter((text) => text.startsWith("Location: "))).toEqual([
    "Location: Main Warehouse — Zone 1 / Rack A / Bin 1",
    "Location: Main Warehouse — Zone 1 / Rack A / Bin 2",
  ]);
  expectNoLocationCodes(texts);
});

it("shows warehouse and location names only in the detail cell, in item and batch modes", () => {
  const rows = [
    row({ id: "a" }),
    row({
      id: "b",
      locationId: "loc-2",
      locationName: "Bin 2",
      locationPath: "Zone 1 / Rack A / Bin 2",
    }),
  ];
  // Location grouping replaces this cell with the batch, so it is excluded:
  // the warehouse and location are stated once in its group heading instead.
  for (const groupBy of ["item", "batch"] as const) {
    const props = { ...labels, groupBy, groupSubtotals: {}, rows };
    // Each row's own cell carries its own location path, so the second row is
    // asserted against Bin 2 rather than against the first row's label.
    expect(warehouseLocationCells(props)).toEqual([
      { rowId: "a", warehouse: "Main Warehouse", location: "Zone 1 / Rack A / Bin 1" },
      { rowId: "b", warehouse: "Main Warehouse", location: "Zone 1 / Rack A / Bin 2" },
    ]);
    expectNoLocationCodes(renderedTexts(props));
  }
});

it("preserves names containing literal separators", () => {
  const rows = [
    row({
      id: "a",
      warehouseName: "North / South Warehouse",
      locationPath: "Zone 1 - Cold / Rack A - Tall / Bin 1 - Front",
    }),
  ];
  const texts = renderedTexts({ ...labels, groupBy: "location", groupSubtotals: {}, rows });
  expect(texts.filter((text) => text.startsWith("Location: "))).toEqual([
    "Location: North / South Warehouse — Zone 1 - Cold / Rack A - Tall / Bin 1 - Front",
  ]);
});

it("separates identical location labels in different locations and warehouses", () => {
  const shared = { locationName: "Bin 1", locationPath: "Zone 1 / Rack A / Bin 1" };
  const rows = [
    row({ id: "a", locationId: "loc-1", ...shared }),
    // Same visible label, different location identity: still its own group.
    row({ id: "b", locationId: "loc-2", ...shared }),
    row({
      id: "c",
      warehouseId: "wh-2",
      warehouseCode: "WH-BU02",
      locationId: "loc-2",
      ...shared,
    }),
  ];
  const texts = renderedTexts({ ...labels, groupBy: "location", groupSubtotals: {}, rows });
  const headings = texts.filter((text) => text.startsWith("Location: "));
  expect(headings).toHaveLength(3);
  // Identity, not the label, drives grouping, so all three headings read alike.
  expect(new Set(headings).size).toBe(1);
});

it("falls back to the location name then the no-value label, never to a code", () => {
  const rows = [
    // No path: the leaf name stands in, not locationCode.
    row({ id: "a", locationPath: null }),
    // No names at all: the no-value label, not warehouseCode or locationCode.
    row({
      id: "b",
      locationId: "loc-2",
      warehouseName: null,
      locationName: null,
      locationPath: null,
    }),
  ];
  const texts = renderedTexts({ ...labels, groupBy: "location", groupSubtotals: {}, rows });
  expect(texts.filter((text) => text.startsWith("Location: "))).toEqual([
    "Location: Main Warehouse — Bin 1",
    "Location: -- — --",
  ]);
  expect(texts.some((text) => text.includes("Z01-R01-B01") || text.includes("WH-BU01"))).toBe(
    false
  );
});

// The fixed column headings are the page's only block holding five cells that
// is not wrapped in a row View, so read them structurally by that shape.
const columnHeadings = (props: ItemLocationBatchReportPDFProps, extra = {}): string[] => {
  const headings = pageBlocks(props, extra).find((block) => {
    if (typeof (block as { key?: unknown })?.key === "string") return false;
    const cells = (block as { props?: { children?: unknown } })?.props?.children;
    return Array.isArray(cells) && cells.length === 5;
  });
  const cells = (headings as { props?: { children?: unknown } })?.props?.children;
  return Array.isArray(cells) ? (cells as Node[]).map((cell) => textOf(cell)) : [];
};

it("heads the first column with the batch label in location grouping only", () => {
  const rows = [row({ id: "a" })];
  const props = { ...labels, groupBy: "location" as const, groupSubtotals: {}, rows };
  // Only the first heading changes; SKU and the quantity headings are intact.
  expect(columnHeadings(props)).toEqual([
    "Batch",
    "Location SKU",
    "On Hand",
    "Reserved",
    "Available",
  ]);
  for (const groupBy of ["item", "batch"] as const)
    expect(columnHeadings({ ...props, groupBy })).toEqual([
      "Warehouse / Location",
      "Location SKU",
      "On Hand",
      "Reserved",
      "Available",
    ]);
});

it("shows the batch code in the leading detail cell in location grouping", () => {
  const rows = [
    row({ id: "a" }),
    row({ id: "b", itemBatchId: "batch-record-2", batchCode: "BATCH-2" }),
  ];
  const props = { ...labels, groupBy: "location" as const, groupSubtotals: {}, rows };
  expect(leadingDetailCells(props)).toEqual([
    { rowId: "a", detail: "BATCH-1" },
    { rowId: "b", detail: "BATCH-2" },
  ]);
  // The cell carries the code alone: the column heading already says Batch.
  expect(leadingDetailCells(props).every(({ detail }) => !detail.includes("Batch: "))).toBe(true);
});

it("does not repeat the warehouse or location path in the location detail cell", () => {
  const rows = [row({ id: "a" })];
  const props = { ...labels, groupBy: "location" as const, groupSubtotals: {}, rows };
  const [{ detail }] = leadingDetailCells(props);
  expect(detail).not.toContain("Main Warehouse");
  expect(detail).not.toContain("Zone 1 / Rack A / Bin 1");
  // The names still appear exactly once, in the group heading.
  expect(
    renderedTexts(props).filter((text) => text.includes("Main Warehouse — Zone 1 / Rack A / Bin 1"))
  ).toEqual(["Location: Main Warehouse — Zone 1 / Rack A / Bin 1"]);
});

it("falls back to the no-value label when a location row has no batch code", () => {
  const rows = [row({ id: "a", batchCode: null })];
  const props = { ...labels, groupBy: "location" as const, groupSubtotals: {}, rows };
  expect(leadingDetailCells(props)).toEqual([{ rowId: "a", detail: "--" }]);
});

it("subheads an item once at a location, with one detail row per batch", () => {
  const rows = [
    row({ id: "a" }),
    // Same item, different batch: another detail row, not another subheading.
    row({ id: "b", itemBatchId: "batch-record-2", batchCode: "BATCH-2" }),
    row({ id: "c", itemId: "item-2", itemCode: "GLASS-2", itemName: "Frosted Glass" }),
  ];
  const props = { ...labels, groupBy: "location" as const, groupSubtotals: {}, rows };
  expect(subgroupHeadings(props)).toEqual([
    { rowId: "a", heading: "GLASS-1 — 玻璃 Clear Glass" },
    { rowId: "b", heading: null },
    { rowId: "c", heading: "GLASS-2 — Frosted Glass" },
  ]);
  // Each batch-location row is still rendered exactly once.
  expect(leadingDetailCells(props).map(({ detail }) => detail)).toEqual([
    "BATCH-1",
    "BATCH-2",
    "BATCH-1",
  ]);
  // The batch never rejoins the item subheading.
  expect(renderedTexts(props).some((text) => text.includes("· Batch: "))).toBe(false);
});

it("repeats the item subheading when the same item appears at a new location", () => {
  const rows = [
    row({ id: "a", locationId: "loc-1" }),
    // Identical item and batch, so only the location identity changed.
    row({ id: "b", locationId: "loc-2", locationPath: "Zone 1 / Rack A / Bin 2" }),
  ];
  const props = { ...labels, groupBy: "location" as const, groupSubtotals: {}, rows };
  expect(subgroupHeadings(props)).toEqual([
    { rowId: "a", heading: "GLASS-1 — 玻璃 Clear Glass" },
    { rowId: "b", heading: "GLASS-1 — 玻璃 Clear Glass" },
  ]);
  expect(renderedTexts(props).filter((text) => text.startsWith("Location: "))).toHaveLength(2);
});

it("does not repeat the location or item heading when previousRow continues the group", () => {
  const first = row({ id: "a", locationId: "loc-1" });
  const props = {
    ...labels,
    groupBy: "location" as const,
    groupSubtotals: {},
    // A new batch of the same item at the same location continues both headings.
    rows: [row({ id: "b", locationId: "loc-1", itemBatchId: "batch-record-2", batchCode: "B-2" })],
  };
  const extra = { previousRow: first, showReportHeader: false, isLastJob: true };
  expect(renderedTexts(props, extra).filter((text) => text.startsWith("Location: "))).toEqual([]);
  expect(subgroupHeadings(props, extra)).toEqual([{ rowId: "b", heading: null }]);
  // The continued row still renders its own batch detail cell.
  expect(leadingDetailCells(props, extra)).toEqual([{ rowId: "b", detail: "B-2" }]);
});

it("shows a new location and item heading at a job boundary even when the pair continues", () => {
  const previousRow = row({ id: "a", locationId: "loc-1" });
  const props = {
    ...labels,
    groupBy: "location" as const,
    groupSubtotals: {},
    rows: [row({ id: "b", locationId: "loc-2", locationPath: "Zone 1 / Rack A / Bin 2" })],
  };
  const extra = { previousRow, showReportHeader: false, isLastJob: true };
  expect(renderedTexts(props, extra).filter((text) => text.startsWith("Location: "))).toEqual([
    "Location: Main Warehouse — Zone 1 / Rack A / Bin 2",
  ]);
  expect(subgroupHeadings(props, extra)).toEqual([
    { rowId: "b", heading: "GLASS-1 — 玻璃 Clear Glass" },
  ]);
});

it("renders each location subtotal once, at the group's true last row", () => {
  const rows = orderItemLocationReportRows(
    [
      row({ id: "a", locationId: "loc-1", qtyOnHand: 10 }),
      row({ id: "b", locationId: "loc-1", itemId: "item-2", itemCode: "GLASS-2", qtyOnHand: 5 }),
      row({ id: "c", locationId: "loc-2", locationPath: "Zone 1 / Rack A / Bin 2" }),
    ],
    "location",
    "en"
  );
  const groupSubtotals = getItemLocationGroupSubtotals(rows, "location");
  // One key per group, each pointing at that group's last row.
  expect(Object.keys(groupSubtotals)).toHaveLength(2);
  expect(groupSubtotals[rows[1].id].qtyOnHand).toBe(15);
  // Each subtotal closes its own group's last row and carries that group's totals.
  expect(subtotalCells({ ...labels, groupBy: "location", groupSubtotals, rows })).toEqual([
    { rowId: "b", cells: ["Subtotal", "15.00", "2.00", "18.00"] },
    { rowId: "c", cells: ["Subtotal", "10.00", "1.00", "9.00"] },
  ]);
});

it("renders a group's subtotal once, in the render job that holds its last row", () => {
  const rows = orderItemLocationReportRows(
    [
      row({ id: "a", locationId: "loc-1", qtyOnHand: 10 }),
      row({ id: "b", locationId: "loc-1", itemId: "item-2", itemCode: "GLASS-2", qtyOnHand: 5 }),
      row({ id: "c", locationId: "loc-2", locationPath: "Zone 1 / Rack A / Bin 2" }),
    ],
    "location",
    "en"
  );
  const groupSubtotals = getItemLocationGroupSubtotals(rows, "location");
  const props = { ...labels, groupBy: "location" as const, groupSubtotals, rows };
  // Split the ordered rows the way bounded render jobs do. The first window ends
  // mid-group, so that group's subtotal must wait for the window holding its
  // last row rather than closing early at the job boundary.
  expect(subtotalCells({ ...props, rows: rows.slice(0, 1) }, { isLastJob: false })).toEqual([]);
  expect(
    subtotalCells(
      { ...props, rows: rows.slice(1) },
      { previousRow: rows[0], showReportHeader: false, isLastJob: true }
    )
  ).toEqual([
    { rowId: "b", cells: ["Subtotal", "15.00", "2.00", "18.00"] },
    { rowId: "c", cells: ["Subtotal", "10.00", "1.00", "9.00"] },
  ]);
});

it("keeps item and batch grouping headings unchanged", () => {
  const rows = [
    row({ id: "a" }),
    row({ id: "b", itemBatchId: "batch-record-2", batchCode: "BATCH-2" }),
  ];
  expect(renderedTexts({ ...labels, groupBy: "item", groupSubtotals: {}, rows })).toEqual(
    expect.arrayContaining(["Item: GLASS-1 — 玻璃 Clear Glass", "BATCH-1", "BATCH-2"])
  );
  expect(renderedTexts({ ...labels, groupBy: "batch", groupSubtotals: {}, rows })).toEqual(
    expect.arrayContaining(["Batch: BATCH-1", "Batch: BATCH-2", "GLASS-1 — 玻璃 Clear Glass"])
  );
});

it("renders a large Unicode location report across bounded render jobs", async () => {
  Font.register({ family: "ArialUnicode", src: path.resolve("public/fonts/ArialUnicode.ttf") });
  const count = Number(process.env.ITEM_LOCATION_PDF_TEST_ROWS || 1000);
  const envGroupBy = process.env.ITEM_LOCATION_PDF_GROUP_BY;
  const props: ItemLocationBatchReportPDFProps = {
    ...labels,
    groupBy: envGroupBy && isItemLocationReportGroupBy(envGroupBy) ? envGroupBy : "batch",
    groupSubtotals: {},
    rows: Array.from({ length: count }, (_, index) =>
      row({
        id: String(index),
        itemId: `item-${index % 3}`,
        itemCode: `GLASS-${index % 3}`,
        warehouseId: "wh",
        warehouseCode: "WH-BU01",
        warehouseName: "Main Warehouse",
        // One location holds well over a render job's 125 rows, so a location
        // group and its subtotal must survive several job boundaries.
        locationId: `loc-${Math.floor(index / 200)}`,
        locationCode: "Z01-R01-B01",
        locationName: "Bin",
        locationPath: `区域 Zone ${Math.floor(index / 200)} / 货架 Rack 长名称 / 层 Shelf / 库位 Bin 超长名称标签`,
        itemBatchId: `batch-record-${index}`,
        batchCode: `BATCH-${Math.floor(index / 5)}`,
        batchLocationSku: String(index).padStart(10, "0"),
      })
    ),
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

it("renders a multi-job location report with a group spanning many render jobs", async () => {
  Font.register({ family: "ArialUnicode", src: path.resolve("public/fonts/ArialUnicode.ttf") });
  const props: ItemLocationBatchReportPDFProps = {
    ...labels,
    groupBy: "location",
    groupSubtotals: {},
    rows: Array.from({ length: 400 }, (_, index) =>
      row({
        id: String(index),
        itemId: `item-${index % 4}`,
        itemCode: `GLASS-${index % 4}`,
        // The first location holds 300 rows: more than two 125-row jobs.
        locationId: index < 300 ? "loc-wide" : "loc-tail",
        locationPath:
          index < 300
            ? "区域 Zone 超长名称 / 货架 Rack 名称很长很长 / 层 Shelf 三 / 库位 Bin 超长库位名称标签"
            : "Zone 2 / Rack B / Bin 7",
        itemBatchId: `batch-record-${index}`,
        batchCode: `BATCH-${Math.floor(index / 7)}`,
        batchLocationSku: String(index).padStart(10, "0"),
      })
    ),
  };
  props.rows = orderItemLocationReportRows(props.rows, "location", "en");
  props.groupSubtotals = getItemLocationGroupSubtotals(props.rows, "location");
  expect(Object.keys(props.groupSubtotals)).toHaveLength(2);
  const buffer = Buffer.from(await (await buildItemLocationReportPdf(props)).arrayBuffer());
  const pages = (await PDFDocument.load(buffer)).getPageCount();
  expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  expect(pages).toBeGreaterThan(3);
}, 180_000);
