import { describe, expect, it } from "vitest";
import type { FrameQuotationSize } from "@/types/quotation";
import { salesOrderLineEditValues } from "./sales-order-line-edit-values";

const size = (quantity: number, remainingQuantity?: number): FrameQuotationSize => ({
  frameConfiguration: {
    width: 10,
    height: 8,
    fixedAllowance: 0,
    serviceFeeMode: "per_frame",
    serviceFeeAmount: 0,
    totalServiceFee: 0,
    invoiceDisplayMode: "components",
    frameQuantity: quantity,
  },
  frameComponents: [],
  matLayers: [],
  remainingQuantity,
});

describe("salesOrderLineEditValues", () => {
  it("preserves a saved ordinary item's quantity when the API returns no sizes", () => {
    const item = { quantity: 7, description: "Moulding", frameSizes: [] };
    expect(salesOrderLineEditValues(item)).toEqual(item);
  });

  it("preserves a new ordinary item's quantity without a sizes field", () => {
    expect(salesOrderLineEditValues({ quantity: 7 }).quantity).toBe(7);
  });

  it("totals only orderable frame sizes without changing the original selection", () => {
    const item = { quantity: 9, frameSizes: [size(2), size(3, 3), size(4, 0)] };
    const edited = salesOrderLineEditValues(item);
    expect(edited.quantity).toBe(5);
    expect(edited.frameSizes).toHaveLength(2);
    expect(item.quantity).toBe(9);
    expect(item.frameSizes).toHaveLength(3);
  });

  it("does not restore the original frame quantity when every size is unavailable", () => {
    expect(salesOrderLineEditValues({ quantity: 4, frameSizes: [size(4, 0)] }).quantity).toBe(0);
  });
});
