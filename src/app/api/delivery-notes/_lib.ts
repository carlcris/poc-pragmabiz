import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextResponse } from "next/server";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { getWarehouseBusinessUnitMap } from "@/app/api/_lib/workflow-notifications";

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
  fulfillment_mode: "transfer_to_store" | "customer_pickup_from_warehouse";
  confirmed_at: string | null;
  picking_started_at: string | null;
  picking_started_by: string | null;
  picking_completed_at: string | null;
  picking_completed_by: string | null;
  dispatched_at: string | null;
  received_at: string | null;
  receiving_started_at?: string | null;
  receiving_started_by?: string | null;
  receiving_completed_at?: string | null;
  receiving_completed_by?: string | null;
  received_by?: string | null;
  receiving_notes?: string | null;
  receiving_has_discrepancy?: boolean;
  receiving_discrepancy_notes?: string | null;
  voided_at: string | null;
  void_reason: string | null;
  driver_name: string | null;
  driver_signature: string | null;
  helper_name: string | null;
  delivery_time: string | null;
  plate_number: string | null;
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
  item_unit_option_id?: string | null;
  suggested_batch_location_sku?: string | null;
  uom_id: string;
  allocated_qty: number | string;
  picked_qty: number | string;
  short_qty: number | string;
  dispatched_qty: number | string;
  received_qty?: number | string;
  receiving_discrepancy_flag?: boolean;
  receiving_variance_qty?: number | string;
  receiving_status?: "pending" | "exact" | "short" | "over";
  receiving_notes?: string | null;
  receiving_overage_review_status?: "pending_review" | "accepted" | "rejected" | null;
  receiving_overage_posted_qty?: number | string;
  receiving_overage_review_notes?: string | null;
  receiving_overage_reviewed_by?: string | null;
  receiving_overage_reviewed_at?: string | null;
  is_voided?: boolean | null;
};

type DeliveryNoteWithRelations = {
  requesting_warehouse_id: string;
  fulfilling_warehouse_id: string;
  fulfillment_mode?: "transfer_to_store" | "customer_pickup_from_warehouse";
  receiving_started_at?: unknown;
  receiving_started_by?: unknown;
  receiving_completed_at?: unknown;
  receiving_completed_by?: unknown;
  received_by?: unknown;
  receiving_notes?: unknown;
  receiving_has_discrepancy?: unknown;
  receiving_discrepancy_notes?: unknown;
  delivery_note_items?: Array<
    DeliveryNoteItemRow & {
      items?: unknown;
      units_of_measure?: unknown;
      stock_requests?: unknown;
      stock_request_items?: unknown;
      delivery_note_item_receiving_scans?: unknown;
    }
  > | null;
  delivery_note_receiving_exceptions?: unknown;
  [key: string]: unknown;
};

