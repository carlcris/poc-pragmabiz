import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  fetchDeliveryNote,
  fetchDeliveryNoteHeader,
  getAuthContext,
  isReceivingBusinessUnit,
} from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/delivery-notes/[id]/start-receiving
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

    if (header.status !== "dispatched") {
      return NextResponse.json(
        { error: "Only dispatched delivery notes can be received" },
        { status: 400 }
      );
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
        { error: "Only the receiving business unit can start receiving" },
        { status: 403 }
      );
    }

    const { error } = await auth.supabase
      .from("delivery_notes")
      .update({
        receiving_started_at: header.receiving_started_at || new Date().toISOString(),
        receiving_started_by: header.receiving_started_by || auth.userId,
        updated_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("company_id", auth.companyId)
      .is("deleted_at", null);

    if (error) {
      console.error("Error starting delivery note receiving:", error);
      return NextResponse.json(
        { error: "Failed to start delivery note receiving" },
        { status: 500 }
      );
    }

    const dn = await fetchDeliveryNote(
      auth.supabase,
      auth.companyId,
      id,
      auth.currentBusinessUnitId
    );
    return NextResponse.json(dn);
  } catch (error) {
    console.error("Unexpected error starting delivery note receiving:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
