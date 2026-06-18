import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateStockRequestPayload, UpdateStockRequestPayload } from "@/types/stock-request";
import type { Database } from "@/types/database.types";

type SupabaseLikeClient = SupabaseClient<Database>;

type StockRequestLineInput =
  | CreateStockRequestPayload["items"][number]
  | NonNullable<UpdateStockRequestPayload["items"]>[number];

type ItemUnitOptionRow = {
  id: string;
  item_id: string;
  uom_id: string;
  qty_per_unit: number | null;
  is_active: boolean;
  deleted_at: string | null;
};

export class StockRequestLineValidationError extends Error {}

export type ResolvedStockRequestLineInput = StockRequestLineInput & {
  item_unit_option_id: string;
  uom_id: string;
  qty_per_unit: number;
};

const buildOptionMapKey = (itemId: string, uomId: string) => `${itemId}:${uomId}`;

export const resolveStockRequestLineUnitOptions = async (
  supabase: SupabaseLikeClient,
  companyId: string,
  items: StockRequestLineInput[]
): Promise<ResolvedStockRequestLineInput[]> => {
  if (items.length === 0) return [];

  const explicitOptionIds = Array.from(
    new Set(
      items
        .map((item) => item.item_unit_option_id)
        .filter((value): value is string => Boolean(value))
    )
  );
  const fallbackPairs = Array.from(
    new Set(
      items
        .filter((item) => !item.item_unit_option_id && item.uom_id)
        .map((item) => buildOptionMapKey(item.item_id, item.uom_id!))
    )
  );

  const explicitOptionMap = new Map<string, ItemUnitOptionRow>();
  if (explicitOptionIds.length > 0) {
    const { data, error } = await supabase
      .from("item_unit_options")
      .select("id, item_id, uom_id, qty_per_unit, is_active, deleted_at")
      .eq("company_id", companyId)
      .in("id", explicitOptionIds);

    if (error) {
      throw new Error(error.message);
    }

    for (const row of (data || []) as ItemUnitOptionRow[]) {
      explicitOptionMap.set(row.id, row);
    }
  }

  const fallbackOptionMap = new Map<string, ItemUnitOptionRow>();
  if (fallbackPairs.length > 0) {
    const itemIds = Array.from(
      new Set(
        fallbackPairs
          .map((pair) => pair.split(":")[0])
          .filter((value): value is string => Boolean(value))
      )
    );
    const uomIds = Array.from(
      new Set(
        fallbackPairs
          .map((pair) => pair.split(":")[1])
          .filter((value): value is string => Boolean(value))
      )
    );

    const { data, error } = await supabase
      .from("item_unit_options")
      .select(
        "id, item_id, uom_id, qty_per_unit, is_active, deleted_at, is_base, is_default, sort_order, created_at"
      )
      .eq("company_id", companyId)
      .in("item_id", itemIds)
      .in("uom_id", uomIds)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("is_base", { ascending: false })
      .order("is_default", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    for (const row of (data || []) as ItemUnitOptionRow[]) {
      const key = buildOptionMapKey(row.item_id, row.uom_id);
      if (!fallbackOptionMap.has(key)) {
        fallbackOptionMap.set(key, row);
      }
    }
  }

  return items.map((item) => {
    if (item.item_unit_option_id) {
      const option = explicitOptionMap.get(item.item_unit_option_id);
      if (!option) {
        throw new StockRequestLineValidationError("Selected unit option could not be found");
      }
      if (option.deleted_at) {
        throw new StockRequestLineValidationError("Selected unit option has been deleted");
      }
      if (!option.is_active) {
        throw new StockRequestLineValidationError("Selected unit option is inactive");
      }
      if (option.item_id !== item.item_id) {
        throw new StockRequestLineValidationError(
          "Selected unit option does not belong to the item"
        );
      }
      if (item.uom_id && item.uom_id !== option.uom_id) {
        throw new StockRequestLineValidationError("Selected unit option does not match the unit");
      }

      return {
        ...item,
        item_unit_option_id: option.id,
        uom_id: option.uom_id,
        qty_per_unit: Number(option.qty_per_unit || 1),
      };
    }

    if (!item.uom_id) {
      throw new StockRequestLineValidationError("Unit is required for each stock request line");
    }

    const fallbackOption = fallbackOptionMap.get(buildOptionMapKey(item.item_id, item.uom_id));
    if (!fallbackOption) {
      throw new StockRequestLineValidationError(
        "No active item unit option matches the selected item and unit"
      );
    }

    return {
      ...item,
      item_unit_option_id: fallbackOption.id,
      uom_id: fallbackOption.uom_id,
      qty_per_unit: Number(fallbackOption.qty_per_unit || 1),
    };
  });
};
