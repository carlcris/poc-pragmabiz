import type { FrameQuotationSize } from "@/types/quotation";
import { orderableFrameSizes } from "./orderable-frame-sizes";

/** Initialize editable quantities without treating an ordinary line as a frame. */
export function salesOrderLineEditValues<
  T extends { quantity: number; frameSizes?: FrameQuotationSize[] },
>(item: T) {
  const frameSizes = item.frameSizes ? orderableFrameSizes(item.frameSizes) : undefined;
  return {
    ...item,
    frameSizes,
    quantity: item.frameSizes?.length
      ? (frameSizes ?? []).reduce(
          (total, size) => total + (size.frameConfiguration.frameQuantity ?? 0),
          0
        )
      : item.quantity,
  };
}
