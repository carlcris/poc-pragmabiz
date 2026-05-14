import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  getWarehouseBusinessUnitMap,
  notifyBusinessUnits,
} from "@/app/api/_lib/workflow-notifications";
import {
  fetchDeliveryNote,
  fetchDeliveryNoteHeader,
  fetchDeliveryNoteItems,
  getAuthContext,
  isReceivingBusinessUnit,
  syncStockRequestStatusCache,
} from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SubmitReceivingBody = {
  receivedDate?: string;
  notes?: string;
  acknowledgeDiscrepancy?: boolean;
  discrepancyNotes?: string;
};

const userSafeSubmitMessage = (message: string | undefined) => {
  const allowedMessages = new Set([
    "Delivery note not found",
    "Only dispatched delivery notes can be submitted for receiving",
    "Receiving has not been started",
    "No receiving scans have been recorded",
    "Receiving discrepancy acknowledgement is required",
    "Receiving discrepancy notes are required",
  ]);

  return message && allowedMessages.has(message)
    ? message
    : "Failed to submit delivery note receiving";
};

// POST /api/delivery-notes/[id]/submit-receiving
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as SubmitReceivingBody;

    const header = await fetchDeliveryNoteHeader(auth.supabase, auth.companyId, id);
    if (!header) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    const businessUnitId = auth.currentBusinessUnitId;
    if (!businessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }
    const canReceive = await isReceivingBusinessUnit(
      auth.supabase,
      auth.companyId,
      businessUnitId,
      header.requesting_warehouse_id
    );
    if (!canReceive) {
      return NextResponse.json(
        { error: "Only the receiving business unit can submit receiving" },
        { status: 403 }
      );
    }

    const dnItems = await fetchDeliveryNoteItems(auth.supabase, auth.companyId, id);
    if (dnItems.length === 0) {
      return NextResponse.json({ error: "Delivery note has no items" }, { status: 400 });
    }

    const { error } = await auth.supabase.rpc("submit_delivery_note_receiving", {
      p_company_id: auth.companyId,
      p_business_unit_id: businessUnitId,
      p_user_id: auth.userId,
      p_dn_id: id,
      p_received_date: body.receivedDate || new Date().toISOString().split("T")[0],
      p_notes: body.notes || null,
      p_acknowledge_discrepancy: body.acknowledgeDiscrepancy === true,
      p_discrepancy_notes: body.discrepancyNotes || null,
    });

    if (error) {
      console.error("Error submitting delivery note receiving:", error);
      return NextResponse.json({ error: userSafeSubmitMessage(error.message) }, { status: 400 });
    }

    await syncStockRequestStatusCache(
      auth.supabase,
      auth.companyId,
      dnItems.map((item) => item.sr_id),
      auth.userId
    );

    try {
      const warehouseBuMap = await getWarehouseBusinessUnitMap(auth.supabase, auth.companyId, [
        header.fulfilling_warehouse_id,
      ]);
      const fulfillingBuId = warehouseBuMap.get(header.fulfilling_warehouse_id);

      await notifyBusinessUnits({
        supabase: auth.supabase,
        companyId: auth.companyId,
        actorUserId: auth.userId,
        businessUnitIds: [fulfillingBuId],
        title: "Delivery received",
        message: `Delivery note ${header.dn_no} has been received.`,
        type: "delivery_note_workflow",
        metadata: {
          delivery_note_id: header.id,
          dn_no: header.dn_no,
          status: "received",
        },
      });
    } catch (notificationError) {
      console.error("Error creating receive notifications:", notificationError);
    }

    const dn = await fetchDeliveryNote(
      auth.supabase,
      auth.companyId,
      id,
      auth.currentBusinessUnitId
    );
    return NextResponse.json(dn);
  } catch (error) {
    console.error("Unexpected error submitting delivery note receiving:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
