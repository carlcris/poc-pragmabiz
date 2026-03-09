import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { fetchDeliveryNote, fetchDeliveryNoteHeader, getAuthContext, syncStockRequestStatusCache, toNumber } from "../../../_lib";

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

type AdjustDeliveryNoteItemBody = {
  dispatchedQty?: number;
  reason?: string;
};

// PATCH /api/delivery-notes/[id]/items/[itemId]
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id, itemId } = await context.params;
    const header = await fetchDeliveryNoteHeader(auth.supabase, auth.companyId, id);
    if (!header) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    if (header.status !== "dispatched") {
      return NextResponse.json({ error: "Only dispatched delivery notes can be adjusted" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as AdjustDeliveryNoteItemBody;
    if (body.dispatchedQty == null) {
      return NextResponse.json({ error: "New dispatched quantity is required" }, { status: 400 });
    }

    const { data: line, error: lineError } = await auth.supabase
      .from("delivery_note_items")
      .select("id, sr_id, dispatched_qty")
      .eq("company_id", auth.companyId)
      .eq("dn_id", id)
      .eq("id", itemId)
      .single();

    if (lineError || !line) {
      return NextResponse.json({ error: "Delivery note item not found" }, { status: 404 });
    }

    const nextDispatchedQty = toNumber(body.dispatchedQty);
    const currentDispatchedQty = toNumber(line.dispatched_qty);

    if (nextDispatchedQty < 0 || nextDispatchedQty > currentDispatchedQty) {
      return NextResponse.json(
        { error: `New dispatched quantity must be between 0 and ${currentDispatchedQty}. Use Add Items to source additional quantity from another stock request line.` },
        { status: 400 }
      );
    }

    if (nextDispatchedQty === currentDispatchedQty) {
      const unchanged = await fetchDeliveryNote(auth.supabase, auth.companyId, id);
      return NextResponse.json(unchanged);
    }

    const { error: adjustError } = await auth.supabase.rpc("adjust_dispatched_delivery_note_item", {
      p_company_id: auth.companyId,
      p_user_id: auth.userId,
      p_dn_id: id,
      p_delivery_note_item_id: itemId,
      p_new_dispatched_qty: nextDispatchedQty,
      p_reason: body.reason?.trim() || null,
    });

    if (adjustError) {
      return NextResponse.json({ error: adjustError.message }, { status: 400 });
    }

    await syncStockRequestStatusCache(auth.supabase, auth.companyId, [line.sr_id], auth.userId);

    const dn = await fetchDeliveryNote(auth.supabase, auth.companyId, id);
    return NextResponse.json(dn);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
