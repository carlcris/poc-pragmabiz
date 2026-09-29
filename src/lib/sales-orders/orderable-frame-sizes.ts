import type { FrameQuotationSize } from "@/types/quotation";

/**
 * Sizes with explicit quotation availability belong in the order quantity
 * dialog only while at least one quoted frame remains unallocated.
 *
 * Existing draft-order sizes do not always carry availability metadata, so an
 * undefined value remains editable rather than being mistaken for zero.
 */
export function orderableFrameSizes(sizes: FrameQuotationSize[]): FrameQuotationSize[] {
  return sizes.filter((size) => size.remainingQuantity === undefined || size.remainingQuantity > 0);
}
