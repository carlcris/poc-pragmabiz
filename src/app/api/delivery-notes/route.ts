import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { requireDeliveryNoteReceivingAccess } from "@/lib/delivery-notes/permissions";
import { fetchDeliveryNote, getAuthContext, mapDeliveryNoteRecord, toNumber } from "./_lib";

type CreateDeliveryNoteBody = {
  requestingWarehouseId?: string;
  fulfillingWarehouseId?: string;
  fulfillmentMode?: "transfer_to_store" | "customer_pickup_from_warehouse";
  srIds?: string[];
  notes?: string;
  driverName?: string;
  items: Array<{
    srId: string;
    srItemId: string;
    itemId: string;
    uomId: string;
    allocatedQty: number;
  }>;
};
type DeliveryNoteApiRecord = {
  requesting_warehouse_id: string;
  fulfilling_warehouse_id: string;
  [key: string]: unknown;
};

const CREATE_DELIVERY_NOTE_ERROR: Record<string, { message: string; status: number }> = {
  DELIVERY_NOTE_UNAUTHORIZED: { message: "Not authorized to create delivery note", status: 403 },
  DELIVERY_NOTE_BUSINESS_UNIT_REQUIRED: {
    message: "Business unit context is required",
    status: 400,
  },
  DELIVERY_NOTE_INVALID_WAREHOUSE_MAPPING: {
    message: "Stock request warehouse mapping is invalid",
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
};

const mapCreateDeliveryNoteError = (message: string) =>
  CREATE_DELIVERY_NOTE_ERROR[message] || {
    message: "Failed to create delivery note",
    status: 400,
  };

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

// GET /api/delivery-notes
async function GETHandler(request: NextRequest) {
  try {
    const receivingOnly = request.nextUrl.searchParams.get("receivingOnly") === "true";
    const unauthorized = receivingOnly
      ? await requireDeliveryNoteReceivingAccess("view")
      : await requirePermission(RESOURCES.STOCK_REQUESTS, "view");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const status = request.nextUrl.searchParams.get("status");
    const requestingWarehouseId = request.nextUrl.searchParams.get("requestingWarehouseId");
    const search = request.nextUrl.searchParams.get("search")?.trim();
    const hasPagination =
      request.nextUrl.searchParams.has("page") || request.nextUrl.searchParams.has("limit");
    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(request.nextUrl.searchParams.get("limit"), 50), 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const scopedWarehouseIds = auth.currentBusinessUnitId
      ? await auth.supabase
          .from("warehouses")
          .select("id")
          .eq("company_id", auth.companyId)
          .eq("business_unit_id", auth.currentBusinessUnitId)
          .is("deleted_at", null)
      : null;

    if (scopedWarehouseIds?.error) {
      console.error("Error loading delivery note visibility warehouses:", scopedWarehouseIds.error);
      return NextResponse.json({ error: "Failed to load delivery notes" }, { status: 500 });
    }

    const visibleWarehouseIds = (scopedWarehouseIds?.data || []).map((warehouse) => warehouse.id);
    if (auth.currentBusinessUnitId && visibleWarehouseIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    let query = auth.supabase
      .from("delivery_notes")
      .select(
        `
        *,
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
      `
      )
      .eq("company_id", auth.companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    } else if (receivingOnly) {
      query = query.in("status", ["dispatched", "received"]);
    }
    if (auth.currentBusinessUnitId && receivingOnly) {
      query = query.in("requesting_warehouse_id", visibleWarehouseIds);
    } else if (auth.currentBusinessUnitId) {
      query = query.or(
        `requesting_warehouse_id.in.(${visibleWarehouseIds.join(",")}),fulfilling_warehouse_id.in.(${visibleWarehouseIds.join(",")})`
      );
    }
    if (requestingWarehouseId) {
      query = query.eq("requesting_warehouse_id", requestingWarehouseId);
    }
    if (search) {
      query = query.or(`dn_no.ilike.%${search}%,notes.ilike.%${search}%`);
    }
    if (hasPagination) {
      query = query.range(from, to);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error loading delivery notes:", error);
      return NextResponse.json({ error: "Failed to load delivery notes" }, { status: 500 });
    }

    return NextResponse.json({
      data: (data || []).map((row) => {
        const record = row as DeliveryNoteApiRecord;
        const canViewReceivingDetails = auth.currentBusinessUnitId
          ? visibleWarehouseIds.includes(record.requesting_warehouse_id)
          : true;
        return mapDeliveryNoteRecord(record, canViewReceivingDetails);
      }),
    });
  } catch (error) {
    console.error("Unexpected error loading delivery notes:", error);
    return NextResponse.json({ error: "Failed to load delivery notes" }, { status: 500 });
  }
}

// POST /api/delivery-notes
async function POSTHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json()) as CreateDeliveryNoteBody;
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: "At least one delivery note line is required" },
        { status: 400 }
      );
    }

    const fulfillmentMode = body.fulfillmentMode || "transfer_to_store";
    if (!["transfer_to_store", "customer_pickup_from_warehouse"].includes(fulfillmentMode)) {
      return NextResponse.json({ error: "Invalid fulfillment mode" }, { status: 400 });
    }

    const distinctSrIds = Array.from(
      new Set([...(body.srIds || []), ...body.items.map((item) => item.srId)])
    );

    const { data: stockRequests } = await auth.supabase
      .from("stock_requests")
      .select("id, status, requesting_warehouse_id, fulfilling_warehouse_id")
      .in("id", distinctSrIds)
      .eq("company_id", auth.companyId)
      .is("deleted_at", null);

    if (!stockRequests || stockRequests.length !== distinctSrIds.length) {
      return NextResponse.json(
        { error: "One or more stock requests are invalid" },
        { status: 400 }
      );
    }

    const requestMap = new Map(stockRequests.map((row) => [row.id, row]));

    let inferredRequestingWarehouseId = body.requestingWarehouseId || "";
    let inferredFulfillingWarehouseId = body.fulfillingWarehouseId || "";

    for (const sr of stockRequests) {
      if (!sr.fulfilling_warehouse_id || !sr.requesting_warehouse_id) {
        return NextResponse.json(
          { error: "Stock request warehouse mapping is incomplete" },
          { status: 400 }
        );
      }

      const expectedSource = sr.requesting_warehouse_id;
      const expectedDestination = sr.fulfilling_warehouse_id;

      if (!inferredRequestingWarehouseId) inferredRequestingWarehouseId = expectedSource;
      if (!inferredFulfillingWarehouseId) inferredFulfillingWarehouseId = expectedDestination;
    }

    const { data: requestItems } = await auth.supabase
      .from("stock_request_items")
      .select(
        `
        id,
        stock_request_id,
        item_id,
        item_unit_option_id,
        uom_id,
        requested_qty,
        dispatch_qty,
        received_qty,
        items(item_code, item_name)
      `
      )
      .in(
        "id",
        body.items.map((line) => line.srItemId)
      );

    if (!requestItems || requestItems.length !== body.items.length) {
      return NextResponse.json(
        { error: "One or more stock request items are invalid" },
        { status: 400 }
      );
    }

    const requestItemMap = new Map(requestItems.map((item) => [item.id, item]));

    const { data: existingDnItems } = await auth.supabase
      .from("delivery_note_items")
      .select(
        `
        sr_item_id,
        allocated_qty,
        delivery_notes!inner(status)
      `
      )
      .eq("company_id", auth.companyId)
      .in(
        "sr_item_id",
        body.items.map((line) => line.srItemId)
      );

    const allocatedByItem = new Map<string, number>();
    for (const existing of existingDnItems || []) {
      const dnHeader = Array.isArray(existing.delivery_notes)
        ? existing.delivery_notes[0]
        : existing.delivery_notes;
      if (!dnHeader || ["voided", "dispatched", "received"].includes(dnHeader.status)) continue;
      const prior = allocatedByItem.get(existing.sr_item_id) || 0;
      allocatedByItem.set(existing.sr_item_id, prior + toNumber(existing.allocated_qty));
    }

    for (const line of body.items) {
      const sr = requestMap.get(line.srId);
      if (!sr) {
        return NextResponse.json({ error: `Invalid stock request ${line.srId}` }, { status: 400 });
      }

      if (["draft", "cancelled", "completed", "fulfilled"].includes(sr.status)) {
        return NextResponse.json(
          { error: `Stock request ${line.srId} is not eligible for delivery note allocation` },
          { status: 400 }
        );
      }

      const srItem = requestItemMap.get(line.srItemId);
      if (!srItem || srItem.stock_request_id !== line.srId) {
        return NextResponse.json(
          { error: `Invalid stock request item ${line.srItemId}` },
          { status: 400 }
        );
      }

      if (srItem.item_id !== line.itemId || srItem.uom_id !== line.uomId) {
        return NextResponse.json(
          { error: `Item/UOM mismatch for stock request item ${line.srItemId}` },
          { status: 400 }
        );
      }

      const allocatedQty = toNumber(line.allocatedQty);
      if (allocatedQty <= 0) {
        return NextResponse.json(
          { error: "Allocated quantity must be greater than zero" },
          { status: 400 }
        );
      }

      const alreadyAllocated = allocatedByItem.get(line.srItemId) || 0;
      const maxAllocatable = Math.max(
        0,
        toNumber(srItem.requested_qty) - toNumber(srItem.dispatch_qty) - alreadyAllocated
      );
      if (allocatedQty > maxAllocatable) {
        const itemRef = Array.isArray(srItem.items) ? srItem.items[0] : srItem.items;
        const itemLabel = itemRef?.item_name || itemRef?.item_code || line.itemId;
        const requestedQty = toNumber(srItem.requested_qty);
        const dispatchedQty = toNumber(srItem.dispatch_qty);
        return NextResponse.json(
          {
            error: `Allocated quantity (${allocatedQty}) exceeds available quantity (${maxAllocatable}) for ${itemLabel}. Requested: ${requestedQty}, dispatched: ${dispatchedQty}, already allocated in other pending DNs: ${alreadyAllocated}.`,
          },
          { status: 400 }
        );
      }
    }

    if (!auth.currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context is required" }, { status: 400 });
    }

    const { data: result, error: createError } = await auth.supabase.rpc(
      "create_delivery_note_transactionally",
      {
        p_company_id: auth.companyId,
        p_user_id: auth.userId,
        p_business_unit_id: auth.currentBusinessUnitId,
        p_requesting_warehouse_id: inferredRequestingWarehouseId,
        p_fulfilling_warehouse_id: inferredFulfillingWarehouseId,
        p_fulfillment_mode: fulfillmentMode,
        p_notes: body.notes?.trim() || "",
        p_driver_name: body.driverName?.trim() || "",
        p_lines: body.items.map((line) => ({
          sr_item_id: line.srItemId,
          allocated_qty: toNumber(line.allocatedQty),
        })),
      }
    );

    if (createError) {
      console.error("Failed to create delivery note transactionally", createError);
      const mapped = mapCreateDeliveryNoteError(createError.message);
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    const deliveryNoteId =
      result && typeof result === "object" && "deliveryNoteId" in result
        ? String(result.deliveryNoteId || "")
        : "";
    if (!deliveryNoteId) {
      return NextResponse.json({ error: "Failed to create delivery note" }, { status: 500 });
    }

    const created = await fetchDeliveryNote(auth.supabase, auth.companyId, deliveryNoteId);
    if (!created) {
      return NextResponse.json({ error: "Failed to load created delivery note" }, { status: 500 });
    }
    return NextResponse.json(created, { status: 201 });
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
