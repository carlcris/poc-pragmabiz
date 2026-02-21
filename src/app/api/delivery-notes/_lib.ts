import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextResponse } from "next/server";
import { requireRequestContext } from "@/lib/auth/requestContext";

type AuthContext = {
  supabase: Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"];
  userId: string;
  companyId: string;
  currentBusinessUnitId: string | null;
};

type DeliveryNoteRow = {
  id: string;
  company_id: string;
  business_unit_id: string | null;
  dn_no: string;
  status:
    | "draft"
    | "confirmed"
    | "queued_for_picking"
    | "picking_in_progress"
    | "dispatch_ready"
    | "dispatched"
    | "received"
    | "voided";
  requesting_warehouse_id: string;
  fulfilling_warehouse_id: string;
  confirmed_at: string | null;
  picking_started_at: string | null;
  picking_started_by: string | null;
  picking_completed_at: string | null;
  picking_completed_by: string | null;
  dispatched_at: string | null;
  received_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  driver_name: string | null;
  driver_signature: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
};

type DeliveryNoteItemRow = {
  id: string;
  dn_id: string;
  sr_id: string;
  sr_item_id: string;
  requesting_warehouse_id: string;
  fulfilling_warehouse_id: string;
  item_id: string;
  uom_id: string;
  allocated_qty: number | string;
  picked_qty: number | string;
  short_qty: number | string;
  dispatched_qty: number | string;
};

type DeliveryNoteWithRelations = {
  requesting_warehouse_id: string;
  fulfilling_warehouse_id: string;
  delivery_note_items?: Array<
    DeliveryNoteItemRow & {
      items?: unknown;
      units_of_measure?: unknown;
      stock_requests?: unknown;
    }
  > | null;
  [key: string]: unknown;
};

export const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const buildDnNo = () => {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");
  const suffix = now.getTime().toString().slice(-5);
  return `DN-${dateStr}${suffix}`;
};

export const getAuthContext = async (): Promise<AuthContext | NextResponse> => {
  const context = await requireRequestContext();
  if ("status" in context) return context;

  return {
    supabase: context.supabase,
    userId: context.userId,
    companyId: context.companyId,
    currentBusinessUnitId: context.currentBusinessUnitId,
  };
};

export const fetchDeliveryNote = async (
  supabase: AuthContext["supabase"],
  companyId: string,
  id: string
) => {
  const { data, error } = await supabase
    .from("delivery_notes")
    .select(
      `
      *,
      delivery_note_sources(*),
      delivery_note_items(
        *,
        items!delivery_note_items_item_id_fkey(item_name, item_code),
        units_of_measure!delivery_note_items_uom_id_fkey(symbol, name),
        stock_requests!delivery_note_items_sr_id_fkey(request_code)
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
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;
  return mapDeliveryNoteRecord(data as DeliveryNoteWithRelations);
};

export const mapDeliveryNoteRecord = <T extends DeliveryNoteWithRelations>(record: T) => {
  const mappedItems = (record.delivery_note_items || []).map((item) => ({
    ...item,
    requesting_warehouse_id: item.requesting_warehouse_id,
    fulfilling_warehouse_id: item.fulfilling_warehouse_id,
  }));

  return {
    ...record,
    requesting_warehouse_id: record.requesting_warehouse_id,
    fulfilling_warehouse_id: record.fulfilling_warehouse_id,
    delivery_note_items: mappedItems,
  };
};

export const fetchDeliveryNoteHeader = async (
  supabase: AuthContext["supabase"],
  companyId: string,
  id: string
) => {
  const { data } = await supabase
    .from("delivery_notes")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single();

  return (data as DeliveryNoteRow | null) ?? null;
};

export const fetchDeliveryNoteItems = async (
  supabase: AuthContext["supabase"],
  companyId: string,
  id: string
) => {
  const { data } = await supabase
    .from("delivery_note_items")
    .select("*")
    .eq("dn_id", id)
    .eq("company_id", companyId);

  return ((data as DeliveryNoteItemRow[] | null) || []) as DeliveryNoteItemRow[];
};

export const computeStockRequestDerivedStatus = async (
  supabase: AuthContext["supabase"],
  companyId: string,
  stockRequestId: string
) => {
  const { data: request } = await supabase
    .from("stock_requests")
    .select("id, status")
    .eq("id", stockRequestId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single();

  if (!request) return null;

  const { data: requestItems } = await supabase
    .from("stock_request_items")
    .select("id, requested_qty, received_qty")
    .eq("stock_request_id", stockRequestId);

  const { data: dnItems } = await supabase
    .from("delivery_note_items")
    .select(
      `
      allocated_qty,
      dispatched_qty,
      delivery_notes!inner(status)
    `
    )
    .eq("company_id", companyId)
    .eq("sr_id", stockRequestId);

  const totalRequested = (requestItems || []).reduce(
    (sum, item) => sum + toNumber(item.requested_qty),
    0
  );
  const totalReceived = (requestItems || []).reduce(
    (sum, item) => sum + toNumber(item.received_qty),
    0
  );

  const activeDnItems = (dnItems || []).filter((item) => {
    const dnHeader = Array.isArray(item.delivery_notes) ? item.delivery_notes[0] : item.delivery_notes;
    return dnHeader?.status !== "voided";
  });

  const totalAllocated = activeDnItems.reduce((sum, item) => sum + toNumber(item.allocated_qty), 0);
  const totalDispatched = activeDnItems.reduce((sum, item) => sum + toNumber(item.dispatched_qty), 0);
  const hasNonVoidedDn = activeDnItems.length > 0;

  let derivedStatus: string;
  if (totalRequested > 0 && totalReceived >= totalRequested) {
    derivedStatus = "fulfilled";
  } else if (totalReceived > 0) {
    derivedStatus = "partially_fulfilled";
  } else if (totalDispatched > 0) {
    derivedStatus = "dispatched";
  } else if (totalRequested > 0 && totalAllocated >= totalRequested) {
    derivedStatus = "allocated";
  } else if (totalAllocated > 0) {
    derivedStatus = "partially_allocated";
  } else if (hasNonVoidedDn) {
    derivedStatus = "allocating";
  } else if (request.status === "draft") {
    derivedStatus = "draft";
  } else {
    derivedStatus = "submitted";
  }

  return {
    stockRequestId,
    cachedStatus: request.status,
    derivedStatus,
    totals: {
      totalRequested,
      totalAllocated,
      totalDispatched,
      totalReceived,
    },
  };
};

export const syncStockRequestStatusCache = async (
  supabase: AuthContext["supabase"],
  companyId: string,
  stockRequestIds: string[],
  userId?: string
) => {
  const uniqueIds = Array.from(new Set(stockRequestIds.filter(Boolean)));
  for (const stockRequestId of uniqueIds) {
    const projection = await computeStockRequestDerivedStatus(supabase, companyId, stockRequestId);
    if (!projection) continue;

    const nextStatus = projection.derivedStatus || projection.cachedStatus || "submitted";
    const patch: { status: string; updated_at: string; updated_by?: string; received_at?: string; received_by?: string } =
      {
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };

    if (userId) {
      patch.updated_by = userId;
    }

    if (nextStatus === "partially_fulfilled" || nextStatus === "fulfilled") {
      patch.received_at = new Date().toISOString();
      if (userId) patch.received_by = userId;
    }

    const { error } = await supabase
      .from("stock_requests")
      .update(patch)
      .eq("id", stockRequestId)
      .eq("company_id", companyId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Failed to sync stock request ${stockRequestId} status: ${error.message}`);
    }
  }
};
