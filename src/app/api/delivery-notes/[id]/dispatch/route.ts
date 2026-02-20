import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
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
  dispatchDate?: string;
  notes?: string;
  items?: Array<{
    deliveryNoteItemId: string;
    dispatchQty: number;
  }>;
};

// POST /api/delivery-notes/[id]/dispatch
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
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

    const dispatchOverrideMap = new Map(
      (body.items || []).map((line) => [line.deliveryNoteItemId, toNumber(line.dispatchQty)])
    );

    const dispatchItems = dnItems.map((item) => {
      const pickedQty = toNumber(item.picked_qty);
      const priorDispatchedQty = toNumber(item.dispatched_qty);
      const remainingPickedQty = Math.max(0, pickedQty - priorDispatchedQty);
      const dispatchQty = dispatchOverrideMap.has(item.id)
        ? dispatchOverrideMap.get(item.id) || 0
        : remainingPickedQty;

      return {
        deliveryNoteItemId: item.id,
        dispatchQty,
      };
    });

    const businessUnitId = auth.currentBusinessUnitId || header.business_unit_id;
    if (!businessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const dispatchDate = body.dispatchDate || new Date().toISOString().split("T")[0];

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
    });

    if (postingError) {
      return NextResponse.json({ error: postingError.message }, { status: 400 });
    }

    const dn = await fetchDeliveryNote(auth.supabase, auth.companyId, id);
    return NextResponse.json(dn);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
