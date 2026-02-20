import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  ensurePickListActorAuthorized,
  fetchPickList,
  fetchPickListHeader,
  getPickListAuthContext,
  type PickListStatus,
} from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdatePickListStatusBody = {
  status?: PickListStatus;
  reason?: string;
};

const ALLOWED_TRANSITIONS: Record<PickListStatus, PickListStatus[]> = {
  pending: ["in_progress", "cancelled"],
  in_progress: ["paused", "done", "cancelled"],
  paused: ["in_progress", "cancelled"],
  cancelled: [],
  done: [],
};

const DN_STATUS_BY_PICK_LIST_STATUS: Partial<Record<PickListStatus, "picking_in_progress" | "dispatch_ready" | "confirmed">> = {
  in_progress: "picking_in_progress",
  done: "dispatch_ready",
  cancelled: "confirmed",
};

const asNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

// PATCH /api/pick-lists/[id]/status
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const auth = await getPickListAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as UpdatePickListStatusBody;
    const nextStatus = body.status;

    if (!nextStatus) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    const header = await fetchPickListHeader(auth.supabase, auth.companyId, id);
    if (!header) {
      return NextResponse.json({ error: "Pick list not found" }, { status: 404 });
    }

    const permission = await ensurePickListActorAuthorized(
      auth.supabase,
      auth.companyId,
      header.business_unit_id,
      header.id,
      auth.userId
    );

    if (!permission.ok) {
      return NextResponse.json({ error: permission.error }, { status: 403 });
    }

    if (header.status === nextStatus) {
      const unchanged = await fetchPickList(auth.supabase, auth.companyId, id);
      return NextResponse.json(unchanged);
    }

    if (!ALLOWED_TRANSITIONS[header.status].includes(nextStatus)) {
      return NextResponse.json(
        { error: `Invalid transition from ${header.status} to ${nextStatus}` },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    if (nextStatus === "done") {
      const { data: pickItems, error: pickItemsError } = await auth.supabase
        .from("pick_list_items")
        .select("id, dn_item_id, allocated_qty, picked_qty")
        .eq("company_id", auth.companyId)
        .eq("pick_list_id", id);

      if (pickItemsError) {
        return NextResponse.json({ error: pickItemsError.message }, { status: 500 });
      }

      const hasPicked = (pickItems || []).some((item) => asNumber(item.picked_qty) > 0);
      if (!hasPicked) {
        return NextResponse.json(
          { error: "At least one pick list item must have picked quantity before completing" },
          { status: 400 }
        );
      }

      for (const item of pickItems || []) {
        const allocated = asNumber(item.allocated_qty);
        const picked = asNumber(item.picked_qty);
        const shortQty = Math.max(0, allocated - picked);

        const { error: dnItemUpdateError } = await auth.supabase
          .from("delivery_note_items")
          .update({
            picked_qty: picked,
            short_qty: shortQty,
            updated_at: nowIso,
          })
          .eq("id", item.dn_item_id)
          .eq("company_id", auth.companyId);

        if (dnItemUpdateError) {
          return NextResponse.json({ error: dnItemUpdateError.message }, { status: 500 });
        }
      }
    }

    const updatePayload: Record<string, string | null> = {
      status: nextStatus,
      updated_at: nowIso,
      updated_by: auth.userId,
    };

    if (nextStatus === "in_progress") {
      updatePayload.started_at = nowIso;
    }

    if (nextStatus === "done") {
      updatePayload.completed_at = nowIso;
    }

    if (nextStatus === "cancelled") {
      updatePayload.cancel_reason = body.reason?.trim() || null;
    }

    const { error: updatePickListError } = await auth.supabase
      .from("pick_lists")
      .update(updatePayload)
      .eq("id", id)
      .eq("company_id", auth.companyId);

    if (updatePickListError) {
      return NextResponse.json({ error: updatePickListError.message }, { status: 500 });
    }

    const mappedDnStatus = DN_STATUS_BY_PICK_LIST_STATUS[nextStatus];
    if (mappedDnStatus) {
      const dnUpdatePayload: Record<string, string | null> = {
        status: mappedDnStatus,
        updated_at: nowIso,
        updated_by: auth.userId,
      };

      if (nextStatus === "in_progress") {
        dnUpdatePayload.picking_started_at = nowIso;
        dnUpdatePayload.picking_started_by = auth.userId;
      }

      if (nextStatus === "done") {
        dnUpdatePayload.picking_completed_at = nowIso;
        dnUpdatePayload.picking_completed_by = auth.userId;
      }

      const { error: dnUpdateError } = await auth.supabase
        .from("delivery_notes")
        .update(dnUpdatePayload)
        .eq("id", header.dn_id)
        .eq("company_id", auth.companyId);

      if (dnUpdateError) {
        return NextResponse.json({ error: dnUpdateError.message }, { status: 500 });
      }
    }

    const updated = await fetchPickList(auth.supabase, auth.companyId, id);
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