export const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
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
  id: string,
  currentBusinessUnitId?: string | null
) => {
  const { data, error } = await supabase
    .from("delivery_notes")
    .select(
      `
      *,
      delivery_note_sources(*),
      delivery_note_items(
        *,
        delivery_note_item_receiving_scans(
          *
        ),
        items!delivery_note_items_item_id_fkey(item_name, item_code),
        units_of_measure!delivery_note_items_uom_id_fkey(code, symbol, name),
        item_unit_options!delivery_note_items_item_unit_option_id_fkey(
          id,
          item_id,
          uom_id,
          option_label,
          qty_per_unit,
          barcode,
          is_base,
          is_default,
          is_active,
          sort_order,
          units_of_measure(
            id,
            code,
            name,
            symbol
          )
        ),
        stock_requests!delivery_note_items_sr_id_fkey(request_code),
        stock_request_items!delivery_note_items_sr_item_id_fkey(
          item_unit_options(
            id,
            item_id,
            uom_id,
            option_label,
            qty_per_unit,
            barcode,
            is_base,
            is_default,
            is_active,
            sort_order,
            units_of_measure(
              id,
              code,
              name,
              symbol
            )
          )
        )
      ),
      pick_lists(
        id,
        pick_list_no,
        status,
        created_at,
        deleted_at
      ),
      delivery_note_receiving_exceptions(
        *,
        items!delivery_note_receiving_exceptions_item_id_fkey(item_name, item_code),
        units_of_measure!delivery_note_receiving_exceptions_uom_id_fkey(code, symbol, name),
        item_unit_options!delivery_note_receiving_exceptions_item_unit_option_id_fkey(
          id,
          item_id,
          uom_id,
          option_label,
          qty_per_unit,
          barcode,
          is_base,
          is_default,
          is_active,
          sort_order,
          units_of_measure(
            id,
            code,
            name,
            symbol
          )
        )
      )
    `
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;
  const record = data as DeliveryNoteWithRelations;
  if (currentBusinessUnitId) {
    const warehouseBuMap = await getWarehouseBusinessUnitMap(supabase, companyId, [
      record.requesting_warehouse_id,
      record.fulfilling_warehouse_id,
    ]);
    const requestingBusinessUnitId = warehouseBuMap.get(record.requesting_warehouse_id);
    const fulfillingBusinessUnitId = warehouseBuMap.get(record.fulfilling_warehouse_id);

    if (
      requestingBusinessUnitId !== currentBusinessUnitId &&
      fulfillingBusinessUnitId !== currentBusinessUnitId
    ) {
      return null;
    }
  }

  const canViewReceivingDetails = currentBusinessUnitId
    ? await isReceivingBusinessUnit(
        supabase,
        companyId,
        currentBusinessUnitId,
        record.requesting_warehouse_id
      )
    : true;
  return mapDeliveryNoteRecord(record, canViewReceivingDetails);
};

export const getReceivingBusinessUnitId = async (
  supabase: AuthContext["supabase"],
  companyId: string,
  requestingWarehouseId: string | null | undefined
) => {
  if (!requestingWarehouseId) return null;
  const warehouseBuMap = await getWarehouseBusinessUnitMap(supabase, companyId, [
    requestingWarehouseId,
  ]);
  return warehouseBuMap.get(requestingWarehouseId) || null;
};

export const isReceivingBusinessUnit = async (
  supabase: AuthContext["supabase"],
  companyId: string,
  currentBusinessUnitId: string | null | undefined,
  requestingWarehouseId: string | null | undefined
) => {
  if (!currentBusinessUnitId) return false;
  const receivingBusinessUnitId = await getReceivingBusinessUnitId(
    supabase,
    companyId,
    requestingWarehouseId
  );
  return receivingBusinessUnitId === currentBusinessUnitId;
};

export const mapDeliveryNoteRecord = <T extends DeliveryNoteWithRelations>(
  record: T,
  canViewReceivingDetails = true
) => {
  const mappedItems = (record.delivery_note_items || []).map((item) => ({
    ...item,
    requesting_warehouse_id: item.requesting_warehouse_id,
    fulfilling_warehouse_id: item.fulfilling_warehouse_id,
    delivery_note_item_receiving_scans: canViewReceivingDetails
      ? item.delivery_note_item_receiving_scans
      : undefined,
    received_qty: canViewReceivingDetails ? item.received_qty : undefined,
    receiving_discrepancy_flag: canViewReceivingDetails
      ? item.receiving_discrepancy_flag
      : undefined,
    receiving_variance_qty: canViewReceivingDetails ? item.receiving_variance_qty : undefined,
    receiving_status: canViewReceivingDetails ? item.receiving_status : undefined,
    receiving_notes: canViewReceivingDetails ? item.receiving_notes : undefined,
    receiving_overage_review_status: canViewReceivingDetails
      ? item.receiving_overage_review_status
      : undefined,
    receiving_overage_posted_qty: canViewReceivingDetails
      ? item.receiving_overage_posted_qty
      : undefined,
    receiving_overage_review_notes: canViewReceivingDetails
      ? item.receiving_overage_review_notes
      : undefined,
    receiving_overage_reviewed_by: canViewReceivingDetails
      ? item.receiving_overage_reviewed_by
      : undefined,
    receiving_overage_reviewed_at: canViewReceivingDetails
      ? item.receiving_overage_reviewed_at
      : undefined,
  }));

  return {
    ...record,
    receiving_started_at: canViewReceivingDetails ? record.receiving_started_at : undefined,
    receiving_started_by: canViewReceivingDetails ? record.receiving_started_by : undefined,
    receiving_completed_at: canViewReceivingDetails ? record.receiving_completed_at : undefined,
    receiving_completed_by: canViewReceivingDetails ? record.receiving_completed_by : undefined,
    received_by: canViewReceivingDetails ? record.received_by : undefined,
    receiving_notes: canViewReceivingDetails ? record.receiving_notes : undefined,
    receiving_has_discrepancy: canViewReceivingDetails
      ? record.receiving_has_discrepancy
      : undefined,
    receiving_discrepancy_notes: canViewReceivingDetails
      ? record.receiving_discrepancy_notes
      : undefined,
    requesting_warehouse_id: record.requesting_warehouse_id,
    fulfilling_warehouse_id: record.fulfilling_warehouse_id,
    delivery_note_items: mappedItems,
    delivery_note_receiving_exceptions: canViewReceivingDetails
      ? record.delivery_note_receiving_exceptions
      : undefined,
    can_view_receiving_details: canViewReceivingDetails,
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
      is_voided,
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
    const dnHeader = Array.isArray(item.delivery_notes)
      ? item.delivery_notes[0]
      : item.delivery_notes;
    return dnHeader?.status !== "voided" && !item.is_voided;
  });

  const totalAllocated = activeDnItems.reduce((sum, item) => sum + toNumber(item.allocated_qty), 0);
  const totalDispatched = activeDnItems.reduce(
    (sum, item) => sum + toNumber(item.dispatched_qty),
    0
  );
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
  } else if (
    [
      "approved",
      "allocating",
      "partially_allocated",
      "allocated",
      "dispatched",
      "partially_fulfilled",
      "fulfilled",
      "picked",
      "delivered",
      "received",
      "completed",
    ].includes(request.status)
  ) {
    // With no active DN allocations, revert allocation lifecycle back to approved.
    derivedStatus = "approved";
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
    const patch: {
      status: string;
      updated_at: string;
      updated_by?: string;
      received_at?: string;
      received_by?: string;
    } = {
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
