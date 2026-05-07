import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  StockRequisitionLineValidationError,
  type ResolvedStockRequisitionLineInput,
} from "@/app/api/stock-requisitions/line-item-unit-options";

type ItemCostRow = {
  id: string;
  import_cost: number | string | null;
  import_currency: string | null;
  purchase_price: number | string | null;
  sales_price: number | string | null;
};

export type ResolvedCostLineItem = ResolvedStockRequisitionLineInput & {
  unitPrice: number;
  unitPriceCurrency: string;
};

const normalizeCurrency = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
};

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getDefaultLineCost = (item: ItemCostRow | null | undefined) => {
  if (item?.import_cost != null) {
    return {
      unitPrice: toFiniteNumber(item.import_cost),
      currency: normalizeCurrency(item.import_currency) ?? "PHP",
    };
  }

  return {
    unitPrice: toFiniteNumber(item?.purchase_price ?? item?.sales_price ?? 0),
    currency: "PHP",
  };
};

export async function resolveStockRequisitionLineCosts(
  supabase: SupabaseClient<Database>,
  companyId: string,
  lineItems: ResolvedStockRequisitionLineInput[],
  options: {
    canUseSubmittedCost: boolean;
    submittedCurrency?: string | null;
    preservedCosts?: Map<string, { unitPrice: number; currency: string }>;
  }
): Promise<{ items: ResolvedCostLineItem[]; currency: string }> {
  if (lineItems.length === 0) {
    return { items: [], currency: "PHP" };
  }

  if (options.canUseSubmittedCost) {
    const currency = normalizeCurrency(options.submittedCurrency) ?? "PHP";
    return {
      currency,
      items: lineItems.map((item) => ({
        ...item,
        unitPrice: toFiniteNumber(item.unitPrice),
        unitPriceCurrency: currency,
      })),
    };
  }

  const unresolvedItemIds = Array.from(
    new Set(
      lineItems
        .filter((item) => !options.preservedCosts?.has(buildLineCostKey(item)))
        .map((item) => item.itemId)
    )
  );

  const itemCostMap = new Map<string, ItemCostRow>();
  if (unresolvedItemIds.length > 0) {
    const { data, error } = await supabase
      .from("items")
      .select("id, import_cost, import_currency, purchase_price, sales_price")
      .eq("company_id", companyId)
      .in("id", unresolvedItemIds);

    if (error) throw error;

    for (const item of (data || []) as ItemCostRow[]) {
      itemCostMap.set(item.id, item);
    }
  }

  const items = lineItems.map((item) => {
    const preservedCost = options.preservedCosts?.get(buildLineCostKey(item));
    const cost = preservedCost ?? getDefaultLineCost(itemCostMap.get(item.itemId));

    return {
      ...item,
      unitPrice: cost.unitPrice,
      unitPriceCurrency: cost.currency,
    };
  });
  const currencies = new Set(items.map((item) => item.unitPriceCurrency));

  if (currencies.size > 1) {
    throw new StockRequisitionLineValidationError(
      "Selected items resolve to different cost currencies"
    );
  }

  return { items, currency: items[0]?.unitPriceCurrency ?? "PHP" };
}

export const buildLineCostKey = (item: { itemId: string; item_unit_option_id: string }) =>
  `${item.itemId}:${item.item_unit_option_id}`;
