import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { fetchDeliveryNote, fetchDeliveryNoteHeader, getAuthContext, toNumber } from "../../_lib";
import { createPickListForDn } from "@/app/api/pick-lists/_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type AddDeliveryNoteItemsBody = {
  pickerUserIds?: string[];
  notes?: string;
  items?: Array<{
    srId: string;
    srItemId: string;
    itemId: string;
    uomId: string;
    allocatedQty: number;
  }>;
};

// POST /api/delivery-notes/[id]/items
export async function POST(request: NextRequest, context: RouteContext) {
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
        { error: "Items can only be added after dispatch while the delivery note is in dispatched status" },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as AddDeliveryNoteItemsBody;
    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    const pickerUserIds = Array.from(new Set((body.pickerUserIds || []).map((row) => row.trim()).filter(Boolean)));
    if (pickerUserIds.length === 0) {
      return NextResponse.json({ error: "At least one picker must be assigned" }, { status: 400 });
    }

    const { data: existingDnItems, error: existingDnItemsError } = await auth.supabase
      .from("delivery_note_items")
      .select("sr_item_id")
      .eq("company_id", auth.companyId)
      .eq("dn_id", id);

    if (existingDnItemsError) {
      return NextResponse.json({ error: existingDnItemsError.message }, { status: 500 });
    }

    const existingSrItemIds = new Set((existingDnItems || []).map((row) => row.sr_item_id));
    const duplicateInputSrItemIds = body.items
      .map((item) => item.srItemId)
      .filter((srItemId, index, arr) => arr.indexOf(srItemId) !== index);

    if (duplicateInputSrItemIds.length > 0) {
      return NextResponse.json({ error: "Duplicate stock request items are not allowed" }, { status: 400 });
    }

    for (const line of body.items) {
      if (existingSrItemIds.has(line.srItemId)) {
        return NextResponse.json(
          { error: `Stock request item ${line.srItemId} is already linked to this delivery note` },
          { status: 400 }
        );
      }
    }

    const distinctSrIds = Array.from(new Set(body.items.map((item) => item.srId)));

    const { data: stockRequests, error: stockRequestsError } = await auth.supabase
      .from("stock_requests")
      .select("id, status, request_code, requesting_warehouse_id, fulfilling_warehouse_id")
      .in("id", distinctSrIds)
      .eq("company_id", auth.companyId)
      .is("deleted_at", null);

    if (stockRequestsError) {
      return NextResponse.json({ error: stockRequestsError.message }, { status: 500 });
    }

    if (!stockRequests || stockRequests.length !== distinctSrIds.length) {
      return NextResponse.json({ error: "One or more stock requests are invalid" }, { status: 400 });
    }

    const requestMap = new Map(stockRequests.map((row) => [row.id, row]));
    for (const stockRequest of stockRequests) {
      if (
        stockRequest.requesting_warehouse_id !== header.requesting_warehouse_id ||
        stockRequest.fulfilling_warehouse_id !== header.fulfilling_warehouse_id
      ) {
        return NextResponse.json(
          { error: "Stock request warehouse mapping must match the delivery note" },
          { status: 400 }
        );
      }

      if (["draft", "cancelled", "completed", "fulfilled"].includes(stockRequest.status)) {
        return NextResponse.json(
          { error: `Stock request ${stockRequest.request_code || stockRequest.id} is not allocatable` },
          { status: 400 }
        );
      }
    }

    const { data: requestItems, error: requestItemsError } = await auth.supabase
      .from("stock_request_items")
      .select(
        `
        id,
        stock_request_id,
        item_id,
        uom_id,
        requested_qty,
        received_qty,
        items(item_name, item_code)
      `
      )
      .in("id", body.items.map((line) => line.srItemId));

    if (requestItemsError) {
      return NextResponse.json({ error: requestItemsError.message }, { status: 500 });
    }

    if (!requestItems || requestItems.length !== body.items.length) {
      return NextResponse.json({ error: "One or more stock request items are invalid" }, { status: 400 });
    }

    const requestItemMap = new Map(requestItems.map((row) => [row.id, row]));

    const { data: otherAllocations, error: otherAllocationsError } = await auth.supabase
      .from("delivery_note_items")
      .select(
        `
        sr_item_id,
        allocated_qty,
        is_voided,
        delivery_notes!inner(id, status)
      `
      )
      .eq("company_id", auth.companyId)
      .in("sr_item_id", body.items.map((line) => line.srItemId));

    if (otherAllocationsError) {
      return NextResponse.json({ error: otherAllocationsError.message }, { status: 500 });
    }

    const allocatedByItem = new Map<string, number>();
    for (const existing of otherAllocations || []) {
      const dnHeader = Array.isArray(existing.delivery_notes)
        ? existing.delivery_notes[0]
        : existing.delivery_notes;
      if (!dnHeader || ["voided", "received"].includes(dnHeader.status) || existing.is_voided) continue;
      const prior = allocatedByItem.get(existing.sr_item_id) || 0;
      allocatedByItem.set(existing.sr_item_id, prior + toNumber(existing.allocated_qty));
    }

    for (const line of body.items) {
      const sr = requestMap.get(line.srId);
      const srItem = requestItemMap.get(line.srItemId);
      if (!sr || !srItem || srItem.stock_request_id !== line.srId) {
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
        return NextResponse.json(
          {
            error: `Allocated quantity (${allocatedQty}) exceeds available quantity (${maxAllocatable}) for ${itemLabel}.`,
          },
          { status: 400 }
        );
      }
    }

    const nowIso = new Date().toISOString();
    const insertedLineIds: string[] = [];

    const { error: sourceError } = await auth.supabase.from("delivery_note_sources").upsert(
      distinctSrIds.map((srId) => ({
        company_id: auth.companyId,
        dn_id: id,
        sr_id: srId,
        created_at: nowIso,
      })),
      { onConflict: "dn_id,sr_id", ignoreDuplicates: true }
    );

    if (sourceError) {
      return NextResponse.json({ error: sourceError.message }, { status: 500 });
    }

    const insertPayload = body.items.map((line) => ({
      company_id: auth.companyId,
      dn_id: id,
      sr_id: line.srId,
      sr_item_id: line.srItemId,
      item_id: line.itemId,
      uom_id: line.uomId,
      requesting_warehouse_id: header.requesting_warehouse_id,
      fulfilling_warehouse_id: header.fulfilling_warehouse_id,
      allocated_qty: toNumber(line.allocatedQty),
      picked_qty: 0,
      short_qty: toNumber(line.allocatedQty),
      dispatched_qty: 0,
      created_at: nowIso,
      updated_at: nowIso,
    }));

    const { data: insertedItems, error: itemInsertError } = await auth.supabase
      .from("delivery_note_items")
      .insert(insertPayload)
      .select("id");

    if (itemInsertError || !insertedItems) {
      return NextResponse.json(
        { error: itemInsertError?.message || "Failed to add delivery note items" },
        { status: 500 }
      );
    }

    insertedLineIds.push(...insertedItems.map((row) => row.id));

    const { error: reserveError } = await auth.supabase.rpc("reserve_delivery_note_inventory_lines", {
      p_company_id: auth.companyId,
      p_user_id: auth.userId,
      p_dn_id: id,
      p_line_ids: insertedLineIds,
    });

    if (reserveError) {
      await auth.supabase
        .from("delivery_note_items")
        .delete()
        .eq("company_id", auth.companyId)
        .eq("dn_id", id)
        .in("id", insertedLineIds);
      return NextResponse.json({ error: reserveError.message }, { status: 400 });
    }

    try {
      await createPickListForDn({
        supabase: auth.supabase,
        companyId: auth.companyId,
        userId: auth.userId,
        currentBusinessUnitId: auth.currentBusinessUnitId,
        dnId: id,
        dnBusinessUnitId: header.business_unit_id,
        fulfillingWarehouseId: header.fulfilling_warehouse_id,
        pickerUserIds,
        notes: body.notes?.trim() || null,
      });
    } catch (createPickListError) {
      const message =
        createPickListError instanceof Error
          ? createPickListError.message
          : "Items were added, but the pick list could not be created";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const dn = await fetchDeliveryNote(auth.supabase, auth.companyId, id);
    return NextResponse.json(dn);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
