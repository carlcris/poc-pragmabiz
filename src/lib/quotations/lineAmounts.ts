/**
 * Splitting a saved line total back into subtotal, discount and tax.
 *
 * Line items store the FINAL total, so the quotation summary has to work
 * backwards to show what made it up. Two discount styles have to be handled:
 *
 *   percent — the usual case; the total is `subtotal x (1 - rate) x (1 + tax)`
 *   amount  — a fixed sum off, used by framing lines where the shop quotes
 *             "200 off this job" rather than a rate
 *
 * A fixed amount cannot be stored as a percentage: the rate that yields 200 off
 * one frame yields 600 off three, so changing the quantity would silently move
 * a figure the operator typed exactly.
 */

export type DiscountableLine = {
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
  /** Percentage, 0-100. Ignored when `discountAmount` is set. */
  discount?: number;
  /** Fixed sum off the line, in currency. Takes precedence over `discount`. */
  discountAmount?: number;
  taxRate?: number;
};

export type LineAmounts = {
  /** Before discount and tax. */
  subtotal: number;
  discount: number;
  tax: number;
};

/** Splits one line's stored total into the parts the summary displays. */
export function lineAmounts(item: DiscountableLine): LineAmounts {
  const lineTotal = item.lineTotal ?? (item.quantity || 0) * (item.unitPrice || 0);
  const taxRate = (item.taxRate || 0) / 100;

  // A fixed amount was already subtracted when the line total was built, so the
  // subtotal is simply the total with it added back — no rate to invert.
  if (item.discountAmount) {
    const taxable = taxRate > 0 ? lineTotal / (1 + taxRate) : lineTotal;
    return {
      subtotal: taxable + item.discountAmount,
      discount: item.discountAmount,
      tax: lineTotal - taxable,
    };
  }

  const discountRate = (item.discount || 0) / 100;
  // A fully discounted total is zero and cannot be inverted. Ordinary lines
  // retain their original quantity/rate; fixed frame discounts use the branch above.
  if (discountRate === 1) {
    const subtotal = (item.quantity || 0) * (item.unitPrice || 0);
    return { subtotal, discount: subtotal, tax: 0 };
  }
  const denominator = (1 - discountRate) * (1 + taxRate);
  const subtotal = denominator > 0 ? lineTotal / denominator : 0;
  const taxable = subtotal * (1 - discountRate);

  return {
    subtotal,
    discount: subtotal * discountRate,
    tax: taxable * taxRate,
  };
}
