import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { reorderSeasonItemPolicySchema } from "@/lib/validations/reorder";
import {
  sortItemUnitOptions,
  transformItemUnitOptionRow,
  type DbItemUnitOptionRow,
} from "@/lib/items/itemUnitOptions";
import type { ItemUnitOption } from "@/types/item";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 1000;

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

type UnitOptionSnapshot = {
  id: string;
  uom_id: string;
  qty_per_unit: number | string;
};

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const unwrapRelation = <T>(value: T | T[] | null): T | null =>
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

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.REORDER_MANAGEMENT, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId } = context;

    const searchParams = request.nextUrl.searchParams;
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
    const seasonId = searchParams.get("seasonId")?.trim();
    const itemId = searchParams.get("itemId")?.trim();
    const search = searchParams.get("search")?.trim();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("reorder_season_item_policies")
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
      `,
        { count: "exact" }
      )
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .is("items.deleted_at", null)
      .is("reorder_seasons.deleted_at", null);

    if (seasonId) query = query.eq("season_id", seasonId);
    if (itemId) query = query.eq("item_id", itemId);
    if (search) {
      query = query.or(`item_code.ilike.%${search}%,item_name.ilike.%${search}%`, {
        referencedTable: "items",
      });
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Error fetching seasonal reorder policies:", error);
      return NextResponse.json(
        { error: "Failed to fetch seasonal reorder policies" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: ((data || []) as DbReorderSeasonItemPolicy[]).map(toPolicyResponse),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: count ? Math.ceil(count / limit) : 0,
      },
    });
  } catch (error) {
    console.error("Unexpected error fetching seasonal reorder policies:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POSTHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.REORDER_MANAGEMENT, "create");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, userId } = context;

    const parsed = reorderSeasonItemPolicySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid seasonal reorder policy" },
        { status: 400 }
      );
    }

    if (!parsed.data.itemUnitOptionId) {
      return NextResponse.json({ error: "Unit is required" }, { status: 400 });
    }

    const { data: unitOptionData, error: unitOptionError } = await supabase
      .from("item_unit_options")
      .select("id, uom_id, qty_per_unit")
      .eq("id", parsed.data.itemUnitOptionId)
      .eq("company_id", companyId)
      .eq("item_id", parsed.data.itemId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (unitOptionError) {
      console.error("Error resolving seasonal reorder policy unit option:", unitOptionError);
      return NextResponse.json(
        { error: "Failed to create seasonal reorder policy" },
        { status: 500 }
      );
    }

    if (!unitOptionData) {
      return NextResponse.json(
        { error: "Selected unit is not available for this item" },
        { status: 400 }
      );
    }

    const unitOption = unitOptionData as UnitOptionSnapshot;

    const { data: policy, error } = await supabase
      .from("reorder_season_item_policies")
      .insert({
        company_id: companyId,
        season_id: parsed.data.seasonId,
        item_id: parsed.data.itemId,
        item_unit_option_id: unitOption.id,
        uom_id: unitOption.uom_id,
        qty_per_unit: toNumber(unitOption.qty_per_unit),
        reorder_level: parsed.data.reorderLevel,
        reorder_quantity: parsed.data.reorderQuantity,
        is_active: parsed.data.isActive,
        created_by: userId,
        updated_by: userId,
      })
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
      .single();

    if (error) {
      console.error("Error creating seasonal reorder policy:", error);
      const message =
        error.code === "23505"
          ? "A seasonal reorder policy already exists for this item and season"
          : "Failed to create seasonal reorder policy";
      return NextResponse.json({ error: message }, { status: error.code === "23505" ? 409 : 400 });
    }

    return NextResponse.json(
      { data: toPolicyResponse(policy as DbReorderSeasonItemPolicy) },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error creating seasonal reorder policy:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "reorder",
  route: "/api/reorder/season-policies",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "reorder",
  route: "/api/reorder/season-policies",
});
