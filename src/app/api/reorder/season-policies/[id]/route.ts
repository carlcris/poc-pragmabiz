import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { reorderSeasonItemPolicyUpdateSchema } from "@/lib/validations/reorder";
import {
  sortItemUnitOptions,
  transformItemUnitOptionRow,
  type DbItemUnitOptionRow,
} from "@/lib/items/itemUnitOptions";
import type { ItemUnitOption } from "@/types/item";

type RelatedItem = {
  item_code: string | null;
  item_name: string | null;
  uom_id: string | null;
  units_of_measure: RelatedUom | RelatedUom[] | null;
  item_unit_options: DbPolicyItemUnitOptionRow[] | null;
};

type RelatedSeason = {
  code: string | null;
  name: string | null;
};

type RelatedUom = {
  code: string | null;
  name?: string | null;
  symbol?: string | null;
};

type DbPolicyItemUnitOptionRow = DbItemUnitOptionRow & {
  deleted_at?: string | null;
};

type DbReorderSeasonItemPolicy = {
  id: string;
  season_id: string;
  item_id: string;
  item_unit_option_id: string | null;
  uom_id: string;
  qty_per_unit: number | string;
  reorder_level: number | string;
  reorder_quantity: number | string;
  base_reorder_level: number | string;
  base_reorder_quantity: number | string;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  policy_uom: RelatedUom | RelatedUom[] | null;
  items: RelatedItem | RelatedItem[] | null;
  reorder_seasons: RelatedSeason | RelatedSeason[] | null;
};

type ExistingPolicyRow = {
  item_id: string;
};

