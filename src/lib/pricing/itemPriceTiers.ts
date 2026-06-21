import type { ItemPriceTier } from "@/types/item";

export const DEFAULT_PRICE_TIER_CODE = "srp";
export const DEFAULT_PRICE_TIER_NAME = "SRP";

export type PriceTierSelection = {
  priceTier: string;
  priceTierName: string;
  price: number;
};

export const getItemPriceTierOptions = (item: {
  listPrice: number | null;
  defaultPriceTier?: string | null;
  priceTiers?: ItemPriceTier[];
}): PriceTierSelection[] => {
  if (item.priceTiers && item.priceTiers.length > 0) {
    return item.priceTiers.map((price) => ({
      priceTier: price.priceTier,
      priceTierName: price.priceTierName,
      price: price.price,
    }));
  }

  return [
    {
      priceTier: item.defaultPriceTier || DEFAULT_PRICE_TIER_CODE,
      priceTierName: DEFAULT_PRICE_TIER_NAME,
      price: item.listPrice ?? 0,
    },
  ];
};

export const getDefaultPriceTierCode = (item: {
  defaultPriceTier?: string | null;
}): string => item.defaultPriceTier || DEFAULT_PRICE_TIER_CODE;

export const resolvePriceTierSelection = (
  item: {
    listPrice: number | null;
    defaultPriceTier?: string | null;
    priceTiers?: ItemPriceTier[];
  },
  priceTier?: string | null
): PriceTierSelection => {
  const options = getItemPriceTierOptions(item);
  const targetTier = priceTier || getDefaultPriceTierCode(item);
  const selected =
    options.find((option) => option.priceTier === targetTier) ||
    options.find((option) => option.priceTier === getDefaultPriceTierCode(item)) ||
    options[0];

  return selected || { priceTier: targetTier, priceTierName: targetTier.toUpperCase(), price: 0 };
};
