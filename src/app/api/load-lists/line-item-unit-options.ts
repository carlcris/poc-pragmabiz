import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateLoadListRequest, UpdateLoadListRequest } from "@/types/load-list";
import type { Database } from "@/types/database.types";

type SupabaseLikeClient = SupabaseClient<Database>;

type LoadListLineInput =
  | CreateLoadListRequest["items"][number]
  | NonNullable<UpdateLoadListRequest["items"]>[number];

type ItemUnitOptionRow = {
  id: string;
  item_id: string;
  uom_id: string;
  qty_per_unit: number | string;
  is_active: boolean;
  deleted_at: string | null;
};

export class LoadListLineValidationError extends Error {}

export type ResolvedLoadListLineInput = LoadListLineInput & {
  item_unit_option_id: string;
  uom_id: string;
  qty_per_unit: number;
};

const buildOptionMapKey = (itemId: string, uomId: string) => `${itemId}:${uomId}`;

export const resolveLoadListLineUnitOptions = async (
  supabase: SupabaseLikeClient,
  companyId: string,
  items: LoadListLineInput[]
): Promise<ResolvedLoadListLineInput[]> => {
  if (items.length === 0) return [];

  const explicitOptionIds = Array.from(
    new Set(items.map((item) => item.itemUnitOptionId).filter((value): value is string => Boolean(value)))
  );
  const fallbackPairs = Array.from(
    new Set(
      items
        .filter((item) => !item.itemUnitOptionId && item.uomId)
        .map((item) => buildOptionMapKey(item.itemId, item.uomId!))
    )
  );

  const explicitOptionMap = new Map<string, ItemUnitOptionRow>();
  if (explicitOptionIds.length > 0) {
    const { data, error } = await supabase
      .from("item_unit_options")
      .select("id, item_id, uom_id, qty_per_unit, is_active, deleted_at")
      .eq("company_id", companyId)
      .in("id", explicitOptionIds);

    if (error) throw new Error(error.message);

    for (const row of (data || []) as ItemUnitOptionRow[]) {
      explicitOptionMap.set(row.id, row);
    }
  }

  const fallbackOptionMap = new Map<string, ItemUnitOptionRow>();
  if (fallbackPairs.length > 0) {
    const itemIds = Array.from(new Set(fallbackPairs.map((pair) => pair.split(":")[0])));
    const uomIds = Array.from(new Set(fallbackPairs.map((pair) => pair.split(":")[1])));

    const { data, error } = await supabase
      .from("item_unit_options")
      .select("id, item_id, uom_id, qty_per_unit, is_active, deleted_at, is_base, is_default, sort_order, created_at")
      .eq("company_id", companyId)
      .in("item_id", itemIds)
      .in("uom_id", uomIds)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("is_base", { ascending: false })
      .order("is_default", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    for (const row of (data || []) as ItemUnitOptionRow[]) {
      const key = buildOptionMapKey(row.item_id, row.uom_id);
      if (!fallbackOptionMap.has(key)) {
        fallbackOptionMap.set(key, row);
      }
    }
  }

  return items.map((item) => {
    if (item.itemUnitOptionId) {
      const option = explicitOptionMap.get(item.itemUnitOptionId);
      if (!option) {
        throw new LoadListLineValidationError("Selected unit option could not be found");
      }
      if (option.deleted_at) {
        throw new LoadListLineValidationError("Selected unit option has been deleted");
      }
      if (!option.is_active) {
        throw new LoadListLineValidationError("Selected unit option is inactive");
      }
      if (option.item_id !== item.itemId) {
        throw new LoadListLineValidationError("Selected unit option does not belong to the item");
      }
      if (item.uomId && item.uomId !== option.uom_id) {
        throw new LoadListLineValidationError("Selected unit option does not match the unit");
      }

      return {
        ...item,
        item_unit_option_id: option.id,
        uom_id: option.uom_id,
        qty_per_unit: Number(option.qty_per_unit ?? 1) || 1,
      };
    }

    if (!item.uomId) {
      throw new LoadListLineValidationError("Unit is required for each load list line");
    }

    const fallbackOption = fallbackOptionMap.get(buildOptionMapKey(item.itemId, item.uomId));
    if (!fallbackOption) {
      throw new LoadListLineValidationError("No active item unit option matches the selected item and unit");
    }

    return {
      ...item,
      item_unit_option_id: fallbackOption.id,
      uom_id: fallbackOption.uom_id,
      qty_per_unit: Number(fallbackOption.qty_per_unit ?? 1) || 1,
    };
  });
};
