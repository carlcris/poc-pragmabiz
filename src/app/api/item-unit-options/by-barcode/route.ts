import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { transformItemUnitOptionRow, type DbItemUnitOptionRow } from "@/lib/items/itemUnitOptions";

const ITEM_UNIT_OPTION_SELECT = `
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
  units_of_measure (
    id,
    code,
    name,
    symbol
  )
`;

export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "view");
    if (unauthorized) return unauthorized;

    const barcode = request.nextUrl.searchParams.get("barcode")?.trim() || "";
    if (!barcode) {
      return NextResponse.json({ error: "barcode is required" }, { status: 400 });
    }

    const { supabase } = await createServerClientWithBU();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    const companyId = userData?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    const { data: unitOption, error: unitOptionError } = await supabase
      .from("item_unit_options")
      .select(
        `
        ${ITEM_UNIT_OPTION_SELECT},
        items!inner (
          id,
          item_code,
          item_name,
          item_name_cn,
          uom_id,
          is_active
        )
      `
      )
      .eq("company_id", companyId)
      .eq("barcode", barcode)
      .is("deleted_at", null)
      .maybeSingle();

    if (unitOptionError) {
      return NextResponse.json({ error: unitOptionError.message }, { status: 500 });
    }

    if (!unitOption) {
      return NextResponse.json({ error: "Barcode not found" }, { status: 404 });
    }

    const item = Array.isArray(unitOption.items) ? unitOption.items[0] : unitOption.items;
    if (!item) {
      return NextResponse.json({ error: "Barcode has no item mapping" }, { status: 404 });
    }

    const { data: baseUom } = await supabase
      .from("units_of_measure")
      .select("code")
      .eq("id", item.uom_id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle();

    return NextResponse.json({
      data: {
        unitOption: transformItemUnitOptionRow(unitOption as DbItemUnitOptionRow, baseUom?.code || ""),
        item: {
          id: item.id,
          code: item.item_code,
          name: item.item_name,
          chineseName: item.item_name_cn,
          baseUomCode: baseUom?.code || null,
          isActive: item.is_active ?? true,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
