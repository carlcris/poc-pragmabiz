import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import type { DeliveryNoteReceivingScanErrorCode } from "@/types/delivery-note";
import { requireDeliveryNoteReceivingAccess } from "@/lib/delivery-notes/permissions";
import {
  getReceivingScanTranslator,
  recordReceivingScanSchema,
  resolveReceivingScanItem,
  type ReceivingScanTranslator,
} from "../../receiving-scan-item";
import {
  fetchDeliveryNote,
  fetchDeliveryNoteHeader,
  getAuthContext,
  isReceivingBusinessUnit,
  toNumber,
} from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const receivingScanFailure = (
  message: string | undefined,
  t: ReceivingScanTranslator
): { status: number; code: DeliveryNoteReceivingScanErrorCode; error: string } => {
  switch (message) {
    case "Box ID is required":
    case "Scanned quantity must be greater than zero":
      return { status: 400, code: "DELIVERY_NOTE_RECEIVING_INVALID_SCAN", error: message };
    case "Delivery note not found":
      return { status: 404, code: "DELIVERY_NOTE_NOT_FOUND", error: message };
    case "Only dispatched delivery notes can be received":
      return { status: 409, code: "DELIVERY_NOTE_RECEIVING_INVALID_STATUS", error: message };
    case "Only the receiving business unit can record receiving scans":
      return { status: 403, code: "DELIVERY_NOTE_RECEIVING_FORBIDDEN", error: message };
    case "Start receiving before recording scans":
      return { status: 409, code: "DELIVERY_NOTE_RECEIVING_NOT_STARTED", error: message };
    case "Item not found":
      return {
        status: 400,
        code: "DELIVERY_NOTE_RECEIVING_ITEM_NOT_FOUND",
        error: t("itemNotFound"),
      };
    case "Multiple delivery note lines match this item. Scan a unit-specific barcode.":
      return { status: 409, code: "DELIVERY_NOTE_RECEIVING_AMBIGUOUS_ITEM", error: message };
    default:
      return {
        status: 500,
        code: "DELIVERY_NOTE_RECEIVING_SCAN_FAILED",
        error: "Failed to record receiving scan",
      };
  }
};

// POST /api/delivery-notes/[id]/receiving-scans
async function POSTHandler(request: NextRequest, context: RouteContext) {
  try {
    const t = getReceivingScanTranslator(request);
    const unauthorized = await requireDeliveryNoteReceivingAccess("edit");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const parsedBody = recordReceivingScanSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          code: "DELIVERY_NOTE_RECEIVING_INVALID_SCAN",
          error: t("invalidScan"),
        },
        { status: 400 }
      );
    }
    const body = parsedBody.data;

    const header = await fetchDeliveryNoteHeader(auth.supabase, auth.companyId, id);
    if (!header) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    const businessUnitId = auth.currentBusinessUnitId;
    if (!businessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }
    const canReceive = isReceivingBusinessUnit(businessUnitId, header.requesting_business_unit_id);
    if (!canReceive) {
      return NextResponse.json(
        {
          code: "DELIVERY_NOTE_RECEIVING_FORBIDDEN",
          error: "Only the receiving business unit can record receiving scans",
        },
        { status: 403 }
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

    let identity = {
      itemId: body.itemId,
      itemUnitOptionId: body.itemUnitOptionId || null,
      batchNumber: body.batchNumber || null,
      locationId: body.locationId || null,
    };
    if (!identity.itemId) {
      const resolved = await resolveReceivingScanItem(auth.supabase, auth.companyId, body, t);
      if (resolved.failure) {
        const { status, ...failure } = resolved.failure;
        return NextResponse.json(failure, { status });
      }
      identity = resolved.item;
    }
    const scannedQrCode = body.qrCode || body.boxId;

    const { data, error } = await auth.supabase.rpc("record_delivery_note_receiving_scan", {
      p_company_id: auth.companyId,
      p_business_unit_id: businessUnitId,
      p_user_id: auth.userId,
      p_dn_id: id,
      p_qr_code: scannedQrCode,
      p_box_id: body.boxId,
      p_item_id: identity.itemId,
      p_item_unit_option_id: identity.itemUnitOptionId,
      p_qr_qty: toNumber(body.qty),
      p_accepted_qty: body.acceptedQty == null ? null : toNumber(body.acceptedQty),
      p_adjustment_reason: body.adjustmentReason || null,
      p_notes: body.notes || null,
      p_batch_number: identity.batchNumber,
      p_location_id: identity.locationId,
    });

    if (error) {
      console.error("Error recording delivery note receiving scan:", error);
      const { status, ...failure } = receivingScanFailure(error.message, t);
      return NextResponse.json(failure, { status });
    }

    const deliveryNote = await fetchDeliveryNote(
      auth.supabase,
      auth.companyId,
      id,
      auth.currentBusinessUnitId
    );
    if (!deliveryNote) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    return NextResponse.json({ result: data, deliveryNote });
  } catch (error) {
    console.error("Unexpected error recording delivery note receiving scan:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "delivery_notes",
  route: "/api/delivery-notes/[id]/receiving-scans",
});
