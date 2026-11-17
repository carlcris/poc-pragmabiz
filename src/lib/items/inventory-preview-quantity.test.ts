import { expect, it } from "vitest";
import {
  createInventoryPreviewQuantityFormatter,
  createItemInventoryPreviewLabel,
} from "./inventory-preview-quantity";

const box = { displayLabel: "BOX (50)", qtyPerUnit: 50 };
const en = createInventoryPreviewQuantityFormatter("en-US");

it("converts base quantities into whole nominated units", () => {
  expect(en.formatEquivalent(1000, box)).toBe("20");
  expect(en.formatEquivalent(200, box)).toBe("4");
  expect(en.formatEquivalent(800, box)).toBe("16");
});

it("drops the fractional unit instead of rounding it up", () => {
  // 3478 / 50 = 69.56 must read as 69 BOX (50), never 70.
  expect(en.formatEquivalent(3478, box)).toBe("69");
  expect(en.formatEquivalent(149, box)).toBe("2");
  expect(en.formatEquivalent(1, { displayLabel: "Trio", qtyPerUnit: 3 })).toBe("0");
});

it("shows zero whole units when stock is under one unit", () => {
  expect(en.formatEquivalent(49, box)).toBe("0");
  expect(en.formatEquivalent(0.5, box)).toBe("0");
  expect(en.formatEquivalent(0, box)).toBe("0");
  expect(en.formatEquivalent(1, { displayLabel: "Pallet", qtyPerUnit: 1_000_000 })).toBe("0");
});

it("counts exact multiples of decimal units without floating-point loss", () => {
  expect(en.formatEquivalent(0.3, { displayLabel: "Tenth", qtyPerUnit: 0.1 })).toBe("3");
  expect(en.formatEquivalent(49.9999, box)).toBe("0");
});

it("formats a negative partial pack as zero rather than minus zero", () => {
  expect(en.formatEquivalent(-5, box)).toBe("0");
});

it("keeps whole-number base quantities on every row", () => {
  expect(en.formatBase(1000.75)).toBe("1000");
  expect(en.formatBase(0.5)).toBe("0");
  expect(en.formatBase(100.5)).toBe("100");
  expect(en.formatBase(1000)).toBe("1000");
});

it("groups the equivalent using the active locale", () => {
  const de = createInventoryPreviewQuantityFormatter("de-DE");
  const single = { displayLabel: "Crate", qtyPerUnit: 1 };
  expect(en.formatEquivalent(5125, single)).toBe("5,125");
  expect(de.formatEquivalent(5125, single)).toBe("5.125");
});

it("returns no equivalent without a nominated unit or a positive conversion", () => {
  expect(en.formatEquivalent(1000, null)).toBeNull();
  expect(en.formatEquivalent(1000, { displayLabel: "Bad", qtyPerUnit: 0 })).toBeNull();
  expect(en.formatEquivalent(1000, { displayLabel: "Bad", qtyPerUnit: -5 })).toBeNull();
});

it("treats unparseable quantities as zero", () => {
  expect(en.formatBase("not-a-number")).toBe("0");
  expect(en.formatBase(null)).toBe("0");
  expect(en.formatEquivalent(undefined, box)).toBe("0");
});

it("labels an item's equivalent with its nominated unit for every quantity on a surface", () => {
  const label = createItemInventoryPreviewLabel("en-US", box);
  expect(label(1000)).toBe("20 BOX (50)");
  expect(label(3478)).toBe("69 BOX (50)");
  expect(label(49)).toBe("0 BOX (50)");
});

it("labels nothing when the item nominates no unit or an unusable conversion", () => {
  expect(createItemInventoryPreviewLabel("en-US", null)(1000)).toBeNull();
  expect(
    createItemInventoryPreviewLabel("en-US", { displayLabel: "Bad", qtyPerUnit: 0 })(1000)
  ).toBeNull();
});
