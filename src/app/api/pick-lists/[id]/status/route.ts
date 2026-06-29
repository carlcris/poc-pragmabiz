import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  ensurePickListActorAuthorized,
  fetchPickList,
  fetchPickListHeader,
  getPickListAuthContext,
  notifyPickListReadyForDispatch,
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

const DN_STATUS_BY_PICK_LIST_STATUS: Partial<
  Record<PickListStatus, "picking_in_progress" | "confirmed">
> = {
  in_progress: "picking_in_progress",
};

const asNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const apiError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

const internalError = (message: string, error: unknown) => {
  console.error(message, error);
  return apiError(message, 500);
};

// PATCH /api/pick-lists/[id]/status
async function PATCHHandler(request: NextRequest, context: RouteContext) {
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
      const { error: completeError } = await auth.supabase.rpc("complete_pick_list_transaction", {
        p_company_id: auth.companyId,
        p_user_id: auth.userId,
        p_pick_list_id: id,
        p_pick_rows: [],
      });

      if (completeError) {
        console.error("Transactional pick list status completion failed", completeError);
        return apiError("Unable to complete pick list", 400);
      }

      try {
        await notifyPickListReadyForDispatch(auth.supabase, auth.companyId, auth.userId, header);
      } catch (notificationError) {
        console.error("Error creating dispatch-ready notifications:", notificationError);
      }

      const updated = await fetchPickList(auth.supabase, auth.companyId, id);
      return NextResponse.json(updated);
    }

    if (nextStatus === "cancelled") {
      const { error: cancelResetError } = await auth.supabase.rpc(
        "cancel_pick_list_reset_progress",
        {
          p_company_id: auth.companyId,
          p_user_id: auth.userId,
          p_pick_list_id: id,
        }
      );

      if (cancelResetError) {
        console.error("Unable to cancel pick list and reset progress", cancelResetError);
        return apiError("Unable to cancel pick list and reset progress", 400);
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

    if (nextStatus === "cancelled") {
      updatePayload.cancel_reason = body.reason?.trim() || null;
    }

    const { error: updatePickListError } = await auth.supabase
      .from("pick_lists")
      .update(updatePayload)
      .eq("id", id)
      .eq("company_id", auth.companyId);

    if (updatePickListError) {
      return internalError("Unable to update pick list status", updatePickListError);
    }

    let mappedDnStatus = DN_STATUS_BY_PICK_LIST_STATUS[nextStatus];
    if (nextStatus === "cancelled") {
      const { data: dnLineSummary, error: dnLineSummaryError } = await auth.supabase
        .from("delivery_note_items")
        .select("dispatched_qty")
        .eq("company_id", auth.companyId)
        .eq("dn_id", header.dn_id);

      if (dnLineSummaryError) {
        return internalError(
          "Unable to inspect delivery note dispatch history",
          dnLineSummaryError
        );
      }

      const hasHistoricalDispatch = (dnLineSummary || []).some(
        (row) => asNumber(row.dispatched_qty) > 0
      );
      mappedDnStatus = hasHistoricalDispatch ? undefined : "confirmed";

      if (!mappedDnStatus && (dnLineSummary || []).length > 0) {
        const { error: fallbackDnStatusError } = await auth.supabase
          .from("delivery_notes")
          .update({
            status: "dispatched",
            updated_at: nowIso,
            updated_by: auth.userId,
          })
          .eq("id", header.dn_id)
          .eq("company_id", auth.companyId);

        if (fallbackDnStatusError) {
          return internalError("Unable to update delivery note status", fallbackDnStatusError);
        }
      }
    }

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

      const { error: dnUpdateError } = await auth.supabase
        .from("delivery_notes")
        .update(dnUpdatePayload)
        .eq("id", header.dn_id)
        .eq("company_id", auth.companyId);

      if (dnUpdateError) {
        return internalError("Unable to update delivery note status", dnUpdateError);
      }
    }

    const updated = await fetchPickList(auth.supabase, auth.companyId, id);
    return NextResponse.json(updated);
  } catch (error) {
    return internalError("Unable to update pick list status", error);
  }
}

export const PATCH = withActivityLogging(PATCHHandler, {
  action: "change_status",
  resourceType: "pick_lists",
  route: "/api/pick-lists/[id]/status",
});
