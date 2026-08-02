import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { requireDeliveryNoteReceivingAccess } from "@/lib/delivery-notes/permissions";
import { fetchDeliveryNote, getAuthContext, mapDeliveryNoteRecord } from "./_lib";

type CreateDeliveryNoteBody = {
  fulfillmentMode?: "transfer_to_store" | "customer_pickup_from_warehouse";
  notes?: string;
  driverName?: string;
  items: Array<{
    srItemId: string;
    allocatedQty: number;
  }>;
};
type DeliveryNoteApiRecord = {
  requesting_business_unit_id: string;
  fulfilling_business_unit_id: string;
  requesting_warehouse_id: string | null;
  fulfilling_warehouse_id: string;
  [key: string]: unknown;
};

const DELIVERY_NOTE_LIST_SELECT = `
  id,
  company_id,
  business_unit_id,
  requesting_business_unit_id,
  fulfilling_business_unit_id,
  dn_no,
  status,
  requesting_warehouse_id,
  fulfilling_warehouse_id,
  fulfillment_mode,
  confirmed_at,
  picking_started_at,
  picking_started_by,
  picking_completed_at,
  picking_completed_by,
  dispatched_at,
  received_at,
  receiving_started_at,
  receiving_started_by,
  receiving_completed_at,
  receiving_completed_by,
  received_by,
  receiving_notes,
  receiving_has_discrepancy,
  receiving_discrepancy_notes,
  voided_at,
  void_reason,
  driver_name,
  driver_signature,
  helper_name,
  delivery_time,
  plate_number,
  notes,
  created_by,
  created_at,
  updated_by,
  updated_at,
  delivery_note_items(
    sr_item_id,
    allocated_qty,
    received_qty,
    receiving_variance_qty,
    receiving_status
  ),
  pick_lists(
    id,
    pick_list_no,
    status,
    created_at,
    deleted_at
  )
`;

const CREATE_DELIVERY_NOTE_ERROR: Record<string, { message: string; status: number }> = {
  DELIVERY_NOTE_UNAUTHORIZED: { message: "Not authorized to create delivery note", status: 403 },
  DELIVERY_NOTE_BUSINESS_UNIT_REQUIRED: {
    message: "Business unit context is required",
    status: 400,
  },
  DELIVERY_NOTE_BUSINESS_UNIT_MISMATCH: {
    message: "Every selected request must be fulfilled by the current business unit",
    status: 400,
  },
  DELIVERY_NOTE_INVALID_FULFILLMENT_MODE: {
    message: "Invalid fulfillment mode",
    status: 400,
  },
  DELIVERY_NOTE_INVALID_LINES: { message: "Invalid delivery note lines", status: 400 },
  DELIVERY_NOTE_INVALID_LINE_QUANTITY: {
    message: "Allocated quantity must be greater than zero",
    status: 400,
  },
  DELIVERY_NOTE_INVALID_STOCK_REQUEST_ITEM: {
    message: "One or more stock request items are invalid",
    status: 400,
  },
  DELIVERY_NOTE_INELIGIBLE_STOCK_REQUEST: {
    message: "One or more stock requests are not eligible for allocation",
    status: 400,
  },
  DELIVERY_NOTE_REQUEST_QUANTITY_EXCEEDED: {
    message: "Allocated quantity exceeds the stock request quantity",
    status: 400,
  },
  DELIVERY_NOTE_INSUFFICIENT_INVENTORY: {
    message: "Insufficient complete-unit inventory for this allocation",
    status: 400,
  },
  DELIVERY_NOTE_SELECTED_BATCH_INSUFFICIENT: {
    message: "The selected batch no longer has enough available inventory",
    status: 409,
  },
};

