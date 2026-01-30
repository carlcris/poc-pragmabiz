export type ItemPackaging = import("./inventory-normalization").ItemPackaging;

export type ItemPrice = {
  id: string;
  itemId: string;
  priceTier: string;
  priceTierName: string;
  price: number;
  currencyCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
};
