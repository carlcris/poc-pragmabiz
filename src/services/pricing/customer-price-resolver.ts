import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { ResolvedCustomerPriceTier } from "@/types/customer-pricing";

type ItemPriceRow = {
  id: string;
  item_id: string;
  price_tier: string;
  price_tier_name: string;
  price: number | string;
  currency_code: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean | null;
};

type CustomerPriceRow = {
  item_id: string;
  price_tier: string;
  price: number | string;
  currency_code: string;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
};

type ResolveCustomerPricesInput = {
  supabase: SupabaseClient<Database>;
  companyId: string;
  businessUnitId: string;
  customerId: string;
  itemIds: string[];
  asOfDate: string;
};

const MAX_RESOLVED_PRICE_ROWS = 500;

const toItemPriceTier = (row: ItemPriceRow): ResolvedCustomerPriceTier => ({
  id: row.id,
  priceTier: row.price_tier,
  priceTierName: row.price_tier_name,
  price: Number(row.price),
  currencyCode: row.currency_code || "PHP",
  effectiveFrom: row.effective_from,
  effectiveTo: row.effective_to,
  isActive: row.is_active ?? true,
  source: "item",
});

export const resolveCustomerPrices = async ({
  supabase,
  companyId,
  businessUnitId,
  customerId,
  itemIds,
  asOfDate,
}: ResolveCustomerPricesInput) => {
  const uniqueItemIds = [...new Set(itemIds)];

  const basePricesPromise = supabase
    .from("item_prices")
    .select(
      "id, item_id, price_tier, price_tier_name, price, currency_code, effective_from, effective_to, is_active"
    )
    .eq("company_id", companyId)
    .in("item_id", uniqueItemIds)
    .eq("is_active", true)
    .lte("effective_from", asOfDate)
    .or(`effective_to.is.null,effective_to.gte.${asOfDate}`)
    .is("deleted_at", null)
    .order("effective_from", { ascending: false })
    .limit(MAX_RESOLVED_PRICE_ROWS);

  const customerPricesPromise = supabase
    .from("customer_item_prices")
    .select(
      "item_id, price_tier, price, currency_code, effective_from, effective_to, is_active"
    )
    .eq("company_id", companyId)
    .eq("business_unit_id", businessUnitId)
    .eq("customer_id", customerId)
    .in("item_id", uniqueItemIds)
    .eq("is_active", true)
    .lte("effective_from", asOfDate)
    .or(`effective_to.is.null,effective_to.gte.${asOfDate}`)
    .is("deleted_at", null)
    .order("effective_from", { ascending: false })
    .limit(MAX_RESOLVED_PRICE_ROWS);

  const [baseResult, customerResult] = await Promise.all([
    basePricesPromise,
    customerPricesPromise,
  ]);

  if (baseResult.error) throw baseResult.error;
  if (customerResult.error) throw customerResult.error;

  const pricesByItemId = new Map<string, Map<string, ResolvedCustomerPriceTier>>();

  for (const row of (baseResult.data || []) as ItemPriceRow[]) {
    const tiers = pricesByItemId.get(row.item_id) || new Map<string, ResolvedCustomerPriceTier>();
    if (!tiers.has(row.price_tier)) tiers.set(row.price_tier, toItemPriceTier(row));
    pricesByItemId.set(row.item_id, tiers);
  }

  for (const row of (customerResult.data || []) as CustomerPriceRow[]) {
    const tiers = pricesByItemId.get(row.item_id);
    const baseTier = tiers?.get(row.price_tier);
    if (!tiers || !baseTier || baseTier.source === "customer") continue;

    tiers.set(row.price_tier, {
      ...baseTier,
      price: Number(row.price),
      currencyCode: row.currency_code,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      isActive: row.is_active,
      source: "customer",
    });
  }

  return uniqueItemIds.map((itemId) => ({
    itemId,
    priceTiers: Array.from(pricesByItemId.get(itemId)?.values() || []).sort((a, b) =>
      a.priceTier.localeCompare(b.priceTier)
    ),
  }));
};
