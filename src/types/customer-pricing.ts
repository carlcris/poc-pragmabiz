import type { ItemPriceTier } from "@/types/item";

export type CustomerItemPrice = {
  id: string;
  customerId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  priceTier: string;
  price: number;
  currencyCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateCustomerItemPriceRequest = {
  itemId: string;
  priceTier: string;
  price: number;
  currencyCode: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
};

export type UpdateCustomerItemPriceRequest = {
  price?: number;
  currencyCode?: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  isActive?: boolean;
};

export type CustomerItemPriceFilters = {
  search?: string;
  priceTier?: string;
  status?: "all" | "active" | "inactive";
  page?: number;
  limit?: number;
};

export type CustomerItemPriceListResponse = {
  data: CustomerItemPrice[];
  capabilities: {
    canManage: boolean;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ResolvedCustomerPriceTier = ItemPriceTier & {
  source: "customer" | "item";
};

export type ResolveCustomerPricingRequest = {
  customerId: string;
  itemIds: string[];
  asOfDate?: string;
};

export type ResolveCustomerPricingResponse = {
  data: Array<{
    itemId: string;
    priceTiers: ResolvedCustomerPriceTier[];
  }>;
};
