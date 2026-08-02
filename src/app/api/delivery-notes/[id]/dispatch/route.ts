import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { notifyBusinessUnits } from "@/app/api/_lib/workflow-notifications";
import {
  fetchDeliveryNote,
  fetchDeliveryNoteHeader,
  fetchDeliveryNoteItems,
  getAuthContext,
  toNumber,
} from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type DispatchBody = {
  driverName?: string;
  driverSignature?: string;
  helperName?: string;
  deliveryTime?: string;
  plateNumber?: string;
  dispatchDate?: string;
  notes?: string;
  items?: Array<{
    deliveryNoteItemId: string;
    dispatchQty: number;
  }>;
};

// POST /api/delivery-notes/[id]/dispatch
async function POSTHandler(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.DELIVERY_NOTES, "edit");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as DispatchBody;

    const header = await fetchDeliveryNoteHeader(auth.supabase, auth.companyId, id);
    if (!header) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    if (header.status !== "dispatch_ready") {
      return NextResponse.json(
        { error: "Only dispatch_ready delivery notes can be dispatched" },
        { status: 400 }
      );
    }

    const dnItems = await fetchDeliveryNoteItems(auth.supabase, auth.companyId, id);
    if (dnItems.length === 0) {
      return NextResponse.json({ error: "Delivery note has no items" }, { status: 400 });
    }

    const activeDnItems = dnItems.filter((item) => !item.is_voided);
    const activeItemIds = new Set(activeDnItems.map((item) => item.id));
    const dispatchOverrideMap = new Map<string, number>();

    for (const line of body.items || []) {
      if (!activeItemIds.has(line.deliveryNoteItemId)) {
        return NextResponse.json(
          { error: `Invalid delivery note item ${line.deliveryNoteItemId}` },
          { status: 400 }
        );
      }

      dispatchOverrideMap.set(line.deliveryNoteItemId, toNumber(line.dispatchQty));
    }

    const dispatchItems = activeDnItems.flatMap((item) => {
      const pickedQty = toNumber(item.picked_qty);
      const priorDispatchedQty = toNumber(item.dispatched_qty);
      const remainingPickedQty = Math.max(0, pickedQty - priorDispatchedQty);
      const requestedDispatchQty = dispatchOverrideMap.get(item.id);

      if (remainingPickedQty === 0) {
        return [];
      }

      if (requestedDispatchQty == null) {
        return [
          {
            deliveryNoteItemId: item.id,
            dispatchQty: remainingPickedQty,
          },
        ];
      }

      if (requestedDispatchQty < 0 || requestedDispatchQty > remainingPickedQty) {
        return [
          {
            deliveryNoteItemId: item.id,
            dispatchQty: requestedDispatchQty,
          },
        ];
      }

      if (requestedDispatchQty === 0) {
        return [];
      }

      return [
        {
          deliveryNoteItemId: item.id,
          dispatchQty: requestedDispatchQty,
        },
      ];
    });

    if (dispatchItems.length === 0) {
      return NextResponse.json(
        { error: "No picked quantities available for dispatch" },
        { status: 400 }
      );
    }

    const businessUnitId = auth.currentBusinessUnitId || header.business_unit_id;
    if (!businessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const dispatchDate = body.dispatchDate || new Date().toISOString().split("T")[0];
    const deliveryTime =
      typeof body.deliveryTime === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(body.deliveryTime)
        ? body.deliveryTime
        : null;

    const { error: postingError } = await auth.supabase.rpc("post_delivery_note_dispatch", {
      p_company_id: auth.companyId,
      p_user_id: auth.userId,
      p_dn_id: id,
      p_business_unit_id: businessUnitId,
      p_dispatch_date: dispatchDate,
      p_notes: body.notes || null,
      p_driver_name: body.driverName || null,
      p_driver_signature: body.driverSignature?.trim() || null,
      p_items: dispatchItems,
      p_helper_name: body.helperName?.trim() || null,
      p_delivery_time: deliveryTime,
      p_plate_number: body.plateNumber?.trim() || null,
    });

    if (postingError) {
      console.error("Failed to dispatch delivery note:", postingError);
      return NextResponse.json(
        { error: "The delivery note could not be dispatched. Refresh and try again." },
        { status: 400 }
      );
    }

    try {
      await notifyBusinessUnits({
        supabase: auth.supabase,
        companyId: auth.companyId,
        actorUserId: auth.userId,
        businessUnitIds: [header.requesting_business_unit_id],
        title: "Delivery dispatched",
        message: `Delivery note ${header.dn_no} has been dispatched.`,
        type: "delivery_note_workflow",
        metadata: {
          delivery_note_id: header.id,
          dn_no: header.dn_no,
          status: "dispatched",
        },
      });
    } catch (notificationError) {
      console.error("Error creating dispatch notifications:", notificationError);
    }

    const dn = await fetchDeliveryNote(auth.supabase, auth.companyId, id);
    return NextResponse.json(dn);
  } catch (error) {
    console.error("Unexpected delivery note dispatch error:", error);
    return NextResponse.json({ error: "Failed to dispatch delivery note" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "dispatch",
  resourceType: "delivery_notes",
  route: "/api/delivery-notes/[id]/dispatch",
});
