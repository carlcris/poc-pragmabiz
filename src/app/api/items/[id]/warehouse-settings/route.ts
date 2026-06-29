import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_REGEX.test(value);

const normalizeMaxQuantity = (value: unknown): number | null | undefined => {
  if (value === null || value === "") return null;
  if (value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

// PATCH /api/items/[id]/warehouse-settings - Update warehouse-scoped item thresholds.
async function PATCHHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "edit");
    if (unauthorized) return unauthorized;

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    }

    const body = (await request.json()) as { warehouseId?: unknown; maxQuantity?: unknown };
    if (!isUuid(body.warehouseId)) {
      return NextResponse.json({ error: "warehouseId is required" }, { status: 400 });
    }

    const maxQuantity = normalizeMaxQuantity(body.maxQuantity);
    if (maxQuantity === undefined || (maxQuantity !== null && maxQuantity < 0)) {
      return NextResponse.json({ error: "Max stock level must be 0 or greater" }, { status: 400 });
    }

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
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

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    const { data: item, error: itemError } = await supabase
      .from("items")
      .select("id")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (itemError) {
      console.error("Failed to check item before warehouse settings update", itemError);
      return NextResponse.json({ error: "Failed to update warehouse settings" }, { status: 500 });
    }

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    let warehouseQuery = supabase
      .from("warehouses")
      .select("id")
      .eq("id", body.warehouseId)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null);

    if (currentBusinessUnitId) {
      warehouseQuery = warehouseQuery.eq("business_unit_id", currentBusinessUnitId);
    }

    const { data: warehouse, error: warehouseError } = await warehouseQuery.maybeSingle();

    if (warehouseError) {
      console.error(
        "Failed to check warehouse before item warehouse settings update",
        warehouseError
      );
      return NextResponse.json({ error: "Failed to update warehouse settings" }, { status: 500 });
    }

    if (!warehouse) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }

    const { data: itemWarehouse, error: itemWarehouseError } = await supabase
      .from("item_warehouse")
      .select("id")
      .eq("company_id", userData.company_id)
      .eq("item_id", id)
      .eq("warehouse_id", body.warehouseId)
      .is("deleted_at", null)
      .maybeSingle();

    if (itemWarehouseError) {
      console.error("Failed to check item warehouse settings", itemWarehouseError);
      return NextResponse.json({ error: "Failed to update warehouse settings" }, { status: 500 });
    }

    if (itemWarehouse) {
      const { error: updateError } = await supabase
        .from("item_warehouse")
        .update({
          max_quantity: maxQuantity,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemWarehouse.id);

      if (updateError) {
        console.error("Failed to update item warehouse max quantity", updateError);
        return NextResponse.json({ error: "Failed to update warehouse settings" }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabase.from("item_warehouse").insert({
        company_id: userData.company_id,
        item_id: id,
        warehouse_id: body.warehouseId,
        max_quantity: maxQuantity,
        current_stock: 0,
        created_by: user.id,
        updated_by: user.id,
      });

      if (insertError) {
        console.error("Failed to create item warehouse max quantity", insertError);
        return NextResponse.json({ error: "Failed to update warehouse settings" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected item warehouse settings update error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const PATCH = withActivityLogging(PATCHHandler, {
  action: "update",
  resourceType: "items",
  route: "/api/items/[id]/warehouse-settings",
});
