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
} from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CompletePickListBody = {
  pickRows?: unknown[];
};

const safeError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

// POST /api/pick-lists/[id]/complete
async function POSTHandler(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const auth = await getPickListAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as CompletePickListBody;
    if (Array.isArray(body.pickRows) && body.pickRows.length > 0) {
      return safeError("Confirm picks before completing the pick list", 400);
    }

    const header = await fetchPickListHeader(auth.supabase, auth.companyId, id);
    if (!header) {
      return safeError("Pick list not found", 404);
    }

    const permission = await ensurePickListActorAuthorized(
      auth.supabase,
      auth.companyId,
      header.business_unit_id,
      header.id,
      auth.userId
    );

    if (!permission.ok) {
      return safeError(permission.error, 403);
    }

    const { error } = await auth.supabase.rpc("complete_pick_list_transaction", {
      p_company_id: auth.companyId,
      p_user_id: auth.userId,
      p_pick_list_id: id,
      p_pick_rows: [],
    });

    if (error) {
      console.error("Transactional pick list completion failed", error);
      if (error.message.includes("PICK_LIST_ACTIVE_CLAIMS")) {
        return safeError("Another picker is still working on this pick list", 409);
      }
      return safeError("Unable to complete pick list", 400);
    }

    try {
      await notifyPickListReadyForDispatch(auth.supabase, auth.companyId, auth.userId, header);
    } catch (notificationError) {
      console.error("Error creating dispatch-ready notifications:", notificationError);
    }

    const updated = await fetchPickList(auth.supabase, auth.companyId, id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Unexpected pick list completion error", error);
    return safeError("Unable to complete pick list", 500);
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "complete",
  resourceType: "pick_lists",
  route: "/api/pick-lists/[id]/complete",
});
