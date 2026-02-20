import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { fetchDeliveryNote, fetchDeliveryNoteHeader, getAuthContext } from "../../_lib";

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

    const nowIso = new Date().toISOString();
    const { error } = await auth.supabase
      .from("delivery_notes")
      .update({
        status: "voided",
        voided_at: nowIso,
        void_reason: body.reason?.trim() || null,
        updated_at: nowIso,
        updated_by: auth.userId,
      })
      .eq("id", id)
      .eq("company_id", auth.companyId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const dn = await fetchDeliveryNote(auth.supabase, auth.companyId, id);
    return NextResponse.json(dn);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
