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
  params: Promise<{ id: string; scanId: string }>;
};

type VoidReceivingScanBody = {
  reason?: string;
};

// POST /api/delivery-notes/[id]/receiving-scans/[scanId]/void
async function POSTHandler(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requireDeliveryNoteReceivingAccess("edit");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id, scanId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as VoidReceivingScanBody;
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
        { error: "Only the receiving business unit can void receiving scans" },
        { status: 403 }
      );
    }

    const { error } = await auth.supabase.rpc("void_delivery_note_receiving_scan", {
      p_company_id: auth.companyId,
      p_user_id: auth.userId,
      p_dn_id: id,
      p_scan_id: scanId,
      p_reason: body.reason || null,
    });

    if (error) {
      console.error("Error voiding delivery note receiving scan:", error);
      return NextResponse.json({ error: "Failed to void receiving scan" }, { status: 400 });
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
    console.error("Unexpected error voiding delivery note receiving scan:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "void",
  resourceType: "delivery_notes",
  route: "/api/delivery-notes/[id]/receiving-scans/[scanId]/void",
});
