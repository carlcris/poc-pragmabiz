import { describe, expect, it } from "vitest";

import { quotationTotals } from "./quotation-totals";

describe("quotationTotals", () => {
  it("includes a component discount in the summary without changing the payable total", () => {
    const totals = quotationTotals([
      {
        lineTotal: 90,
        discountAmount: 0,
        frameComponents: [{ discountAmount: 22.5 }],
      },
    ]);

    expect(totals.subtotal).toBeCloseTo(112.5, 2);
    expect(totals.totalDiscount).toBeCloseTo(22.5, 2);
    expect(totals.totalAmount).toBeCloseTo(90, 2);
  });

  it("combines component and whole-line fixed discounts", () => {
    const totals = quotationTotals([
      {
        lineTotal: 80,
        discountAmount: 10,
        frameComponents: [{ discountAmount: 22.5 }],
      },
    ]);

    expect(totals.subtotal).toBeCloseTo(112.5, 2);
    expect(totals.totalDiscount).toBeCloseTo(32.5, 2);
    expect(totals.totalAmount).toBeCloseTo(80, 2);
  });

  it("uses multi-size components once instead of double-counting the singular compatibility list", () => {
    const totals = quotationTotals([
      {
        lineTotal: 85,
        frameComponents: [{ discountAmount: 999 }],
        frameSizes: [
          { frameComponents: [{ discountAmount: 10 }] },
          { frameComponents: [{ discountAmount: 5 }] },
        ],
      },
    ]);

    expect(totals.subtotal).toBeCloseTo(100, 2);
    expect(totals.totalDiscount).toBeCloseTo(15, 2);
    expect(totals.totalAmount).toBeCloseTo(85, 2);
  });

  it("preserves percentage discounts on ordinary lines", () => {
    const totals = quotationTotals([{ lineTotal: 900, discount: 10 }]);

    expect(totals.subtotal).toBeCloseTo(1000, 2);
    expect(totals.totalDiscount).toBeCloseTo(100, 2);
    expect(totals.totalAmount).toBeCloseTo(900, 2);
  });
});
