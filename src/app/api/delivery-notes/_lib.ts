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
  requesting_business_unit_id: string;
  fulfilling_business_unit_id: string;
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
  requesting_warehouse_id: string | null;
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
  requesting_warehouse_id: string | null;
  fulfilling_warehouse_id: string;
  item_id: string;
  item_unit_option_id?: string | null;
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
  requesting_business_unit_id: string;
  fulfilling_business_unit_id: string;
  fulfilling_business_unit?:
    | {
        id: string;
        code: string;
        name: string;
      }
    | {
        id: string;
        code: string;
        name: string;
      }[]
    | null;
  requesting_business_unit?:
    | {
        id: string;
        code: string;
        name: string;
      }
    | {
        id: string;
        code: string;
        name: string;
      }[]
    | null;
  requesting_warehouse_id: string | null;
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

const DELIVERY_NOTE_HEADER_COLUMNS = `
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
  updated_at
`;

const DELIVERY_NOTE_ITEM_COLUMNS = `
  id,
  company_id,
  dn_id,
  sr_id,
  sr_item_id,
  requesting_warehouse_id,
  fulfilling_warehouse_id,
  item_id,
  item_unit_option_id,
  uom_id,
  allocated_qty,
  picked_qty,
  short_qty,
  dispatched_qty,
  received_qty,
  receiving_discrepancy_flag,
  receiving_variance_qty,
  receiving_status,
  receiving_notes,
  receiving_overage_review_status,
  receiving_overage_posted_qty,
  receiving_overage_review_notes,
  receiving_overage_reviewed_by,
  receiving_overage_reviewed_at,
  is_voided,
  voided_at,
  voided_by,
  void_reason,
  created_at,
  updated_at
`;

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
      ${DELIVERY_NOTE_HEADER_COLUMNS},
      fulfilling_business_unit:business_units!delivery_notes_fulfilling_business_unit_id_fkey(
        id,
        code,
        name
      ),
      requesting_business_unit:business_units!delivery_notes_requesting_business_unit_id_fkey(
        id,
        code,
        name
      ),
      delivery_note_sources(company_id, dn_id, sr_id, created_at),
      delivery_note_items(
        ${DELIVERY_NOTE_ITEM_COLUMNS},
        delivery_note_item_receiving_scans(
          id,
          company_id,
          business_unit_id,
          dn_id,
          dn_item_id,
          item_id,
          item_unit_option_id,
          uom_id,
          box_id,
          qr_code,
          qr_qty,
          accepted_qty,
          adjustment_reason,
          notes,
          scanned_by,
          scanned_at,
          voided_at,
          voided_by,
          void_reason,
          created_at,
          updated_at
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
        id,
        company_id,
        business_unit_id,
        dn_id,
        item_id,
        item_unit_option_id,
        uom_id,
        box_id,
        qr_code,
        qr_qty,
        accepted_qty,
        batch_number,
        location_id,
        reason,
        notes,
        status,
        scanned_by,
        scanned_at,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at,
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
    if (
      record.requesting_business_unit_id !== currentBusinessUnitId &&
      record.fulfilling_business_unit_id !== currentBusinessUnitId
    ) {
      return null;
    }
  }

  const canViewReceivingDetails = currentBusinessUnitId
    ? record.requesting_business_unit_id === currentBusinessUnitId
    : true;
  return mapDeliveryNoteRecord(record, canViewReceivingDetails);
};

export const isReceivingBusinessUnit = (
  currentBusinessUnitId: string | null | undefined,
  requestingBusinessUnitId: string | null | undefined
) => {
  return (
    !!currentBusinessUnitId &&
    !!requestingBusinessUnitId &&
    requestingBusinessUnitId === currentBusinessUnitId
  );
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
    .select(DELIVERY_NOTE_HEADER_COLUMNS)
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
    .select(DELIVERY_NOTE_ITEM_COLUMNS)
    .eq("dn_id", id)
    .eq("company_id", companyId);

  return ((data as DeliveryNoteItemRow[] | null) || []) as DeliveryNoteItemRow[];
};