type UnitOptionSnapshot = {
  id: string;
  uom_id: string;
  qty_per_unit: number | string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const unwrapRelation = <T,>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? value[0] || null : value;

const toPolicyResponse = (row: DbReorderSeasonItemPolicy) => {
  const item = unwrapRelation(row.items);
  const season = unwrapRelation(row.reorder_seasons);
  const baseUom = unwrapRelation(item?.units_of_measure ?? null);
  const policyUom = unwrapRelation(row.policy_uom);
  const unitOptions = sortItemUnitOptions(
    (item?.item_unit_options || [])
      .filter((option) => !option.deleted_at && option.is_active)
      .map((option) => transformItemUnitOptionRow(option, baseUom?.code || ""))
  );
  const unitOption =
    unitOptions.find((option) => option.id === row.item_unit_option_id) ||
    unitOptions.find((option) => option.isDefault) ||
    unitOptions.find((option) => option.isBase) ||
    unitOptions[0] ||
    null;
  const reorderLevel = toNumber(row.reorder_level);
  const reorderQuantity = toNumber(row.reorder_quantity);
  const qtyPerUnit = toNumber(row.qty_per_unit) || 1;
  const baseReorderLevel = toNumber(row.base_reorder_level);
  const baseReorderQuantity = toNumber(row.base_reorder_quantity);

  return {
    id: row.id,
    seasonId: row.season_id,
    seasonCode: season?.code || "",
    seasonName: season?.name || "",
    itemId: row.item_id,
    itemCode: item?.item_code || "",
    itemName: item?.item_name || "",
    itemUnitOptionId: row.item_unit_option_id,
    uomId: row.uom_id,
    unitOptions: unitOptions.map((option: ItemUnitOption) => ({
      id: option.id,
      label: option.displayLabel,
      qtyPerUnit: option.qtyPerUnit,
    })),
    reorderLevel,
    reorderUnitLevel: reorderLevel,
    reorderQuantity,
    reorderUnitQuantity: reorderQuantity,
    baseReorderLevel,
    baseReorderQuantity,
    unitLabel:
      unitOption?.displayLabel ||
      policyUom?.symbol ||
      policyUom?.code ||
      baseUom?.symbol ||
      baseUom?.code ||
      "",
    qtyPerUnit,
    totalQuantity: baseReorderQuantity,
    baseUnitLabel: baseUom?.symbol || baseUom?.code || "",
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.REORDER_MANAGEMENT, "edit");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, userId } = context;

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid seasonal reorder policy id" }, { status: 400 });
    }

    const parsed = reorderSeasonItemPolicyUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid seasonal reorder policy" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      updated_by: userId,
    };
    if (parsed.data.seasonId !== undefined) updateData.season_id = parsed.data.seasonId;
    if (parsed.data.itemId !== undefined) updateData.item_id = parsed.data.itemId;
    if (parsed.data.itemUnitOptionId !== undefined) {
      if (!parsed.data.itemUnitOptionId) {
        return NextResponse.json({ error: "Unit is required" }, { status: 400 });
      }

      const { data: existingPolicy, error: existingPolicyError } = await supabase
        .from("reorder_season_item_policies")
        .select("item_id")
        .eq("id", id)
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .maybeSingle();

      if (existingPolicyError) {
        console.error("Error resolving seasonal reorder policy before update:", existingPolicyError);
        return NextResponse.json({ error: "Failed to update seasonal reorder policy" }, { status: 500 });
      }

      if (!existingPolicy) {
        return NextResponse.json({ error: "Seasonal reorder policy not found" }, { status: 404 });
      }

      const targetItemId = parsed.data.itemId ?? (existingPolicy as ExistingPolicyRow).item_id;
      const { data: unitOption, error: unitOptionError } = await supabase
        .from("item_unit_options")
        .select("id, uom_id, qty_per_unit")
        .eq("id", parsed.data.itemUnitOptionId)
        .eq("company_id", companyId)
        .eq("item_id", targetItemId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .maybeSingle();

      if (unitOptionError) {
        console.error("Error resolving seasonal reorder policy unit option:", unitOptionError);
        return NextResponse.json({ error: "Failed to update seasonal reorder policy" }, { status: 500 });
      }

      if (!unitOption) {
        return NextResponse.json({ error: "Selected unit is not available for this item" }, { status: 400 });
      }

      const unitSnapshot = unitOption as UnitOptionSnapshot;
      updateData.item_unit_option_id = unitSnapshot.id;
      updateData.uom_id = unitSnapshot.uom_id;
      updateData.qty_per_unit = toNumber(unitSnapshot.qty_per_unit);
    }
    if (parsed.data.reorderLevel !== undefined) updateData.reorder_level = parsed.data.reorderLevel;
    if (parsed.data.reorderQuantity !== undefined) {
      updateData.reorder_quantity = parsed.data.reorderQuantity;
    }
    if (parsed.data.isActive !== undefined) updateData.is_active = parsed.data.isActive;

    const { data: policy, error } = await supabase
      .from("reorder_season_item_policies")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .select(
        `
        id,
        season_id,
        item_id,
        item_unit_option_id,
        uom_id,
        qty_per_unit,
        reorder_level,
        reorder_quantity,
        base_reorder_level,
        base_reorder_quantity,
        is_active,
        created_at,
        updated_at,
        policy_uom:units_of_measure!reorder_season_item_policies_uom_id_fkey(code, name, symbol),
        items!inner(
          item_code,
          item_name,
          uom_id,
          units_of_measure(code, name, symbol),
          item_unit_options(
            id,
            item_id,
            uom_id,
            option_label,
            qty_per_unit,
            barcode,
            is_base,
            is_default,
            is_active,
            sort_order,
            deleted_at,
            units_of_measure(id, code, name, symbol)
          )
        ),
        reorder_seasons!inner(code, name)
      `
      )
      .maybeSingle();

    if (error) {
      console.error("Error updating seasonal reorder policy:", error);
      const message =
        error.code === "23505"
          ? "A seasonal reorder policy already exists for this item and season"
          : "Failed to update seasonal reorder policy";
      return NextResponse.json({ error: message }, { status: error.code === "23505" ? 409 : 400 });
    }

    if (!policy) {
      return NextResponse.json({ error: "Seasonal reorder policy not found" }, { status: 404 });
    }

    return NextResponse.json({ data: toPolicyResponse(policy as DbReorderSeasonItemPolicy) });
  } catch (error) {
    console.error("Unexpected error updating seasonal reorder policy:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.REORDER_MANAGEMENT, "delete");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, userId } = context;

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid seasonal reorder policy id" }, { status: 400 });
    }

    const { data: policy, error } = await supabase
      .from("reorder_season_item_policies")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Error deleting seasonal reorder policy:", error);
      return NextResponse.json(
        { error: "Failed to delete seasonal reorder policy" },
        { status: 500 }
      );
    }

    if (!policy) {
      return NextResponse.json({ error: "Seasonal reorder policy not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Seasonal reorder policy deleted" });
  } catch (error) {
    console.error("Unexpected error deleting seasonal reorder policy:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
