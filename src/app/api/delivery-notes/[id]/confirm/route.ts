import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { fetchDeliveryNote, fetchDeliveryNoteHeader, getAuthContext } from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/delivery-notes/[id]/confirm
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const header = await fetchDeliveryNoteHeader(auth.supabase, auth.companyId, id);
    if (!header) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    if (header.status !== "draft") {
      return NextResponse.json({ error: "Only draft delivery notes can be confirmed" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const { error } = await auth.supabase
      .from("delivery_notes")
      .update({
        status: "confirmed",
        confirmed_at: nowIso,
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
