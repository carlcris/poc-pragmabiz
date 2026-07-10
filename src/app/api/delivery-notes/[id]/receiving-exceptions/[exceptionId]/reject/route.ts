import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requireDeliveryNoteReceivingAccess } from "@/lib/delivery-notes/permissions";
import {
  fetchDeliveryNote,
  fetchDeliveryNoteHeader,
  getAuthContext,
  isReceivingBusinessUnit,
} from "../../../../_lib";

type RouteContext = {
  params: Promise<{ id: string; exceptionId: string }>;
};

type ReviewReceivingExceptionBody = {
  notes?: string | null;
};

type RpcResult = {
  error: { message?: string } | null;
};

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
};

const asRpcClient = (client: unknown): RpcClient => client as RpcClient;

const userSafeReviewMessage = (message: string | undefined) => {
  const allowedMessages = new Set([
    "Delivery note not found",
    "Receiving exception not found",
    "Only pending receiving exceptions can be reviewed",
  ]);

  return message && allowedMessages.has(message) ? message : "Failed to reject receiving exception";
};

// POST /api/delivery-notes/[id]/receiving-exceptions/[exceptionId]/reject
async function POSTHandler(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requireDeliveryNoteReceivingAccess("edit");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id, exceptionId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as ReviewReceivingExceptionBody;

    const header = await fetchDeliveryNoteHeader(auth.supabase, auth.companyId, id);
    if (!header) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    if (!auth.currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const canReceive = await isReceivingBusinessUnit(
      auth.supabase,
      auth.companyId,
      auth.currentBusinessUnitId,
      header.requesting_warehouse_id
    );
    if (!canReceive) {
      return NextResponse.json(
        { error: "Only the receiving business unit can review receiving exceptions" },
        { status: 403 }
      );
    }

    const { error } = await asRpcClient(auth.supabase).rpc(
      "reject_delivery_note_receiving_exception",
      {
        p_company_id: auth.companyId,
        p_business_unit_id: auth.currentBusinessUnitId,
        p_user_id: auth.userId,
        p_dn_id: id,
        p_exception_id: exceptionId,
        p_notes: body.notes || null,
      }
    );

    if (error) {
      console.error("Error rejecting delivery note receiving exception:", error);
      return NextResponse.json({ error: userSafeReviewMessage(error.message) }, { status: 400 });
    }

    const dn = await fetchDeliveryNote(
      auth.supabase,
      auth.companyId,
      id,
      auth.currentBusinessUnitId
    );
    if (!dn) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    return NextResponse.json(dn);
  } catch (error) {
    console.error("Unexpected error rejecting delivery note receiving exception:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "reject",
  resourceType: "delivery_notes",
  route: "/api/delivery-notes/[id]/receiving-exceptions/[exceptionId]/reject",
});
