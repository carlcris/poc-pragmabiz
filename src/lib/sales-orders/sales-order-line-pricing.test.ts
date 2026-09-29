import { describe, expect, it } from "vitest";
import type { FrameQuotationSize } from "@/types/quotation";
import {
  salesOrderLinePricing,
  quotationLinePricing,
  type QuotationLinePricing,
} from "./sales-order-line-pricing";

const size = (id: string, quantity: number): FrameQuotationSize => ({
  frameConfiguration: {
    id,
    quotationConfigurationId: id,
    frameQuantity: quantity,
    width: 10,
    height: 8,
    fixedAllowance: 0,
    serviceFeeMode: "per_frame",
    serviceFeeAmount: 0,
    totalServiceFee: 0,
    invoiceDisplayMode: "components",
  },
  frameComponents: [],
  matLayers: [],
});
const source: QuotationLinePricing = {
  quantity: 2,
  discountAmount: 35,
  taxAmount: 37.8,
  lineTotal: 352.8,
  sizes: [
    {
      configurationId: "a",
      quantity: 1,
      serviceFee: 0,
      components: [{ amount: 80, discountAmount: 20 }],
    },
    {
      configurationId: "b",
      quantity: 1,
      serviceFee: 0,
      components: [{ amount: 270, discountAmount: 30 }],
    },
  ],
};
const line = {
  quantity: 2,
  unitPrice: 175,
  discount: 0,
  taxRate: 12,
  quotationItemId: "quote-line",
  quotationPricing: source,
  frameSizes: [size("a", 1), size("b", 1)],
};

describe("sales order editor pricing", () => {
  it("matches database half-cent rounding for partial component amounts and discounts", () => {
    expect(
      salesOrderLinePricing({
        ...line,
        quantity: 1,
        frameSizes: [size("a", 1)],
        quotationPricing: {
          quantity: 2,
          discountAmount: 0,
          taxAmount: 0,
          lineTotal: 20.15,
          sizes: [
            {
              configurationId: "a",
              quantity: 2,
              serviceFee: 0,
              components: [{ amount: 20.15, discountAmount: 2.15 }],
            },
          ],
        },
      })
    ).toMatchObject({ subtotal: 11.16, totalDiscount: 1.08, totalAmount: 10.08 });
  });
  it("includes component and parent discounts without subtracting either twice", () => {
    expect(salesOrderLinePricing(line)).toMatchObject({
      subtotal: 400,
      totalDiscount: 85,
      totalTax: 37.8,
      totalAmount: 352.8,
      sizeAmounts: [80, 270],
    });
  });
  it("allocates a fixed deduction by selected value, not the rounded average rate", () => {
    expect(
      salesOrderLinePricing({ ...line, quantity: 1, frameSizes: [size("a", 1), size("b", 0)] })
    ).toMatchObject({ subtotal: 100, totalDiscount: 28, totalTax: 8.64, totalAmount: 80.64 });
    expect(
      salesOrderLinePricing({ ...line, quantity: 1, frameSizes: [size("a", 0), size("b", 1)] })
    ).toMatchObject({ subtotal: 300, totalDiscount: 57, totalTax: 29.16, totalAmount: 272.16 });
    expect(salesOrderLinePricing(line).totalAmount).toBe(352.8);
  });
  it("retains exact quoted money that rounded quantity-times-rate cannot reproduce", () => {
    expect(
      salesOrderLinePricing({
        ...line,
        quantity: 5,
        unitPrice: 324.96,
        frameSizes: [],
        quotationPricing: {
          quantity: 5,
          discountAmount: 200,
          taxAmount: 170.97,
          lineTotal: 1595.76,
          sizes: [],
        },
      })
    ).toMatchObject({
      subtotal: 1624.79,
      totalDiscount: 200,
      totalTax: 170.97,
      totalAmount: 1595.76,
    });
  });
  it("uses original quotation money when editing an already-partial order", () => {
    const partial = {
      ...line,
      quantity: 1,
      discountAmount: 0.03,
      lineTotal: 0.3,
      quotationPricing: {
        quantity: 3,
        discountAmount: 0.1,
        taxAmount: 0,
        lineTotal: 0.9,
        sizes: [],
      },
      frameSizes: [],
    };
    expect(salesOrderLinePricing({ ...partial, quantity: 2 })).toMatchObject({
      subtotal: 0.67,
      totalDiscount: 0.07,
      totalAmount: 0.6,
    });
  });
  it("retains a fully discounted frame without dividing by zero", () => {
    expect(
      salesOrderLinePricing({
        ...line,
        quantity: 1,
        frameSizes: [],
        quotationPricing: {
          quantity: 2,
          discountAmount: 200,
          taxAmount: 0,
          lineTotal: 0,
          sizes: [],
        },
      })
    ).toMatchObject({ subtotal: 100, totalDiscount: 100, totalTax: 0, totalAmount: 0 });
  });
  it("recalculates ordinary inventory percentage discounts from editable inputs", () => {
    expect(
      salesOrderLinePricing({
        quantity: 2,
        unitPrice: 100,
        discount: 10,
        taxRate: 12,
        discountAmount: 999,
        lineTotal: 999,
      })
    ).toMatchObject({ subtotal: 200, totalDiscount: 20, totalTax: 21.6, totalAmount: 201.6 });
  });
  it("captures a single configured size even when the API omits the grouped array", () => {
    const snapshot = quotationLinePricing({
      id: "quote-line",
      itemId: "item",
      description: "Frame",
      quantity: 1,
      uomId: "uom",
      unitPrice: 100,
      discount: 0,
      discountAmount: 20,
      taxRate: 0,
      taxAmount: 0,
      lineTotal: 80,
      frameConfiguration: size("a", 1).frameConfiguration,
    });
    expect(snapshot.sizes).toHaveLength(1);
    expect(snapshot.sizes[0].configurationId).toBe("a");
  });
});
