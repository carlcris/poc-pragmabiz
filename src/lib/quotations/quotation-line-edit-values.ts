import type { QuotationLineItem } from "@/types/quotation";
import { frameLineDescription } from "@/lib/framing/description";

export function quotationLineEditValues(item: QuotationLineItem) {
  return {
    itemId: item.itemId,
    itemCode: item.itemCode,
    itemName: item.itemName,
    description: frameLineDescription(item),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    uomId: item.uomId,
    uomCode: item.uomCode,
    uomName: item.uomName,
    pricingTier: item.pricingTier,
    pricingTierName: item.pricingTierName,
    discount: item.discount,
    discountAmount: item.discountAmount,
    taxRate: item.taxRate,
    lineTotal: item.lineTotal,
    frameConfiguration: item.frameConfiguration,
    frameComponents: item.frameComponents,
    matLayers: item.matLayers,
    frameSizes: item.frameSizes,
  };
}
