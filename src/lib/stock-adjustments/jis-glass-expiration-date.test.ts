import { describe, expect, it } from "vitest";
import { getJisGlassExpirationDate } from "./jis-glass-expiration-date";
import { createStockAdjustmentLineItemSchema } from "./line-item-schema";

const glass = {
  category: "Glass",
  description: '10" X 12" JIS CUT SIZE CLEAR GLASS',
  name: "Glass",
  customFields: { production: "IMPORTED" },
};

describe("JIS glass expiration default", () => {
  it.each([
    ["2026-11-10", "2027-02-10"],
    ["2026-11-30", "2027-02-28"],
    ["2023-11-30", "2024-02-29"],
    ["2026-01-31", "2026-04-30"],
    ["2026-02-29", ""],
    ["", ""],
  ])("defaults %s to %s", (received, expected) => {
    expect(getJisGlassExpirationDate(glass, received)).toBe(expected);
  });
  it.each([
    null,
    { ...glass, description: "LOCAL CUT SIZE CLEAR GLASS" },
    { ...glass, category: "Backing" },
    { ...glass, description: "JIS ACRYLIC GLASS" },
    { ...glass, name: "Acrylic glass" },
    { ...glass, customFields: { production: "IMPORTED/LOCAL" } },
    { ...glass, description: "JIS123 GLASS" },
  ])("leaves ineligible items unset: %j", (item) => {
    expect(getJisGlassExpirationDate(item, "2026-11-10")).toBe("");
  });
  it("matches JIS case-insensitively", () => {
    expect(getJisGlassExpirationDate({ ...glass, description: "Glass (jis)" }, "2026-11-10")).toBe(
      "2027-02-10"
    );
  });
  it.each(["", "2028-01-01"])(
    "preserves override metadata and manual value %s on line save",
    (expiration) => {
      const schema = createStockAdjustmentLineItemSchema((key) => key, "quantityError");
      expect(
        schema.parse({
          itemId: "item",
          batchEntryMode: "new",
          batchCode: "NEW",
          batchReceivedAt: "2026-11-10",
          batchExpirationDate: expiration,
          batchExpirationDateOverridden: true,
          uomId: "unit",
          currentQty: 0,
          adjustedQty: 1,
          adjustmentAmount: 1,
          adjustmentType: "add",
          unitCost: 1,
        })
      ).toMatchObject({ batchExpirationDate: expiration, batchExpirationDateOverridden: true });
    }
  );
});
