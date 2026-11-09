import { describe, expect, it } from "vitest";
import { createStockAdjustmentLineItemSchema } from "./line-item-schema";
const schema = createStockAdjustmentLineItemSchema((key) => key, "quantityError");
const line = {
  itemId: "item",
  itemBatchId: "batch",
  batchEntryMode: "existing",
  uomId: "unit",
  currentQty: 0,
  adjustedQty: 5,
  unitCost: 1,
  adjustmentAmount: 5,
  adjustmentType: "add",
};
describe("existing batch destination form validation", () => {
  it("accepts an existing batch without a destination identity or received date", () => {
    expect(schema.parse(line)).toMatchObject({ itemBatchId: "batch", currentQty: 0 });
  });
  it.each([{ adjustmentType: "remove" }, { adjustmentAmount: 0 }])(
    "rejects invalid new destination adjustment %j",
    (change) => {
      const result = schema.safeParse({ ...line, ...change });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues).toContainEqual(
          expect.objectContaining({ message: "batchLocationIncreaseRequired" })
        );
    }
  );
  it("allows decreases at an existing destination and preserves historical receipt metadata", () => {
    expect(
      schema.parse({
        ...line,
        itemBatchLocationId: "destination",
        currentQty: 10,
        adjustedQty: 5,
        adjustmentType: "remove",
        batchReceivedAt: "1999-01-01T00:00:00",
      })
    ).toMatchObject({ batchReceivedAt: "1999-01-01T00:00:00", itemBatchLocationId: "destination" });
  });
  it("still requires a received date for a genuinely new batch", () => {
    expect(
      schema.safeParse({ ...line, itemBatchId: undefined, batchEntryMode: "new", batchCode: "NEW" })
        .success
    ).toBe(false);
  });
});

it("retains entered units without changing the base-unit delta", () => {
  expect(
    schema.parse({
      ...line,
      adjustedQty: 144,
      adjustmentAmount: 144,
      enteredQty: 1,
      enteredUnitOptionId: "box",
      enteredUnitLabel: "BOX (144)",
      enteredQtyPerUnit: 144,
    })
  ).toMatchObject({
    enteredQty: 1,
    enteredUnitOptionId: "box",
    enteredQtyPerUnit: 144,
    adjustedQty: 144,
    adjustmentAmount: 144,
  });
});
