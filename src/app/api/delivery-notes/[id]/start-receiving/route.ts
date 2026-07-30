import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requireDeliveryNoteReceivingAccess } from "@/lib/delivery-notes/permissions";
import {
  fetchDeliveryNote,
  fetchDeliveryNoteHeader,
  getAuthContext,
} from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/delivery-notes/[id]/start-receiving
type StartReceivingBody = {
  receivingWarehouseId?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const START_RECEIVING_ERROR: Record<string, { message: string; status: number }> = {
  DELIVERY_NOTE_NOT_FOUND: { message: "Delivery note not found", status: 404 },
  DELIVERY_NOTE_NOT_DISPATCHED: {
    message: "Only dispatched delivery notes can be received",
    status: 409,
  },
  DELIVERY_NOTE_RECEIVING_FORBIDDEN: {
    message: "Only the requesting business unit can start receiving",
    status: 403,
  },
  DELIVERY_NOTE_RECEIVING_WAREHOUSE_INVALID: {
    message: "Select an active receiving warehouse in the current business unit",
    status: 400,
  },
  DELIVERY_NOTE_RECEIVING_WAREHOUSE_IMMUTABLE: {
    message: "The receiving warehouse cannot be changed after receiving has started",
    status: 409,
  },
};

async function POSTHandler(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requireDeliveryNoteReceivingAccess("edit");
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
    if (header.requesting_business_unit_id !== auth.currentBusinessUnitId) {
      return NextResponse.json(
        { error: "Only the receiving business unit can start receiving" },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as StartReceivingBody;
    if (!body.receivingWarehouseId || !UUID_PATTERN.test(body.receivingWarehouseId)) {
      return NextResponse.json(
        { code: "DELIVERY_NOTE_RECEIVING_WAREHOUSE_INVALID", error: "Select a receiving warehouse" },
        { status: 400 }
      );
    }

    const { error } = await auth.supabase.rpc(
      "start_delivery_note_receiving_transactionally",
      {
        p_company_id: auth.companyId,
        p_user_id: auth.userId,
        p_business_unit_id: auth.currentBusinessUnitId,
        p_delivery_note_id: id,
        p_receiving_warehouse_id: body.receivingWarehouseId,
      }
    );

    if (error) {
      console.error("Error starting delivery note receiving:", error);
      const code =
        Object.keys(START_RECEIVING_ERROR).find((candidate) => error.message.includes(candidate)) ||
        "DELIVERY_NOTE_START_RECEIVING_FAILED";
      const mapped = START_RECEIVING_ERROR[code] || {
        message: "Failed to start delivery note receiving",
        status: 500,
      };
      return NextResponse.json({ code, error: mapped.message }, { status: mapped.status });
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

export const POST = withActivityLogging(POSTHandler, {
  action: "start_receiving",
  resourceType: "delivery_notes",
  route: "/api/delivery-notes/[id]/start-receiving",
});
