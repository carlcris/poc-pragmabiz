import { describe, expect, it } from "vitest";
import type { PickSourceResolution } from "../types/pick-source";
import {
  getPickableQtyCap,
  getPickingUnitLabel,
  getWholePickSourceQuantities,
  isPackagedPickLine,
} from "./picking-quantities";

const boxSource: PickSourceResolution = {
  batchLocationSku: "source-sku",
  source: {
    itemId: "item",
    warehouseId: "warehouse",
    warehouseName: "Warehouse",
    locationId: "bin",
    locationCode: "BIN",
    locationName: "Rack / Bin",
    batchCode: "BATCH",
    batchReceivedAt: "2026-11-16T00:00:00Z",
    qtyOnHand: 100,
    availableBaseQty: 100,
  },
  line: {
    pickListItemId: "line",
    deliveryNoteItemId: "dn-line",
    remainingQty: 5,
    remainingBaseQty: 720,
    maxPickQty: 0,
    allocatedQty: 6,
    pickedQty: 1,
  },
  isMismatch: false,
};

describe("picking quantities in the selected unit", () => {
  it("displays the configured pack label and falls back to the unit with its pack size", () => {
    expect(getPickingUnitLabel("Box", 144, " BOX (144) ")).toBe("BOX (144)");
    expect(getPickingUnitLabel("Box", 144, null)).toBe("Box (144)");
    expect(getPickingUnitLabel("Piece", 1)).toBe("Piece");
  });

  it.each([
    { availableBaseQty: 100, fullBoxes: 0, boxesShort: 5 },
    { availableBaseQty: 143.99, fullBoxes: 0, boxesShort: 5 },
    { availableBaseQty: 144, fullBoxes: 1, boxesShort: 4 },
    { availableBaseQty: 720, fullBoxes: 5, boxesShort: 0 },
  ])(
    "shows only whole boxes for $availableBaseQty units available to pick",
    ({ availableBaseQty, fullBoxes, boxesShort }) => {
      expect(
        getWholePickSourceQuantities({
          ...boxSource,
          source: { ...boxSource.source, qtyOnHand: 720, availableBaseQty },
        })
      ).toEqual({ kind: "whole_units", availableQty: fullBoxes, shortQty: boxesShort });
    }
  );

  it("reports no availability for a physically stocked bin whose stock is fully reserved", () => {
    expect(
      getWholePickSourceQuantities({
        ...boxSource,
        source: { ...boxSource.source, qtyOnHand: 1440, availableBaseQty: 0 },
      })
    ).toEqual({ kind: "whole_units", availableQty: 0, shortQty: 5 });
  });

  it("counts only the unreserved part of a partially free bin", () => {
    expect(
      getWholePickSourceQuantities({
        ...boxSource,
        source: { ...boxSource.source, qtyOnHand: 1440, availableBaseQty: 288 },
      })
    ).toEqual({ kind: "whole_units", availableQty: 2, shortQty: 3 });
  });

  it("uses the unit of each matched line and reports no shortage when stock covers it", () => {
    const quantities = getWholePickSourceQuantities({
      ...boxSource,
      source: {
        ...boxSource.source,
        locationId: "other-bin",
        qtyOnHand: 8,
        availableBaseQty: 8,
      },
      line: {
        ...boxSource.line,
        pickListItemId: "other-line",
        remainingQty: 5,
        remainingBaseQty: 5,
      },
    });
    expect(quantities).toEqual({ kind: "whole_units", availableQty: 8, shortQty: 0 });
  });

  it("keeps a full unit when decimal arithmetic lands just below an integer", () => {
    const quantities = getWholePickSourceQuantities({
      ...boxSource,
      source: { ...boxSource.source, qtyOnHand: 11.2, availableBaseQty: 11.2 },
      line: { ...boxSource.line, remainingQty: 10.3 - 0.3, remainingBaseQty: 16 },
    });
    expect(quantities).toEqual({ kind: "whole_units", availableQty: 7, shortQty: 3 });
  });

  it("presents a final sub-unit remainder covered by the line's reservation as remaining only", () => {
    expect(
      getWholePickSourceQuantities({
        ...boxSource,
        source: { ...boxSource.source, qtyOnHand: 720, availableBaseQty: 43.2 },
        line: { ...boxSource.line, remainingQty: 0.3, remainingBaseQty: 43.2 },
      })
    ).toEqual({ kind: "remaining_only" });
  });

  it("still reports a shortage when a sub-unit remainder is not fully reserved", () => {
    expect(
      getWholePickSourceQuantities({
        ...boxSource,
        source: { ...boxSource.source, qtyOnHand: 720, availableBaseQty: 21.6 },
        line: { ...boxSource.line, remainingQty: 0.3, remainingBaseQty: 43.2 },
      })
    ).toEqual({ kind: "whole_units", availableQty: 0, shortQty: 1 });
  });
});

describe("whole-package pick quantity caps", () => {
  // The reported defect: a BOX (144) line with 5 boxes left, picked from a bin holding about 238
  // pieces, offered 238 / 144 = 1.6527... boxes as the confirmation default.
  const partialBoxLine = { remainingQty: 5, remainingBaseQty: 720, maxPickQty: 238 / 144 };
  // qty_per_unit = 1, so the remainder and base remainder match and decimals stay legitimate.
  const measuredLine = { remainingQty: 12.5, remainingBaseQty: 12.5, maxPickQty: 7.4821 };

  it("distinguishes a packaged line from a base-unit line", () => {
    expect(isPackagedPickLine(partialBoxLine)).toBe(true);
    expect(isPackagedPickLine(measuredLine)).toBe(false);
  });

  it("caps a partial box at the last whole box instead of 1.6527", () => {
    expect(getPickableQtyCap(partialBoxLine)).toBe(1);
  });

  it("never rounds a packaged cap up to a box the bin cannot supply", () => {
    expect(getPickableQtyCap({ ...partialBoxLine, maxPickQty: 4.9999 })).toBe(4);
    expect(getPickableQtyCap({ ...partialBoxLine, maxPickQty: 5 })).toBe(5);
    expect(getPickableQtyCap({ ...partialBoxLine, maxPickQty: 0.9 })).toBe(0);
  });

  it("keeps the exact fractional limit of a base-unit line", () => {
    expect(getPickableQtyCap(measuredLine)).toBe(7.4821);
  });

  it("offers a whole-package default both clients can submit as typed", () => {
    const cap = getPickableQtyCap(partialBoxLine);
    expect(cap).toBe(1);
    expect(Number.isInteger(cap)).toBe(true);
  });

  it("offers a base-unit default that keeps its decimals", () => {
    const cap = getPickableQtyCap(measuredLine);
    expect(cap).toBe(7.4821);
    expect(Number.isInteger(cap)).toBe(false);
  });

  it("floors a packaged cap that is reported at the stored four-decimal scale", () => {
    // 238 pieces / 144 per box, as the server would send it rounded to the stored scale.
    expect(getPickableQtyCap({ ...partialBoxLine, maxPickQty: 1.6527 })).toBe(1);
  });
});
