import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import {
  sortItemUnitOptions,
  transformItemUnitOptionRow,
  type DbItemUnitOptionRow,
} from "@/lib/items/itemUnitOptions";

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

const getUserCompanyId = async (supabase: Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"], userId: string) => {
  const { data: userData } = await supabase.from("users").select("company_id").eq("id", userId).single();
  return userData?.company_id || null;
};

const getItem = async (
  supabase: Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"],
  itemId: string,
  companyId: string
) =>
  supabase
    .from("items")
    .select("id, company_id, uom_id")
    .eq("id", itemId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle();

const listUnitOptions = async (
  supabase: Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"],
  itemId: string,
  companyId: string,
  baseUomCode: string
) => {
  const { data, error } = await supabase
    .from("item_unit_options")
    .select(ITEM_UNIT_OPTION_SELECT)
    .eq("company_id", companyId)
    .eq("item_id", itemId)
    .is("deleted_at", null);

  if (error) throw error;

  return sortItemUnitOptions(
    ((data || []) as DbItemUnitOptionRow[]).map((row) => transformItemUnitOptionRow(row, baseUomCode))
  );
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: itemId } = await params;
    const { supabase } = await createServerClientWithBU();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = await getUserCompanyId(supabase, user.id);
    if (!companyId) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    const { data: item, error: itemError } = await getItem(supabase, itemId, companyId);
    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const { data: baseUom } = await supabase
      .from("units_of_measure")
      .select("code")
      .eq("id", item.uom_id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle();

    const unitOptions = await listUnitOptions(supabase, itemId, companyId, baseUom?.code || "");
    return NextResponse.json({ data: unitOptions, total: unitOptions.length });
  } catch (error) {
    console.error("Error fetching item unit options:", error);
    return NextResponse.json({ error: "Failed to fetch item unit options" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: itemId } = await params;
    const body = (await request.json()) as {
      uomId?: string;
      qtyPerUnit?: number;
      optionLabel?: string;
      isDefault?: boolean;
      isActive?: boolean;
    };
    const { supabase } = await createServerClientWithBU();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = await getUserCompanyId(supabase, user.id);
    if (!companyId) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    if (!body.uomId || !body.qtyPerUnit || body.qtyPerUnit <= 0) {
      return NextResponse.json(
        { error: "Invalid payload", details: "uomId and positive qtyPerUnit are required" },
        { status: 400 }
      );
    }

    if (body.isDefault && body.isActive === false) {
      return NextResponse.json(
        { error: "Default unit option must stay active" },
        { status: 400 }
      );
    }

    const { data: item, error: itemError } = await getItem(supabase, itemId, companyId);
    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (body.isDefault) {
      const { error: unsetDefaultError } = await supabase
        .from("item_unit_options")
        .update({ is_default: false, updated_by: user.id })
        .eq("company_id", companyId)
        .eq("item_id", itemId)
        .eq("is_default", true)
        .is("deleted_at", null);

      if (unsetDefaultError) {
        return NextResponse.json(
          { error: "Failed to update default unit option", details: unsetDefaultError.message },
          { status: 500 }
        );
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from("item_unit_options")
      .insert({
        company_id: companyId,
        item_id: itemId,
        uom_id: body.uomId,
        option_label: body.optionLabel?.trim() || null,
        qty_per_unit: body.qtyPerUnit,
        is_base: false,
        is_default: body.isDefault ?? false,
        is_active: body.isActive ?? true,
        sort_order: 0,
        created_by: user.id,
        updated_by: user.id,
      })
      .select(ITEM_UNIT_OPTION_SELECT)
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create item unit option", details: insertError.message },
        { status: 500 }
      );
    }

    const { data: baseUom } = await supabase
      .from("units_of_measure")
      .select("code")
      .eq("id", item.uom_id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle();

    return NextResponse.json(
      { data: transformItemUnitOptionRow(inserted as DbItemUnitOptionRow, baseUom?.code || "") },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating item unit option:", error);
    return NextResponse.json({ error: "Failed to create item unit option" }, { status: 500 });
  }
}
