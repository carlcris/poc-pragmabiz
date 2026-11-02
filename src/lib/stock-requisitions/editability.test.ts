import { describe, expect, it } from "vitest";
import { canEditStockRequisition } from "./editability";

describe("canEditStockRequisition", () => {
  it("allows editing a draft requisition with edit permission", () => {
    expect(canEditStockRequisition({ status: "draft" }, true)).toBe(true);
  });

  it.each(["submitted", "partially_fulfilled", "fulfilled", "cancelled"] as const)(
    "blocks editing once the requisition is %s",
    (status) => {
      expect(canEditStockRequisition({ status }, true)).toBe(false);
    }
  );

  it("requires edit permission", () => {
    expect(canEditStockRequisition({ status: "draft" }, false)).toBe(false);
  });
});
