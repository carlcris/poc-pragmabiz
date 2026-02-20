export type DeliveryNoteStatus =
  | "draft"
  | "confirmed"
  | "queued_for_picking"
  | "picking_in_progress"
  | "dispatch_ready"
  | "dispatched"
  | "received"
  | "voided";

export type DeliveryNoteSource = {
  company_id: string;
  dn_id: string;
  sr_id: string;
  created_at: string;
};

export type DeliveryNoteItem = {
  id: string;
  company_id: string;
  dn_id: string;
  sr_id: string;
  sr_item_id: string;
  requesting_warehouse_id: string;
  fulfilling_warehouse_id: string;
  item_id: string;
  uom_id: string;
  allocated_qty: number;
  picked_qty: number;
  short_qty: number;
  dispatched_qty: number;
  created_at: string;
  updated_at: string;
  items?: {
    item_name?: string | null;
    item_code?: string | null;
  } | {
    item_name?: string | null;
    item_code?: string | null;
  }[] | null;
  units_of_measure?: {
    code?: string | null;
    symbol?: string | null;
    name?: string | null;
  } | {
    code?: string | null;
    symbol?: string | null;
    name?: string | null;
  }[] | null;
  stock_requests?: {
    request_code?: string | null;
  } | {
    request_code?: string | null;
  }[] | null;
};

export type DeliveryNotePickListSummary = {
  id: string;
  pick_list_no: string;
  status: "pending" | "in_progress" | "paused" | "cancelled" | "done";
  created_at: string;
  deleted_at?: string | null;
};

export type DeliveryNote = {
  id: string;
  company_id: string;
  business_unit_id: string | null;
  dn_no: string;
  status: DeliveryNoteStatus;
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
  delivery_note_sources?: DeliveryNoteSource[];
  delivery_note_items?: DeliveryNoteItem[];
  pick_lists?: DeliveryNotePickListSummary[];
};

export type DeliveryNoteListResponse = {
  data: DeliveryNote[];
};

export type CreateDeliveryNotePayload = {
  srIds: string[];
  requestingWarehouseId?: string;
  fulfillingWarehouseId?: string;
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

export type MarkDispatchReadyPayload = {
  items: Array<{
    deliveryNoteItemId: string;
    pickedQty: number;
  }>;
};

export type DispatchDeliveryNotePayload = {
  driverName?: string;
  driverSignature?: string;
  dispatchDate?: string;
  notes?: string;
  items?: Array<{
    deliveryNoteItemId: string;
    dispatchQty: number;
  }>;
};

export type ReceiveDeliveryNotePayload = {
  receivedDate?: string;
  notes?: string;
  items?: Array<{
    deliveryNoteItemId: string;
    receivedQty: number;
    locationId?: string | null;
  }>;
};
