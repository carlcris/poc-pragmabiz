import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
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

type VoidBody = {
  reason?: string;
};

const VOIDABLE_STATUSES = new Set([
  "draft",
  "confirmed",
  "queued_for_picking",
  "picking_in_progress",
  "dispatch_ready",
]);

// POST /api/delivery-notes/[id]/void
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as VoidBody;

    const header = await fetchDeliveryNoteHeader(auth.supabase, auth.companyId, id);
    if (!header) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    if (!VOIDABLE_STATUSES.has(header.status)) {
      return NextResponse.json(
        { error: "Delivery note can only be voided before dispatch" },
        { status: 400 }
      );
    }

    const dnItems = await fetchDeliveryNoteItems(auth.supabase, auth.companyId, id);

    const hasDispatchedQty = dnItems.some((item) => toNumber(item.dispatched_qty) > 0);
    if (hasDispatchedQty) {
      return NextResponse.json(
        { error: "Delivery note can only be voided before dispatch" },
        { status: 400 }
      );
    }

    const { error: voidError } = await auth.supabase.rpc("void_delivery_note_pre_dispatch", {
      p_company_id: auth.companyId,
      p_user_id: auth.userId,
      p_dn_id: id,
      p_reason: body.reason?.trim() || null,
    });

    if (voidError) {
      return NextResponse.json({ error: voidError.message }, { status: 400 });
    }

    await syncStockRequestStatusCache(
      auth.supabase,
      auth.companyId,
      Array.from(new Set(dnItems.map((item) => item.sr_id))),
      auth.userId
    );

    const dn = await fetchDeliveryNote(auth.supabase, auth.companyId, id);
    return NextResponse.json(dn);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
