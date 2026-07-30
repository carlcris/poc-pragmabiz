import { NextRequest, NextResponse } from "next/server";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { fetchDeliveryNote, getAuthContext } from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type AddDeliveryNoteItemsBody = {
  pickerUserIds?: string[];
  notes?: string;
  items?: Array<{
    srItemId: string;
    allocatedQty: number;
  }>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ADD_ITEMS_ERRORS: Record<string, { error: string; status: number }> = {
  DELIVERY_NOTE_UNAUTHORIZED: {
    error: "You do not have permission to add items to this delivery note.",
    status: 403,
  },
  DELIVERY_NOTE_NOT_FOUND: { error: "Delivery note not found", status: 404 },
  DELIVERY_NOTE_NOT_DISPATCHED: {
    error: "Items can only be added after the delivery note has been dispatched.",
    status: 409,
  },
  DELIVERY_NOTE_BUSINESS_UNIT_MISMATCH: {
    error: "The stock request and delivery note business units do not match.",
    status: 400,
  },
  DELIVERY_NOTE_INVALID_LINES: { error: "Invalid delivery note lines.", status: 400 },
  DELIVERY_NOTE_INVALID_LINE_QUANTITY: {
    error: "Allocated quantity must be greater than zero.",
    status: 400,
  },
  DELIVERY_NOTE_INVALID_STOCK_REQUEST_ITEM: {
    error: "One or more stock request items are invalid.",
    status: 400,
  },
  DELIVERY_NOTE_DUPLICATE_STOCK_REQUEST_ITEM: {
    error: "A selected stock request item is already on this delivery note.",
    status: 409,
  },
  DELIVERY_NOTE_INELIGIBLE_STOCK_REQUEST: {
    error: "One or more stock requests are no longer eligible for allocation.",
    status: 409,
  },
  DELIVERY_NOTE_REQUEST_QUANTITY_EXCEEDED: {
    error: "An allocated quantity exceeds the remaining requested quantity.",
    status: 409,
  },
  PICK_LIST_PICKER_REQUIRED: {
    error: "Assign at least one picker before adding items.",
    status: 400,
  },
  PICK_LIST_INVALID_PICKER: {
    error: "One or more selected pickers are invalid.",
    status: 400,
  },
  PICK_LIST_ACTIVE_EXISTS: {
    error: "This delivery note already has an active pick list.",
    status: 409,
  },
  PICK_ALLOCATION_INSUFFICIENT_BATCH_QUANTITY: {
    error: "There is not enough pickable inventory in the source warehouse.",
    status: 409,
  },
};

const mapAddItemsError = (message: string) => {
  const code = Object.keys(ADD_ITEMS_ERRORS).find((candidate) => message.includes(candidate));
  return code
    ? { code, ...ADD_ITEMS_ERRORS[code] }
    : {
        code: "DELIVERY_NOTE_ADD_ITEMS_FAILED",
        error: "The items could not be added. Refresh inventory availability and try again.",
        status: 400,
      };
};

async function POSTHandler(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;
    if (!auth.currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context is required" }, { status: 400 });
    }

    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => null)) as AddDeliveryNoteItemsBody | null;
    const pickerUserIds = Array.from(
      new Set((body?.pickerUserIds || []).map((pickerId) => pickerId.trim()).filter(Boolean))
    );
    const items = body?.items || [];
    const lineIds = new Set<string>();
    const invalidLine = items.some((line) => {
      if (
        !line ||
        typeof line !== "object" ||
        typeof line.srItemId !== "string" ||
        !UUID_PATTERN.test(line.srItemId) ||
        typeof line.allocatedQty !== "number" ||
        !Number.isFinite(line.allocatedQty) ||
        line.allocatedQty <= 0 ||
        lineIds.has(line.srItemId)
      ) {
        return true;
      }
      lineIds.add(line.srItemId);
      return false;
    });

    if (
      items.length < 1 ||
      items.length > 100 ||
      invalidLine ||
      pickerUserIds.length < 1 ||
      pickerUserIds.length > 50 ||
      pickerUserIds.some((pickerId) => !UUID_PATTERN.test(pickerId)) ||
      (body?.notes !== undefined && (typeof body.notes !== "string" || body.notes.length > 2000))
    ) {
      return NextResponse.json(
        { code: "DELIVERY_NOTE_INVALID_LINES", error: "Check the items and assigned pickers." },
        { status: 400 }
      );
    }

    const { error } = await auth.supabase.rpc("add_delivery_note_items_transactionally", {
      p_company_id: auth.companyId,
      p_user_id: auth.userId,
      p_business_unit_id: auth.currentBusinessUnitId,
      p_delivery_note_id: id,
      p_picker_user_ids: pickerUserIds,
      p_notes: body?.notes?.trim() || null,
      p_lines: items.map((line) => ({
        sr_item_id: line.srItemId,
        allocated_qty: line.allocatedQty,
      })),
    });

    if (error) {
      console.error("Failed to add delivery note items transactionally:", error);
      const mapped = mapAddItemsError(error.message);
      return NextResponse.json(
        { code: mapped.code, error: mapped.error },
        { status: mapped.status }
      );
    }

    const deliveryNote = await fetchDeliveryNote(
      auth.supabase,
      auth.companyId,
      id,
      auth.currentBusinessUnitId
    );
    if (!deliveryNote) {
      return NextResponse.json(
        { error: "Items were added, but the delivery note could not be reloaded." },
        { status: 500 }
      );
    }

    return NextResponse.json(deliveryNote);
  } catch (error) {
    console.error("Unexpected add delivery note items error:", error);
    return NextResponse.json({ error: "Failed to add delivery note items" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "delivery_notes",
  route: "/api/delivery-notes/[id]/items",
});
