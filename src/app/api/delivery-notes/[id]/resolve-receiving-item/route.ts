import { NextRequest, NextResponse } from "next/server";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requireDeliveryNoteReceivingAccess } from "@/lib/delivery-notes/permissions";
import { fetchDeliveryNoteHeader, getAuthContext, isReceivingBusinessUnit } from "../../_lib";
import {
  getReceivingScanTranslator,
  recordReceivingScanSchema,
  resolveReceivingScanItem,
} from "../../receiving-scan-item";

type RouteContext = { params: Promise<{ id: string }> };

async function POSTHandler(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requireDeliveryNoteReceivingAccess("edit");
    if (unauthorized) return unauthorized;
    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const t = getReceivingScanTranslator(request);
    const body = recordReceivingScanSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json(
        { code: "DELIVERY_NOTE_RECEIVING_INVALID_SCAN", error: t("invalidScan") },
        { status: 400 }
      );
    }
    const { id } = await context.params;
    const header = await fetchDeliveryNoteHeader(auth.supabase, auth.companyId, id);
    if (!header) {
      return NextResponse.json(
        { code: "DELIVERY_NOTE_NOT_FOUND", error: "Delivery note not found" },
        { status: 404 }
      );
    }
    if (!isReceivingBusinessUnit(auth.currentBusinessUnitId, header.requesting_business_unit_id)) {
      return NextResponse.json(
        {
          code: "DELIVERY_NOTE_RECEIVING_FORBIDDEN",
          error: "Only the receiving business unit can record receiving scans",
        },
        { status: 403 }
      );
    }
    if (header.status !== "dispatched") {
      return NextResponse.json(
        {
          code: "DELIVERY_NOTE_RECEIVING_INVALID_STATUS",
          error: "Only dispatched delivery notes can be received",
        },
        { status: 409 }
      );
    }
    if (!header.receiving_started_at || !header.requesting_warehouse_id) {
      return NextResponse.json(
        {
          code: "DELIVERY_NOTE_RECEIVING_NOT_STARTED",
          error: "Start receiving before recording scans",
        },
        { status: 409 }
      );
    }

    const resolved = await resolveReceivingScanItem(auth.supabase, auth.companyId, body.data, t);
    if (resolved.failure) {
      const { status, ...failure } = resolved.failure;
      return NextResponse.json(failure, { status });
    }
    return NextResponse.json({ data: resolved.item });
  } catch (error) {
    console.error("Unexpected error resolving delivery note receiving item:", error);
    return NextResponse.json(
      {
        code: "DELIVERY_NOTE_RECEIVING_LOOKUP_FAILED",
        error: getReceivingScanTranslator(request)("lookupFailed"),
      },
      { status: 500 }
    );
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "view",
  resourceType: "delivery_notes",
  route: "/api/delivery-notes/[id]/resolve-receiving-item",
});
