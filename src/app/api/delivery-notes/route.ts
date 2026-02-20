import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { buildDnNo, fetchDeliveryNote, getAuthContext, mapDeliveryNoteRecord, toNumber } from "./_lib";

type CreateDeliveryNoteBody = {
  requestingWarehouseId?: string;
  fulfillingWarehouseId?: string;
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

// GET /api/delivery-notes
export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "view");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const status = request.nextUrl.searchParams.get("status");

    let query = auth.supabase
      .from("delivery_notes")
      .select(
        `
        *,
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

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: (data || []).map((row) => mapDeliveryNoteRecord(row as DeliveryNoteApiRecord)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/delivery-notes
export async function POST(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json()) as CreateDeliveryNoteBody;
    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "At least one delivery note line is required" }, { status: 400 });
    }

    const distinctSrIds = Array.from(new Set([...(body.srIds || []), ...body.items.map((item) => item.srId)]));

    const { data: stockRequests } = await auth.supabase
      .from("stock_requests")
      .select("id, status, requesting_warehouse_id, fulfilling_warehouse_id")
      .in("id", distinctSrIds)
      .eq("company_id", auth.companyId)
      .is("deleted_at", null);

    if (!stockRequests || stockRequests.length !== distinctSrIds.length) {
      return NextResponse.json({ error: "One or more stock requests are invalid" }, { status: 400 });
    }

    const requestMap = new Map(stockRequests.map((row) => [row.id, row]));

    let inferredRequestingWarehouseId = body.requestingWarehouseId || "";
    let inferredFulfillingWarehouseId = body.fulfillingWarehouseId || "";

    for (const sr of stockRequests) {
      if (!sr.fulfilling_warehouse_id || !sr.requesting_warehouse_id) {
        return NextResponse.json({ error: "Stock request warehouse mapping is incomplete" }, { status: 400 });
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
        uom_id,
        requested_qty,
        received_qty,
        items(item_code, item_name)
      `
      )
      .in("id", body.items.map((line) => line.srItemId));

    if (!requestItems || requestItems.length !== body.items.length) {
      return NextResponse.json({ error: "One or more stock request items are invalid" }, { status: 400 });
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
      .in("sr_item_id", body.items.map((line) => line.srItemId));

    const allocatedByItem = new Map<string, number>();
    for (const existing of existingDnItems || []) {
      const dnHeader = Array.isArray(existing.delivery_notes)
        ? existing.delivery_notes[0]
        : existing.delivery_notes;
      if (!dnHeader || ["voided", "received"].includes(dnHeader.status)) continue;
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
        return NextResponse.json({ error: `Invalid stock request item ${line.srItemId}` }, { status: 400 });
      }

      if (srItem.item_id !== line.itemId || srItem.uom_id !== line.uomId) {
        return NextResponse.json(
          { error: `Item/UOM mismatch for stock request item ${line.srItemId}` },
          { status: 400 }
        );
      }

      const allocatedQty = toNumber(line.allocatedQty);
      if (allocatedQty <= 0) {
        return NextResponse.json({ error: "Allocated quantity must be greater than zero" }, { status: 400 });
      }

      const alreadyAllocated = allocatedByItem.get(line.srItemId) || 0;
      const maxAllocatable = Math.max(
        0,
        toNumber(srItem.requested_qty) - toNumber(srItem.received_qty) - alreadyAllocated
      );
      if (allocatedQty > maxAllocatable) {
        const itemRef = Array.isArray(srItem.items) ? srItem.items[0] : srItem.items;
        const itemLabel = itemRef?.item_name || itemRef?.item_code || line.itemId;
        const requestedQty = toNumber(srItem.requested_qty);
        const receivedQty = toNumber(srItem.received_qty);
        return NextResponse.json(
          {
            error: `Allocated quantity (${allocatedQty}) exceeds available quantity (${maxAllocatable}) for ${itemLabel}. Requested: ${requestedQty}, received: ${receivedQty}, already allocated in other active DNs: ${alreadyAllocated}.`,
          },
          { status: 400 }
        );
      }
    }

    const dnNo = buildDnNo();
    const nowIso = new Date().toISOString();

    const { data: dn, error: createError } = await auth.supabase
      .from("delivery_notes")
      .insert({
        company_id: auth.companyId,
        business_unit_id: auth.currentBusinessUnitId,
        dn_no: dnNo,
        status: "draft",
        requesting_warehouse_id: inferredRequestingWarehouseId,
        fulfilling_warehouse_id: inferredFulfillingWarehouseId,
        notes: body.notes?.trim() || null,
        driver_name: body.driverName?.trim() || null,
        created_by: auth.userId,
        updated_by: auth.userId,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id")
      .single();

    if (createError || !dn) {
      return NextResponse.json({ error: createError?.message || "Failed to create delivery note" }, { status: 500 });
    }

    const dnSources = distinctSrIds.map((srId) => ({
      company_id: auth.companyId,
      dn_id: dn.id,
      sr_id: srId,
      created_at: nowIso,
    }));

    const { error: sourceError } = await auth.supabase.from("delivery_note_sources").insert(dnSources);
    if (sourceError) {
      return NextResponse.json({ error: sourceError.message }, { status: 500 });
    }

    const dnItems = body.items.map((line) => {
      const sr = requestMap.get(line.srId)!;
      return {
        company_id: auth.companyId,
        dn_id: dn.id,
        sr_id: line.srId,
        sr_item_id: line.srItemId,
        item_id: line.itemId,
        uom_id: line.uomId,
        requesting_warehouse_id: sr.requesting_warehouse_id,
        fulfilling_warehouse_id: sr.fulfilling_warehouse_id,
        allocated_qty: toNumber(line.allocatedQty),
        picked_qty: 0,
        short_qty: toNumber(line.allocatedQty),
        dispatched_qty: 0,
        created_at: nowIso,
        updated_at: nowIso,
      };
    });

    const { error: itemError } = await auth.supabase.from("delivery_note_items").insert(dnItems);
    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }

    const created = await fetchDeliveryNote(auth.supabase, auth.companyId, dn.id);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
