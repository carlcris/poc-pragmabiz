import { describe, expect, it } from "vitest";
import type { QuotationLineItem } from "@/types/quotation";
import { quotationLineEditValues } from "./quotation-line-edit-values";
import { quotationTotals } from "./quotation-totals";

const savedLine: QuotationLineItem = {
  id: "line-1",
  itemId: "service-1",
  description: "Chop & join",
  quantity: 1,
  uomId: "frame",
  unitPrice: 459.67,
  discount: 0,
  discountAmount: 50,
  taxRate: 0,
  taxAmount: 0,
  lineTotal: 409.67,
};

describe("quotation line edit values", () => {
  it("preserves the saved fixed discount used to reopen the frame dialog", () => {
    const editable = quotationLineEditValues(savedLine);
    expect(editable.discountAmount).toBe(50);
    expect(editable.discount).toBe(0);
    expect(editable.lineTotal).toBe(409.67);
    const totals = quotationTotals([editable]);
    expect(totals.subtotal).toBeCloseTo(459.67, 2);
    expect(totals.totalDiscount).toBe(50);
    expect(totals.totalAmount).toBeCloseTo(409.67, 2);
  });

  it("keeps zero discounts when switching to an undiscounted line", () => {
    const editable = quotationLineEditValues({
      ...savedLine,
      discountAmount: 0,
      lineTotal: 459.67,
    });
    expect(editable.discountAmount).toBe(0);
  });

  it("retains the percentage and amount for ordinary discounted lines", () => {
    const editable = quotationLineEditValues({
      ...savedLine,
      unitPrice: 100,
      discount: 10,
      discountAmount: 10,
      lineTotal: 90,
    });
    expect(editable.discount).toBe(10);
    expect(editable.discountAmount).toBe(10);
    expect(editable.lineTotal).toBe(90);
  });
});