const mapCreateDeliveryNoteError = (message: string) =>
  CREATE_DELIVERY_NOTE_ERROR[
    Object.keys(CREATE_DELIVERY_NOTE_ERROR).find((code) => message.includes(code)) || ""
  ] || {
    message: "Failed to create delivery note",
    status: 400,
  };

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// GET /api/delivery-notes
async function GETHandler(request: NextRequest) {
  try {
    const receivingOnly = request.nextUrl.searchParams.get("receivingOnly") === "true";
    const unauthorized = receivingOnly
      ? await requireDeliveryNoteReceivingAccess("view")
      : await requirePermission(RESOURCES.DELIVERY_NOTES, "view");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const status = request.nextUrl.searchParams.get("status");
    const requestingWarehouseId = request.nextUrl.searchParams.get("requestingWarehouseId");
    const search = request.nextUrl.searchParams.get("search")?.trim();
    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(request.nextUrl.searchParams.get("limit"), 50), 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    let query = auth.supabase
      .from("delivery_notes")
      .select(DELIVERY_NOTE_LIST_SELECT, { count: "exact" })
      .eq("company_id", auth.companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status) {
      query = query.eq("status", status);
    } else if (receivingOnly) {
      query = query.in("status", ["dispatched", "received"]);
    }
    if (auth.currentBusinessUnitId && receivingOnly) {
      query = query.eq("requesting_business_unit_id", auth.currentBusinessUnitId);
    } else if (auth.currentBusinessUnitId) {
      query = query.or(
        `requesting_business_unit_id.eq.${auth.currentBusinessUnitId},fulfilling_business_unit_id.eq.${auth.currentBusinessUnitId}`
      );
    }
    if (requestingWarehouseId) {
      query = query.eq("requesting_warehouse_id", requestingWarehouseId);
    }
    if (search) {
      const safeSearch = search.slice(0, 100).replace(/[,%]/g, " ");
      query = query.or(`dn_no.ilike.%${safeSearch}%,notes.ilike.%${safeSearch}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error("Error loading delivery notes:", error);
      return NextResponse.json({ error: "Failed to load delivery notes" }, { status: 500 });
    }

    return NextResponse.json({
      data: (data || []).map((row) => {
        const record = row as DeliveryNoteApiRecord;
        const canViewReceivingDetails = auth.currentBusinessUnitId
          ? record.requesting_business_unit_id === auth.currentBusinessUnitId
          : true;
        return mapDeliveryNoteRecord(record, canViewReceivingDetails);
      }),
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    console.error("Unexpected error loading delivery notes:", error);
    return NextResponse.json({ error: "Failed to load delivery notes" }, { status: 500 });
  }
}

// POST /api/delivery-notes
async function POSTHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.DELIVERY_NOTES, "edit");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json().catch(() => null)) as CreateDeliveryNoteBody | null;
    if (!body || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) {
      return NextResponse.json(
        { error: "At least one delivery note line is required" },
        { status: 400 }
      );
    }
    const lineIds = new Set<string>();
    const hasInvalidLine = body.items.some((line) => {
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
    if (hasInvalidLine) {
      return NextResponse.json(
        { code: "DELIVERY_NOTE_INVALID_LINES", error: "Invalid delivery note lines" },
        { status: 400 }
      );
    }
    if (
      (body.notes !== undefined && (typeof body.notes !== "string" || body.notes.length > 2000)) ||
      (body.driverName !== undefined &&
        (typeof body.driverName !== "string" || body.driverName.length > 200))
    ) {
      return NextResponse.json(
        { code: "DELIVERY_NOTE_INVALID_HEADER", error: "Invalid delivery note details" },
        { status: 400 }
      );
    }

    const fulfillmentMode = body.fulfillmentMode || "transfer_to_store";
    if (!["transfer_to_store", "customer_pickup_from_warehouse"].includes(fulfillmentMode)) {
      return NextResponse.json({ error: "Invalid fulfillment mode" }, { status: 400 });
    }

    if (!auth.currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context is required" }, { status: 400 });
    }

    const { data: result, error: createError } = await auth.supabase.rpc(
      "create_delivery_notes_transactionally",
      {
        p_company_id: auth.companyId,
        p_user_id: auth.userId,
        p_business_unit_id: auth.currentBusinessUnitId,
        p_fulfillment_mode: fulfillmentMode,
        p_notes: body.notes?.trim() || "",
        p_driver_name: body.driverName?.trim() || "",
        p_lines: body.items.map((line) => ({
          sr_item_id: line.srItemId,
          allocated_qty: Number(line.allocatedQty),
        })),
      }
    );

    if (createError) {
      console.error("Failed to create delivery note transactionally", createError);
      const mapped = mapCreateDeliveryNoteError(createError.message);
      const code =
        Object.keys(CREATE_DELIVERY_NOTE_ERROR).find((candidate) =>
          createError.message.includes(candidate)
        ) || "DELIVERY_NOTE_CREATE_FAILED";
      return NextResponse.json({ code, error: mapped.message }, { status: mapped.status });
    }

    const resultRecord =
      result && typeof result === "object" && !Array.isArray(result)
        ? (result as Record<string, unknown>)
        : null;
    const deliveryNoteEntries = Array.isArray(resultRecord?.deliveryNotes)
      ? resultRecord.deliveryNotes
      : [];
    const deliveryNoteIds = deliveryNoteEntries
      .map((entry) =>
        entry && typeof entry === "object" && "deliveryNoteId" in entry
          ? String(entry.deliveryNoteId || "")
          : ""
      )
      .filter(Boolean);
    if (deliveryNoteIds.length === 0) {
      return NextResponse.json({ error: "Failed to create delivery note" }, { status: 500 });
    }

    const created = await Promise.all(
      deliveryNoteIds.map((deliveryNoteId) =>
        fetchDeliveryNote(auth.supabase, auth.companyId, deliveryNoteId, auth.currentBusinessUnitId)
      )
    );
    if (created.some((deliveryNote) => !deliveryNote)) {
      return NextResponse.json({ error: "Failed to load created delivery notes" }, { status: 500 });
    }
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("Unexpected delivery note creation error", error);
    return NextResponse.json({ error: "Failed to create delivery note" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "delivery_notes",
  route: "/api/delivery-notes",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "delivery_notes",
  route: "/api/delivery-notes",
});
