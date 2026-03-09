import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { fetchDeliveryNoteHeader, getAuthContext, toNumber } from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/delivery-notes/[id]/allocatable-items
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "view");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const header = await fetchDeliveryNoteHeader(auth.supabase, auth.companyId, id);
    if (!header) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
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
        dispatch_qty,
        items(item_code, item_name),
        units_of_measure(symbol, name),
        stock_requests!inner(
          id,
          request_code,
          status,
          requesting_warehouse_id,
          fulfilling_warehouse_id
        )
      `
      )
      .eq("stock_requests.company_id", auth.companyId)
      .eq("stock_requests.requesting_warehouse_id", header.requesting_warehouse_id)
      .eq("stock_requests.fulfilling_warehouse_id", header.fulfilling_warehouse_id)
      .not("stock_requests.status", "in", "(draft,cancelled,completed,fulfilled)")
      .order("created_at", { ascending: true });

    if (requestItemsError) {
      return NextResponse.json({ error: requestItemsError.message }, { status: 500 });
    }

    const candidateSrItemIds = (requestItems || [])
      .map((row) => row.id as string)
      .filter((rowId) => !existingSrItemIds.has(rowId));

    if (candidateSrItemIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

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
      .in("sr_item_id", candidateSrItemIds);

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

    const data = (requestItems || [])
      .filter((row) => !existingSrItemIds.has(row.id as string))
      .map((row) => {
        const request = Array.isArray(row.stock_requests) ? row.stock_requests[0] : row.stock_requests;
        const item = Array.isArray(row.items) ? row.items[0] : row.items;
        const uom = Array.isArray(row.units_of_measure) ? row.units_of_measure[0] : row.units_of_measure;
        const allocatedInOtherDns = allocatedByItem.get(row.id as string) || 0;
        const allocatableQty = Math.max(
          0,
          toNumber(row.requested_qty) - toNumber(row.received_qty) - allocatedInOtherDns
        );

        return {
          srId: row.stock_request_id,
          srItemId: row.id,
          requestCode: request?.request_code || "",
          itemId: row.item_id,
          itemCode: item?.item_code || null,
          itemName: item?.item_name || null,
          uomId: row.uom_id,
          uomLabel: uom?.symbol || uom?.name || null,
          requestedQty: toNumber(row.requested_qty),
          receivedQty: toNumber(row.received_qty),
          allocatedInOtherDns,
          allocatableQty,
        };
      })
      .filter((row) => row.allocatableQty > 0);

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
