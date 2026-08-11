import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
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

type RecordPickBody = {
  pickListItemId?: unknown;
  operationId?: unknown;
  pickedQty?: unknown;
  batchLocationSku?: unknown;
  isMismatchWarningAcknowledged?: unknown;
  mismatchReason?: unknown;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const safeError = (message: string, status: number, code?: string) =>
  NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status });

const textOrNull = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
};

const BUSINESS_ERRORS: Record<string, { message: string; status: number }> = {
  PICK_PROGRESS_NOT_ACTIVE: { message: "Start picking before confirming an item", status: 409 },
  PICK_PROGRESS_LINE_NOT_FOUND: { message: "Pick list item not found", status: 404 },
  PICK_PROGRESS_INVALID_QUANTITY: { message: "Picked quantity is invalid", status: 400 },
  PICK_PROGRESS_OPERATION_CONFLICT: {
    message: "Pick confirmation could not be retried safely",
    status: 409,
  },
  PICK_PROGRESS_CLAIM_REQUIRED: {
    message: "This item is no longer reserved for you",
    status: 409,
  },
  PICK_PROGRESS_SOURCE_REQUIRED: {
    message: "Enter or scan a batch-location SKU",
    status: 400,
  },
  PICK_PROGRESS_SOURCE_NOT_FOUND: { message: "Batch-location SKU not found", status: 404 },
  PICK_PROGRESS_SOURCE_UNAVAILABLE: {
    message: "The scanned source is inactive or unavailable for picking",
    status: 409,
  },
  PICK_PROGRESS_SOURCE_OUTSIDE_BUSINESS_UNIT: {
    message: "The scanned source is outside the fulfilling business unit",
    status: 400,
  },
  PICK_PROGRESS_BATCH_IDENTITY_MISMATCH: {
    message: "The scanned source belongs to a different allocated batch",
    status: 400,
  },
  PICK_PROGRESS_WAREHOUSE_POLICY_MISMATCH: {
    message: "The scanned source is not in the assigned warehouse",
    status: 400,
  },
  PICK_PROGRESS_RACK_POLICY_MISMATCH: {
    message: "The scanned source is not in the assigned rack",
    status: 400,
  },
  PICK_PROGRESS_INSUFFICIENT_QUANTITY: {
    message: "The selected source does not have enough stock",
    status: 409,
  },
  PICK_PROGRESS_RESERVATION_CONFLICT: {
    message: "The original stock reservation changed. Refresh and scan again",
    status: 409,
  },
  PICK_PROGRESS_ALTERNATIVE_SOURCE_UNAVAILABLE: {
    message: "The alternative warehouse no longer has unreserved stock",
    status: 409,
  },
  PICK_PROGRESS_SUGGESTED_SOURCE_REQUIRED: {
    message: "This pick line has no allocated source. Recreate the pick list",
    status: 409,
  },
  PICK_PROGRESS_MISMATCH_ACKNOWLEDGEMENT_REQUIRED:
    { message: "Confirm the alternative source before saving", status: 409 },
};

async function POSTHandler(request: NextRequest, context: RouteContext) {
  const unauthorized = await requirePermission(RESOURCES.PICK_LISTS, "edit");
  if (unauthorized) return unauthorized;

  const auth = await getPickListAuthContext();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as RecordPickBody | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return safeError("Invalid pick confirmation", 400);
  }

  const pickListItemId = typeof body.pickListItemId === "string" ? body.pickListItemId.trim() : "";
  const operationId = typeof body.operationId === "string" ? body.operationId.trim() : "";
  const pickedQty = typeof body.pickedQty === "number" ? body.pickedQty : Number.NaN;
  const batchLocationSku = textOrNull(body.batchLocationSku, 10);
  const mismatchReason = textOrNull(body.mismatchReason, 500);

  if (
    !UUID_PATTERN.test(id) ||
    !UUID_PATTERN.test(pickListItemId) ||
    !UUID_PATTERN.test(operationId) ||
    !Number.isFinite(pickedQty) ||
    pickedQty <= 0 ||
    !batchLocationSku
  ) {
    return safeError("Invalid pick confirmation", 400);
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

  const { error } = await auth.supabase.rpc("record_pick_list_item_progress", {
    p_company_id: auth.companyId,
    p_user_id: auth.userId,
    p_pick_list_id: id,
    p_pick_list_item_id: pickListItemId,
    p_operation_id: operationId,
    p_picked_qty: pickedQty,
    p_batch_location_sku: batchLocationSku,
    p_picked_location_id: null,
    p_picked_batch_code: null,
    p_picked_batch_received_at: null,
    p_mismatch_acknowledged: body.isMismatchWarningAcknowledged === true,
    p_mismatch_reason: mismatchReason,
  });

  if (error) {
    console.error("Transactional pick progress save failed", error);
    if (error.message.includes("PICK_PROGRESS_UNAUTHORIZED")) {
      return safeError("Unauthorized", 403);
    }
    if (error.message.includes("PICK_PROGRESS_NOT_FOUND")) {
      return safeError("Pick list not found", 404);
    }
    const businessError = Object.entries(BUSINESS_ERRORS).find(([code]) =>
      error.message.includes(code)
    );
    if (businessError) {
      return safeError(businessError[1].message, businessError[1].status, businessError[0]);
    }
    return safeError("Unable to save pick progress", 500);
  }

  const updated = await fetchPickList(auth.supabase, auth.companyId, id);
  if (!updated) return safeError("Unable to load saved pick progress", 500);

  return NextResponse.json(updated);
}

export const POST = withActivityLogging(POSTHandler, {
  action: "update",
  resourceType: "pick_lists",
  route: "/api/pick-lists/[id]/record-pick",
});
