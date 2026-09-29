import { lineAmounts, type DiscountableLine } from "./lineAmounts";

type DiscountedComponent = {
  discountAmount?: number;
};

type DiscountedFrameSize = {
  frameComponents: DiscountedComponent[];
};

export type QuotationTotalLine = DiscountableLine & {
  frameComponents?: DiscountedComponent[];
  frameSizes?: DiscountedFrameSize[];
};

export type QuotationTotals = {
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  totalAmount: number;
};

function componentDiscountTotal(line: QuotationTotalLine): number {
  const components =
    line.frameSizes && line.frameSizes.length > 0
      ? line.frameSizes.flatMap((size) => size.frameComponents)
      : (line.frameComponents ?? []);

  return components.reduce(
    (total, component) => total + Math.max(0, component.discountAmount ?? 0),
    0
  );
}

/**
 * Reconstructs the quotation summary from its payable line totals.
 *
 * Component amounts are stored net of their own discounts, while the parent
 * quotation row only records whole-line discounts. Adding component discounts
 * back to both the subtotal and discount exposes the full deduction without
 * changing the amount the customer owes.
 */
export function quotationTotals(lines: QuotationTotalLine[]): QuotationTotals {
  return lines.reduce<QuotationTotals>(
    (totals, line) => {
      const combinedFixedDiscount =
        Math.max(0, line.discountAmount ?? 0) + componentDiscountTotal(line);
      const amounts = lineAmounts({
        ...line,
        discountAmount: combinedFixedDiscount || undefined,
      });
      const lineTotal = line.lineTotal ?? (line.quantity || 0) * (line.unitPrice || 0);

      return {
        subtotal: totals.subtotal + amounts.subtotal,
        totalDiscount: totals.totalDiscount + amounts.discount,
        totalTax: totals.totalTax + amounts.tax,
        totalAmount: totals.totalAmount + lineTotal,
      };
    },
    { subtotal: 0, totalDiscount: 0, totalTax: 0, totalAmount: 0 }
  );
}
