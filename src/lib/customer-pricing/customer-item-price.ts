import type { CustomerItemPrice } from "@/types/customer-pricing";

export type CustomerItemPriceRow = {
  id: string;
  customer_id: string;
  item_id: string;
  price_tier: string;
  price: number | string;
  currency_code: string;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  version?: number;
  item?:
    | { item_code: string; item_name: string }
    | Array<{ item_code: string; item_name: string }>
    | null;
};

const getItem = (row: CustomerItemPriceRow) => (Array.isArray(row.item) ? row.item[0] : row.item);

export const toCustomerItemPrice = (row: CustomerItemPriceRow): CustomerItemPrice => {
  const item = getItem(row);

  return {
    id: row.id,
    customerId: row.customer_id,
    itemId: row.item_id,
    itemCode: item?.item_code || "",
    itemName: item?.item_name || "",
    priceTier: row.price_tier,
    price: Number(row.price),
    currencyCode: row.currency_code,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};
