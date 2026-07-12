import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  ensurePickListActorAuthorized,
  fetchPickListHeader,
  getPickListAuthContext,
} from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ClaimBody = {
  pickListItemId?: unknown;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const safeError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

const getContext = async (request: NextRequest, context: RouteContext) => {
  const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
  if (unauthorized) return unauthorized;

  const auth = await getPickListAuthContext();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as ClaimBody | null;
  const pickListItemId =
    body && typeof body.pickListItemId === "string" ? body.pickListItemId.trim() : "";
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(pickListItemId)) {
    return safeError("Invalid pick-list item", 400);
  }

  const header = await fetchPickListHeader(auth.supabase, auth.companyId, id);
  if (!header) return safeError("Pick list not found", 404);

  const permission = await ensurePickListActorAuthorized(
    auth.supabase,
    auth.companyId,
    header.business_unit_id,
    header.id,
    auth.userId
  );
  if (!permission.ok) return safeError(permission.error, 403);

  return { auth, id, pickListItemId };
};

async function POSTHandler(request: NextRequest, context: RouteContext) {
  const resolved = await getContext(request, context);
  if (resolved instanceof NextResponse) return resolved;

  const { data, error } = await resolved.auth.supabase.rpc("claim_pick_list_item", {
    p_company_id: resolved.auth.companyId,
    p_user_id: resolved.auth.userId,
    p_pick_list_id: resolved.id,
    p_pick_list_item_id: resolved.pickListItemId,
  });

  if (error) {
    console.error("Pick-list item claim failed", error);
    if (error.message.includes("PICK_CLAIM_HELD_BY_OTHER")) {
      return safeError("This item is being picked by another user", 409);
    }
    if (error.message.includes("PICK_CLAIM_LINE_NOT_AVAILABLE")) {
      return safeError("This item is already picked", 409);
    }
    if (error.message.includes("PICK_CLAIM_NOT_ACTIVE")) {
      return safeError("Start picking before selecting an item", 409);
    }
    if (error.message.includes("PICK_CLAIM_UNAUTHORIZED")) {
      return safeError("Unauthorized", 403);
    }
    return safeError("Unable to reserve this item", 500);
  }

  return NextResponse.json({ expiresAt: data });
}

async function DELETEHandler(request: NextRequest, context: RouteContext) {
  const resolved = await getContext(request, context);
  if (resolved instanceof NextResponse) return resolved;

  const { error } = await resolved.auth.supabase.rpc("release_pick_list_item_claim", {
    p_company_id: resolved.auth.companyId,
    p_user_id: resolved.auth.userId,
    p_pick_list_id: resolved.id,
    p_pick_list_item_id: resolved.pickListItemId,
  });

  if (error) {
    console.error("Pick-list item claim release failed", error);
    return safeError("Unable to release this item", 500);
  }

  return new NextResponse(null, { status: 204 });
}

export const POST = withActivityLogging(POSTHandler, {
  action: "update",
  resourceType: "pick_lists",
  route: "/api/pick-lists/[id]/claim",
});

export const DELETE = withActivityLogging(DELETEHandler, {
  action: "update",
  resourceType: "pick_lists",
  route: "/api/pick-lists/[id]/claim",
});
