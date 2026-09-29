import type { FrameQuotationConfiguration } from "@/types/quotation";

type SelectableFrameSize = {
  frameConfiguration: Pick<
    FrameQuotationConfiguration,
    "quotationConfigurationId" | "frameQuantity"
  >;
};

export function frameSizeSelectionPayload(sizes?: readonly SelectableFrameSize[]) {
  if (!sizes?.length) return undefined;
  // Zero explicitly deselects a size. Keep missing, negative, or fractional
  // quantities visible to validation; an entirely deselected line stays invalid.
  return sizes
    .filter(({ frameConfiguration }) => frameConfiguration.frameQuantity !== 0)
    .map(({ frameConfiguration }) => ({
      quotationConfigurationId: frameConfiguration.quotationConfigurationId || "",
      quantity: frameConfiguration.frameQuantity ?? 0,
    }));
}
