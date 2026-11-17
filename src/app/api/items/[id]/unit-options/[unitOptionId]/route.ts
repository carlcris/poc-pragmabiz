import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RESOURCES } from "@/constants/resources";
import { checkPermissionForUser } from "@/lib/auth/checkPermission";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { transformItemUnitOptionRow } from "@/lib/items/itemUnitOptions";
import type { Database } from "@/types/database.types";

const unitOptionParams = z.object({ id: z.guid(), unitOptionId: z.guid() });
const unitOptionUpdate = z.strictObject({
  uomId: z.guid().optional(),
  qtyPerUnit: z.number().optional(),
  optionLabel: z.string().trim().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

type ItemUnitOptionWriteError = {
  code?: string;
  details?: string | null;
  message?: string;
};

const ITEM_UNIT_OPTION_DUPLICATE_CONSTRAINT = "ux_item_unit_options_item_uom_qty";
const DUPLICATE_UNIT_OPTION_ERROR = "A unit option with this unit and quantity already exists";
const UPDATE_ITEM_UNIT_OPTION_ERROR = "Failed to update item unit option";

const isDuplicateUnitOptionError = (error: ItemUnitOptionWriteError | null): boolean =>
  error?.code === "23505" &&
  `${error.message ?? ""} ${error.details ?? ""}`.includes(ITEM_UNIT_OPTION_DUPLICATE_CONSTRAINT);

const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });

const updateFailure = (status: number, error: string, details?: string) =>
  NextResponse.json({ error, details }, { status });

const mapUpdateError = (error: ItemUnitOptionWriteError) => {
  if (error.code === "42501") return forbidden();
  if (isDuplicateUnitOptionError(error)) {
    return updateFailure(409, DUPLICATE_UNIT_OPTION_ERROR);
  }
  if (error.code === "P0002") {
    if (error.message === "ITEM_UNIT_OPTION_ITEM_NOT_FOUND") {
      return updateFailure(404, "Item not found");
    }
    if (error.message === "ITEM_UNIT_OPTION_NOT_FOUND") {
      return updateFailure(404, "Item unit option not found");
    }
  }
  if (error.code === "22023") {
    switch (error.message) {
      case "ITEM_UNIT_OPTION_BASE_QTY_FIXED":
        return updateFailure(
          400,
          "Base unit option qty is fixed",
          "Base unit option must stay at qty 1"
        );
      case "ITEM_UNIT_OPTION_BASE_INACTIVE":
        return updateFailure(400, "Base unit option cannot be deactivated");
      case "ITEM_UNIT_OPTION_DEFAULT_INACTIVE":
        return updateFailure(400, "Default unit option must stay active");
      case "ITEM_UNIT_OPTION_INVALID_UOM":
      case "ITEM_UNIT_OPTION_INVALID_QTY":
      case "ITEM_UNIT_OPTION_LABEL_TOO_LONG":
        return updateFailure(400, UPDATE_ITEM_UNIT_OPTION_ERROR);
    }
  }
  return null;
};

const requireItemUnitOptionEditContext = async () => {
  const context = await requireRequestContext();
  if ("status" in context) return context;
  const canEdit = await checkPermissionForUser(
    {
      id: context.userId,
      companyId: context.companyId,
      businessUnitId: context.currentBusinessUnitId,
    },
    RESOURCES.ITEMS,
    "edit"
  );
  return canEdit ? context : forbidden();
};

async function PUTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; unitOptionId: string }> }
) {
  try {
    const context = await requireItemUnitOptionEditContext();
    if ("status" in context) return context;
    const { companyId, currentBusinessUnitId } = context;
    const supabase: SupabaseClient<Database> = context.supabase;
    if (!currentBusinessUnitId) return forbidden();

    const target = unitOptionParams.safeParse(await params);
    const patch = unitOptionUpdate.safeParse(await request.json().catch(() => null));
    if (!target.success || !patch.success) {
      return updateFailure(400, "Invalid payload");
    }

    const { data: updated, error: updateError } = await supabase
      .rpc("update_item_unit_option", {
        p_company_id: companyId,
        p_item_id: target.data.id,
        p_unit_option_id: target.data.unitOptionId,
        p_business_unit_id: currentBusinessUnitId,
        p_uom_id: patch.data.uomId,
        p_qty_per_unit: patch.data.qtyPerUnit,
        p_option_label: patch.data.optionLabel,
        p_is_default: patch.data.isDefault,
        p_is_active: patch.data.isActive,
      })
      .single();

    if (updateError) {
      const response = mapUpdateError(updateError);
      if (response) return response;
      throw updateError;
    }

    return NextResponse.json({
      data: transformItemUnitOptionRow(
        {
          ...updated,
          units_of_measure: {
            id: updated.uom_id,
            code: updated.uom_code,
            name: updated.uom_name,
            symbol: updated.uom_symbol,
          },
        },
        updated.base_uom_code ?? ""
      ),
    });
  } catch (error) {
    console.error("Error updating item unit option:", error);
    return updateFailure(500, UPDATE_ITEM_UNIT_OPTION_ERROR);
  }
}

async function DELETEHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; unitOptionId: string }> }
) {
  try {
    const context = await requireItemUnitOptionEditContext();
    if ("status" in context) return context;
    const { supabase, companyId, userId } = context;
    const { id: itemId, unitOptionId } = await params;

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
        updated_by: userId,
      })
      .eq("id", unitOptionId)
      .eq("item_id", itemId)
      .eq("company_id", companyId);

    if (deleteError) {
      if (deleteError.code === "42501") return forbidden();
      console.error("Error deleting item unit option:", deleteError);
      return NextResponse.json({ error: "Failed to delete item unit option" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting item unit option:", error);
    return NextResponse.json({ error: "Failed to delete item unit option" }, { status: 500 });
  }
}

export const PUT = withActivityLogging(PUTHandler, {
  action: "update",
  resourceType: "items",
  route: "/api/items/[id]/unit-options/[unitOptionId]",
});
export const DELETE = withActivityLogging(DELETEHandler, {
  action: "delete",
  resourceType: "items",
  route: "/api/items/[id]/unit-options/[unitOptionId]",
});
