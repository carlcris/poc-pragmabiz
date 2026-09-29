import type { FrameQuotationSize, QuotationLineItem } from "@/types/quotation";
import { quotationTotals } from "@/lib/quotations/quotation-totals";

/** Read-only source money. Never submitted as client-owned order pricing. */
export type QuotationLinePricing = {
  quantity: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
  sizes: {
    configurationId: string;
    quantity: number;
    serviceFee: number;
    components: { amount: number; discountAmount: number }[];
  }[];
};

export function quotationLinePricing(line: QuotationLineItem): QuotationLinePricing {
  const sizes = line.frameSizes?.length
    ? line.frameSizes
    : line.frameConfiguration
      ? [
          {
            frameConfiguration: line.frameConfiguration,
            frameComponents: line.frameComponents ?? [],
          },
        ]
      : [];
  return {
    quantity: line.quantity,
    discountAmount: line.discountAmount,
    taxAmount: line.taxAmount,
    lineTotal: line.lineTotal,
    sizes: sizes.map((size) => ({
      configurationId:
        size.frameConfiguration.quotationConfigurationId || size.frameConfiguration.id || "",
      quantity: size.frameConfiguration.frameQuantity ?? 0,
      serviceFee: size.frameConfiguration.totalServiceFee,
      components: size.frameComponents.map((component) => ({
        amount: component.totalAmount,
        discountAmount: component.discountAmount ?? 0,
      })),
    })),
  };
}

type PricedOrderLine = {
  quantity: number;
  unitPrice: number;
  discount: number;
  discountAmount?: number;
  taxRate: number;
  lineTotal?: number;
  quotationItemId?: string | null;
  quotationPricing?: QuotationLinePricing;
  frameSizes?: FrameQuotationSize[];
  frameComponents?: FrameQuotationSize["frameComponents"];
};

const cents = (amount: number) => {
  const absolute = Math.abs(amount);
  // PostgreSQL NUMERIC rounds half cents away from zero. Scale the floating
  // point correction too (20.15 / 2 must be 10.08, not 10.07).
  return (
    (Math.sign(amount) * Math.round((absolute + Number.EPSILON * Math.max(1, absolute)) * 100)) /
    100
  );
};

/** Mirrors prepare_sales_order_draft_item; the RPC remains authoritative on save. */
export function salesOrderLinePricing(line: PricedOrderLine) {
  const source = line.quotationPricing;
  if (!line.quotationItemId) {
    const subtotal = line.quantity * line.unitPrice;
    const totalDiscount = (subtotal * line.discount) / 100;
    const totalTax = ((subtotal - totalDiscount) * line.taxRate) / 100;
    return {
      subtotal,
      totalDiscount,
      totalTax,
      totalAmount: subtotal - totalDiscount + totalTax,
      sizeAmounts: [] as number[],
    };
  }
  // A deleted/inaccessible source does not erase an already-saved order's money.
  // The dialog blocks quantity changes without the source rather than repricing it.
  if (!source) return { ...quotationTotals([line]), sizeAmounts: [] as number[] };

  const sourceSubtotal = source.lineTotal + source.discountAmount - source.taxAmount;
  const sizesById = new Map(source.sizes.map((size) => [size.configurationId, size]));
  let componentDiscount = 0;
  const sizeAmounts = (line.frameSizes ?? []).map((size) => {
    const original = sizesById.get(
      size.frameConfiguration.quotationConfigurationId || size.frameConfiguration.id || ""
    );
    if (!original || original.quantity <= 0) return 0;
    const quantity = size.frameConfiguration.frameQuantity ?? 0;
    const scale = (amount: number) =>
      quantity === original.quantity ? amount : cents((amount * quantity) / original.quantity);
    componentDiscount += original.components.reduce(
      (sum, component) => sum + scale(component.discountAmount),
      0
    );
    return original.components.reduce(
      (sum, component) => sum + scale(component.amount),
      scale(original.serviceFee)
    );
  });
  const fullSelection = line.quantity === source.quantity;
  const netComponents = source.sizes.length
    ? sizeAmounts.reduce((sum, amount) => sum + amount, 0)
    : cents((sourceSubtotal * line.quantity) / source.quantity);
  const parentDiscount = fullSelection
    ? source.discountAmount
    : sourceSubtotal === 0
      ? 0
      : cents((source.discountAmount * netComponents) / sourceSubtotal);
  const totalTax = fullSelection
    ? source.taxAmount
    : sourceSubtotal === source.discountAmount
      ? 0
      : cents(
          (source.taxAmount * (netComponents - parentDiscount)) /
            (sourceSubtotal - source.discountAmount)
        );
  const totalAmount = fullSelection
    ? source.lineTotal
    : cents(netComponents - parentDiscount + totalTax);
  const totalDiscount = cents(parentDiscount + componentDiscount);
  return {
    subtotal: cents(totalAmount + totalDiscount - totalTax),
    totalDiscount,
    totalTax,
    totalAmount,
    sizeAmounts,
  };
}
