import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
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

const getUserCompanyId = async (supabase: Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"], userId: string) => {
  const { data: userData } = await supabase.from("users").select("company_id").eq("id", userId).single();
  return userData?.company_id || null;
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; unitOptionId: string }> }
) {
  try {
    const { id: itemId, unitOptionId } = await params;
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

    const { data: item } = await supabase
      .from("items")
      .select("id, uom_id")
      .eq("id", itemId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("item_unit_options")
      .select("id, is_base, is_default")
      .eq("id", unitOptionId)
      .eq("item_id", itemId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Item unit option not found" }, { status: 404 });
    }

    if (existing.is_base) {
      if (body.qtyPerUnit !== undefined && body.qtyPerUnit !== 1) {
        return NextResponse.json(
          { error: "Base unit option qty is fixed", details: "Base unit option must stay at qty 1" },
          { status: 400 }
        );
      }
      if (body.isActive === false) {
        return NextResponse.json(
          { error: "Base unit option cannot be deactivated" },
          { status: 400 }
        );
      }
    }

    if (body.isDefault && body.isActive === false) {
      return NextResponse.json(
        { error: "Default unit option must stay active" },
        { status: 400 }
      );
    }

    if (body.isDefault) {
      const { error: unsetDefaultError } = await supabase
        .from("item_unit_options")
        .update({ is_default: false, updated_by: user.id })
        .eq("company_id", companyId)
        .eq("item_id", itemId)
        .eq("is_default", true)
        .neq("id", unitOptionId)
        .is("deleted_at", null);

      if (unsetDefaultError) {
        return NextResponse.json(
          { error: "Failed to update default unit option", details: unsetDefaultError.message },
          { status: 500 }
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updated_by: user.id,
    };

    if (body.uomId !== undefined) updateData.uom_id = body.uomId;
    if (body.qtyPerUnit !== undefined) updateData.qty_per_unit = body.qtyPerUnit;
    if (body.optionLabel !== undefined) updateData.option_label = body.optionLabel.trim() || null;
    if (body.isDefault !== undefined) updateData.is_default = body.isDefault;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;

    const { data: updated, error: updateError } = await supabase
      .from("item_unit_options")
      .update(updateData)
      .eq("id", unitOptionId)
      .eq("item_id", itemId)
      .eq("company_id", companyId)
      .select(ITEM_UNIT_OPTION_SELECT)
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update item unit option", details: updateError.message },
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

    return NextResponse.json({
      data: transformItemUnitOptionRow(updated as DbItemUnitOptionRow, baseUom?.code || ""),
    });
  } catch (error) {
    console.error("Error updating item unit option:", error);
    return NextResponse.json({ error: "Failed to update item unit option" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; unitOptionId: string }> }
) {
  try {
    const { id: itemId, unitOptionId } = await params;
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

    const { data: existing, error: existingError } = await supabase
      .from("item_unit_options")
      .select("id, is_base, is_default")
      .eq("id", unitOptionId)
      .eq("item_id", itemId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Item unit option not found" }, { status: 404 });
    }

    if (existing.is_base) {
      return NextResponse.json({ error: "Base unit option cannot be deleted" }, { status: 400 });
    }

    if (existing.is_default) {
      return NextResponse.json(
        { error: "Default unit option cannot be deleted", details: "Set another default first" },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from("item_unit_options")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", unitOptionId)
      .eq("item_id", itemId)
      .eq("company_id", companyId);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete item unit option", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting item unit option:", error);
    return NextResponse.json({ error: "Failed to delete item unit option" }, { status: 500 });
  }
}
