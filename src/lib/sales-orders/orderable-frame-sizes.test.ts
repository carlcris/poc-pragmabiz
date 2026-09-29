import { describe, expect, it } from "vitest";

import { orderableFrameSizes } from "./orderable-frame-sizes";
import type { FrameQuotationConfiguration, FrameQuotationSize } from "@/types/quotation";

const configuration = (id: string): FrameQuotationConfiguration => ({
  id,
  width: 20,
  height: 25,
  fixedAllowance: 0,
  serviceFeeMode: "per_frame",
  serviceFeeAmount: 0,
  totalServiceFee: 0,
  invoiceDisplayMode: "components",
  billingMode: "chop_join",
});

const size = (id: string, remainingQuantity?: number): FrameQuotationSize => ({
  frameConfiguration: configuration(id),
  frameComponents: [],
  matLayers: [],
  remainingQuantity,
});

describe("orderableFrameSizes", () => {
  it("removes a quotation size once no quantity remains", () => {
    expect(orderableFrameSizes([size("ordered", 0), size("pending", 1)])).toHaveLength(1);
    expect(
      orderableFrameSizes([size("ordered", 0), size("pending", 1)])[0].frameConfiguration.id
    ).toBe("pending");
  });

  it("keeps existing order sizes that have no quotation availability metadata", () => {
    expect(orderableFrameSizes([size("draft-size")])).toHaveLength(1);
  });
});
