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
  syncStockRequestStatusCache,
  toNumber,
} from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type DirectPickupReceiveBody = {
  confirmDirectCustomerPickup?: boolean;
  receivedDate?: string;
  notes?: string;
  items?: Array<{
    deliveryNoteItemId: string;
    receivedQty: number;
  }>;
};

// POST /api/delivery-notes/[id]/receive-direct-pickup
// Marks workflow as received without destination inventory posting.
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as DirectPickupReceiveBody;

    if (body.confirmDirectCustomerPickup !== true) {
      return NextResponse.json(
        { error: "confirmDirectCustomerPickup=true is required for this endpoint" },
        { status: 400 }
      );
    }

    const header = await fetchDeliveryNoteHeader(auth.supabase, auth.companyId, id);
    if (!header) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    if (header.status !== "dispatched") {
      return NextResponse.json(
        { error: "Only dispatched delivery notes can be completed as direct customer pickup" },
        { status: 400 }
      );
    }

    if (header.fulfillment_mode !== "customer_pickup_from_warehouse") {
      return NextResponse.json(
        {
          error:
            "This delivery note is not configured for direct customer pickup. Use /receive for normal transfer receipt.",
        },
        { status: 400 }
      );
    }

    const dnItems = await fetchDeliveryNoteItems(auth.supabase, auth.companyId, id);
    if (dnItems.length === 0) {
      return NextResponse.json({ error: "Delivery note has no items" }, { status: 400 });
    }

    const itemMap = new Map(dnItems.map((item) => [item.id, item]));
    const receiveItems = (body.items || []).length
      ? (body.items || []).map((line) => ({
          deliveryNoteItemId: line.deliveryNoteItemId,
          receivedQty: toNumber(line.receivedQty),
        }))
      : dnItems.map((line) => ({
          deliveryNoteItemId: line.id,
          receivedQty: toNumber(line.dispatched_qty),
        }));

    for (const line of receiveItems) {
      const dnItem = itemMap.get(line.deliveryNoteItemId);
      if (!dnItem) {
        return NextResponse.json(
          { error: `Invalid delivery note item ${line.deliveryNoteItemId}` },
          { status: 400 }
        );
      }

      const maxReceivable = toNumber(dnItem.dispatched_qty);
      if (line.receivedQty < 0 || line.receivedQty > maxReceivable) {
        return NextResponse.json(
          { error: `Received quantity must be between 0 and ${maxReceivable}` },
          { status: 400 }
        );
      }
    }

    const receivedDate = body.receivedDate || new Date().toISOString().split("T")[0];

    const { error: postingError } = await auth.supabase.rpc(
      "complete_delivery_note_direct_customer_pickup",
      {
        p_company_id: auth.companyId,
        p_user_id: auth.userId,
        p_dn_id: id,
        p_received_date: receivedDate,
        p_notes: body.notes || null,
        p_items: receiveItems,
      }
    );

    if (postingError) {
      return NextResponse.json({ error: postingError.message }, { status: 400 });
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
          fulfillment_mode: "customer_pickup_from_warehouse",
        },
      });
    } catch (notificationError) {
      console.error("Error creating direct pickup receive notifications:", notificationError);
    }

    const dn = await fetchDeliveryNote(auth.supabase, auth.companyId, id);
    return NextResponse.json(dn);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
