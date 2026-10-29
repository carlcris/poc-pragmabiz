import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requireDeliveryNoteReceivingAccess } from "@/lib/delivery-notes/permissions";
import { fetchDeliveryNote, getAuthContext } from "../../../../_lib";
import { getReceivingScanTranslator } from "../../../../receiving-scan-item";

type RouteContext = {
  params: Promise<{ id: string; exceptionId: string }>;
};

const voidReceivingExceptionSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

type VoidFailure = {
  code: string;
  messageKey:
    | "deliveryNoteNotFound"
    | "unexpectedItemNotFound"
    | "unexpectedItemReviewed"
    | "unexpectedItemReceivingClosed"
    | "invalidScan";
  status: number;
};

const VOID_FAILURES_BY_DB_MESSAGE: Record<string, VoidFailure> = {
  "Delivery note not found": {
    code: "DELIVERY_NOTE_NOT_FOUND",
    messageKey: "deliveryNoteNotFound",
    status: 404,
  },
  "Receiving exception not found": {
    code: "DELIVERY_NOTE_RECEIVING_EXCEPTION_NOT_FOUND",
    messageKey: "unexpectedItemNotFound",
    status: 404,
  },
  "Only pending receiving exceptions can be removed": {
    code: "DELIVERY_NOTE_RECEIVING_EXCEPTION_REVIEWED",
    messageKey: "unexpectedItemReviewed",
    status: 409,
  },
  "Only in-progress receiving can have unexpected items removed": {
    code: "DELIVERY_NOTE_RECEIVING_CLOSED",
    messageKey: "unexpectedItemReceivingClosed",
    status: 409,
  },
};

// POST /api/delivery-notes/[id]/receiving-exceptions/[exceptionId]/void
async function POSTHandler(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requireDeliveryNoteReceivingAccess("edit");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const t = getReceivingScanTranslator(request);
    const body = voidReceivingExceptionSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json(
        { code: "DELIVERY_NOTE_RECEIVING_INVALID_VOID", error: t("invalidScan") },
        { status: 400 }
      );
    }

    const { id, exceptionId } = await context.params;
    if (!auth.currentBusinessUnitId) {
      return NextResponse.json(
        { code: "DELIVERY_NOTE_NOT_FOUND", error: t("deliveryNoteNotFound") },
        { status: 404 }
      );
    }

    // The function enforces receiving business unit scope and pending status.
    const { error } = await auth.supabase.rpc("void_delivery_note_receiving_exception", {
      p_company_id: auth.companyId,
      p_business_unit_id: auth.currentBusinessUnitId,
      p_dn_id: id,
      p_exception_id: exceptionId,
      p_reason: body.data.reason || undefined,
    });

    if (error) {
      const failure = VOID_FAILURES_BY_DB_MESSAGE[error.message];
      if (failure) {
        return NextResponse.json(
          { code: failure.code, error: t(failure.messageKey) },
          { status: failure.status }
        );
      }
      console.error("Error voiding delivery note receiving exception:", error);
      return NextResponse.json(
        {
          code: "DELIVERY_NOTE_RECEIVING_EXCEPTION_VOID_FAILED",
          error: t("unexpectedItemVoidFailed"),
        },
        { status: 500 }
      );
    }

    const dn = await fetchDeliveryNote(
      auth.supabase,
      auth.companyId,
      id,
      auth.currentBusinessUnitId
    );
    if (!dn) {
      return NextResponse.json(
        { code: "DELIVERY_NOTE_NOT_FOUND", error: t("deliveryNoteNotFound") },
        { status: 404 }
      );
    }

    return NextResponse.json(dn);
  } catch (error) {
    console.error("Unexpected error voiding delivery note receiving exception:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "void",
  resourceType: "delivery_notes",
  route: "/api/delivery-notes/[id]/receiving-exceptions/[exceptionId]/void",
});
