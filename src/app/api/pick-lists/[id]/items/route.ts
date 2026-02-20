import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  ensurePickListActorAuthorized,
  fetchPickList,
  fetchPickListHeader,
  getPickListAuthContext,
} from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdatePickListItemsBody = {
  items?: Array<{
    pickListItemId: string;
    pickedQty: number;
  }>;
};

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

// PATCH /api/pick-lists/[id]/items
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const auth = await getPickListAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as UpdatePickListItemsBody;

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "items is required" }, { status: 400 });
    }

    const header = await fetchPickListHeader(auth.supabase, auth.companyId, id);
    if (!header) {
      return NextResponse.json({ error: "Pick list not found" }, { status: 404 });
    }

    if (["cancelled", "done"].includes(header.status)) {
      return NextResponse.json(
        { error: `Cannot update items for pick list in ${header.status} status` },
        { status: 400 }
      );
    }

    const permission = await ensurePickListActorAuthorized(
      auth.supabase,
      auth.companyId,
      header.business_unit_id,
      id,
      auth.userId
    );

    if (!permission.ok) {
      return NextResponse.json({ error: permission.error }, { status: 403 });
    }

    const { data: currentItems, error: fetchItemsError } = await auth.supabase
      .from("pick_list_items")
      .select("id, allocated_qty")
      .eq("company_id", auth.companyId)
      .eq("pick_list_id", id);

    if (fetchItemsError) {
      return NextResponse.json({ error: fetchItemsError.message }, { status: 500 });
    }

    const byId = new Map((currentItems || []).map((item) => [item.id, item]));

    for (const item of body.items) {
      const existing = byId.get(item.pickListItemId);
      if (!existing) {
        return NextResponse.json(
          { error: `Invalid pick list item ${item.pickListItemId}` },
          { status: 400 }
        );
      }

      const allocatedQty = toNumber(existing.allocated_qty);
      const pickedQty = toNumber(item.pickedQty);
      if (pickedQty < 0 || pickedQty > allocatedQty) {
        return NextResponse.json(
          { error: `Picked quantity must be between 0 and ${allocatedQty}` },
          { status: 400 }
        );
      }
    }

    const nowIso = new Date().toISOString();

    for (const item of body.items) {
      const existing = byId.get(item.pickListItemId);
      if (!existing) continue;

      const allocatedQty = toNumber(existing.allocated_qty);
      const pickedQty = toNumber(item.pickedQty);
      const shortQty = Math.max(0, allocatedQty - pickedQty);

      const { error: updateItemError } = await auth.supabase
        .from("pick_list_items")
        .update({
          picked_qty: pickedQty,
          short_qty: shortQty,
          updated_at: nowIso,
        })
        .eq("id", item.pickListItemId)
        .eq("company_id", auth.companyId)
        .eq("pick_list_id", id);

      if (updateItemError) {
        return NextResponse.json({ error: updateItemError.message }, { status: 500 });
      }
    }

    const pickList = await fetchPickList(auth.supabase, auth.companyId, id);
    return NextResponse.json(pickList);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
