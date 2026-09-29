import { describe, expect, it } from "vitest";

import { lineAmounts } from "./lineAmounts";

describe("lineAmounts — splitting a stored total back into its parts", () => {
  it("retains the gross amount of a fully discounted ordinary line", () => {
    expect(
      lineAmounts({ quantity: 2, unitPrice: 100, discount: 100, taxRate: 12, lineTotal: 0 })
    ).toEqual({ subtotal: 200, discount: 200, tax: 0 });
  });
  it("inverts a percentage discount", () => {
    // 1000 subtotal, 10% off, no tax -> 900 stored.
    const parts = lineAmounts({ lineTotal: 900, discount: 10 });
    expect(parts.subtotal).toBeCloseTo(1000, 2);
    expect(parts.discount).toBeCloseTo(100, 2);
    expect(parts.tax).toBeCloseTo(0, 2);
  });

  it("adds a fixed discount back rather than inverting a rate", () => {
    // 1850 gross, 200 off -> 1650 stored. The summary must show 200, not 0.
    const parts = lineAmounts({ lineTotal: 1650, discountAmount: 200 });
    expect(parts.subtotal).toBeCloseTo(1850, 2);
    expect(parts.discount).toBeCloseTo(200, 2);
  });

  it("prefers the fixed amount over any percentage", () => {
    const parts = lineAmounts({ lineTotal: 1650, discount: 99, discountAmount: 200 });
    expect(parts.discount).toBeCloseTo(200, 2);
    expect(parts.subtotal).toBeCloseTo(1850, 2);
  });

  it("keeps a fixed discount whole when tax is charged", () => {
    // 1000 gross, 100 off, 12% tax on 900 -> 1008 stored.
    const parts = lineAmounts({ lineTotal: 1008, discountAmount: 100, taxRate: 12 });
    expect(parts.subtotal).toBeCloseTo(1000, 2);
    expect(parts.discount).toBeCloseTo(100, 2);
    expect(parts.tax).toBeCloseTo(108, 2);
  });

  it("falls back to quantity x price when no total was stored", () => {
    const parts = lineAmounts({ quantity: 3, unitPrice: 100 });
    expect(parts.subtotal).toBeCloseTo(300, 2);
    expect(parts.discount).toBe(0);
  });

  it("treats a zero discount amount as no fixed discount", () => {
    // Otherwise a 0 would take the fixed-amount branch and ignore the rate.
    const parts = lineAmounts({ lineTotal: 900, discount: 10, discountAmount: 0 });
    expect(parts.discount).toBeCloseTo(100, 2);
  });
});
