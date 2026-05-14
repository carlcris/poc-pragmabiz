import type { ItemUnitOption } from "@/types/item";

export type DeliveryNoteStatus =
  | "draft"
  | "confirmed"
  | "queued_for_picking"
  | "picking_in_progress"
  | "dispatch_ready"
  | "dispatched"
  | "received"
  | "voided";

export type DeliveryNoteFulfillmentMode = "transfer_to_store" | "customer_pickup_from_warehouse";

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
  item_unit_option_id?: string | null;
  suggested_batch_location_sku?: string | null;
  uom_id: string;
  allocated_qty: number;
  picked_qty: number;
  short_qty: number;
  dispatched_qty: number;
  received_qty?: number;
  receiving_discrepancy_flag?: boolean;
  receiving_variance_qty?: number;
  receiving_status?: "pending" | "exact" | "short" | "over";
  receiving_notes?: string | null;
  receiving_overage_review_status?: "pending_review" | "accepted" | "rejected" | null;
  receiving_overage_posted_qty?: number;
  receiving_overage_review_notes?: string | null;
  receiving_overage_reviewed_by?: string | null;
  receiving_overage_reviewed_at?: string | null;
  is_voided?: boolean;
  voided_at?: string | null;
  voided_by?: string | null;
  void_reason?: string | null;
  created_at: string;
  updated_at: string;
  items?:
    | {
        item_name?: string | null;
        item_code?: string | null;
      }
    | {
        item_name?: string | null;
        item_code?: string | null;
      }[]
    | null;
  units_of_measure?:
    | {
        code?: string | null;
        symbol?: string | null;
        name?: string | null;
      }
    | {
        code?: string | null;
        symbol?: string | null;
        name?: string | null;
      }[]
    | null;
  item_unit_options?: ItemUnitOption | ItemUnitOption[] | null;
  stock_requests?:
    | {
        request_code?: string | null;
      }
    | {
        request_code?: string | null;
      }[]
    | null;
  stock_request_items?:
    | {
        item_unit_options?: ItemUnitOption | ItemUnitOption[] | null;
      }
    | {
        item_unit_options?: ItemUnitOption | ItemUnitOption[] | null;
      }[]
    | null;
  delivery_note_item_receiving_scans?: DeliveryNoteReceivingScan[];
};

export type DeliveryNoteReceivingScan = {
  id: string;
  company_id: string;
  business_unit_id: string | null;
  dn_id: string;
  dn_item_id: string;
  item_id: string;
  item_unit_option_id: string | null;
  uom_id: string;
  box_id: string;
  qr_code: string;
  qr_qty: number;
  accepted_qty: number;
  adjustment_reason: string | null;
  notes: string | null;
  scanned_by: string;
  scanned_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type DeliveryNoteReceivingException = {
  id: string;
  company_id: string;
  business_unit_id: string | null;
  dn_id: string;
  item_id: string;
  item_unit_option_id: string | null;
  uom_id: string;
  box_id: string;
  qr_code: string;
  qr_qty: number;
  accepted_qty: number;
  batch_number: string | null;
  location_id: string | null;
  reason: string | null;
  notes: string | null;
  status: "pending_review" | "accepted" | "rejected" | "resolved";
  scanned_by: string;
  scanned_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  items?:
    | {
        item_name?: string | null;
        item_code?: string | null;
      }
    | {
        item_name?: string | null;
        item_code?: string | null;
      }[]
    | null;
  units_of_measure?:
    | {
        code?: string | null;
        symbol?: string | null;
        name?: string | null;
      }
    | {
        code?: string | null;
        symbol?: string | null;
        name?: string | null;
      }[]
    | null;
  item_unit_options?: ItemUnitOption | ItemUnitOption[] | null;
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
  fulfillment_mode?: DeliveryNoteFulfillmentMode;
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
  delivery_note_sources?: DeliveryNoteSource[];
  delivery_note_items?: DeliveryNoteItem[];
  delivery_note_receiving_exceptions?: DeliveryNoteReceivingException[];
  can_view_receiving_details?: boolean;
  pick_lists?: DeliveryNotePickListSummary[];
};

export type DeliveryNoteListResponse = {
  data: DeliveryNote[];
};

export type DeliveryNoteListParams = {
  status?: string;
  requestingWarehouseId?: string;
  search?: string;
};

export type CreateDeliveryNotePayload = {
  srIds: string[];
  requestingWarehouseId?: string;
  fulfillingWarehouseId?: string;
  fulfillmentMode?: DeliveryNoteFulfillmentMode;
  notes?: string;
  driverName?: string;
  items: Array<{
    srId: string;
    srItemId: string;
    itemId: string;
    itemUnitOptionId?: string;
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
  helperName?: string;
  deliveryTime?: string;
  plateNumber?: string;
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

export type ReceiveDirectPickupDeliveryNotePayload = Omit<ReceiveDeliveryNotePayload, "items"> & {
  confirmDirectCustomerPickup?: boolean;
  items?: Array<{
    deliveryNoteItemId: string;
    receivedQty: number;
  }>;
};

export type RecordDeliveryNoteReceivingScanPayload = {
  qrCode: string;
  boxId: string;
  itemId?: string | null;
  itemUnitOptionId?: string | null;
  qty: number;
  acceptedQty?: number | null;
  adjustmentReason?: string | null;
  notes?: string | null;
  batchNumber?: string | null;
  locationId?: string | null;
};

export type RecordDeliveryNoteReceivingScanResponse = {
  result: {
    type: "scan" | "exception";
    scanId?: string;
    exceptionId?: string;
    deliveryNoteItemId?: string;
    isUnexpected: boolean;
    isOverReceived?: boolean;
  };
  deliveryNote: DeliveryNote;
};

export type SubmitDeliveryNoteReceivingPayload = {
  receivedDate?: string;
  notes?: string;
  acknowledgeDiscrepancy?: boolean;
  discrepancyNotes?: string;
};

export type ReviewDeliveryNoteReceivingExceptionPayload = {
  notes?: string | null;
};

export type ReviewDeliveryNoteReceivingOveragePayload = {
  notes?: string | null;
};

export type AdjustDispatchedDeliveryNoteItemPayload = {
  dispatchedQty: number;
  reason?: string;
};

export type AddDeliveryNoteItemsPayload = {
  pickerUserIds: string[];
  notes?: string;
  items: Array<{
    srId: string;
    srItemId: string;
    itemId: string;
    itemUnitOptionId?: string;
    uomId: string;
    allocatedQty: number;
  }>;
};

export type DeliveryNoteAllocatableItem = {
  srId: string;
  srItemId: string;
  requestCode: string;
  itemId: string;
  itemCode: string | null;
  itemName: string | null;
  itemUnitOptionId?: string | null;
  uomId: string;
  uomLabel: string | null;
  requestedQty: number;
  receivedQty: number;
  allocatedInOtherDns: number;
  allocatableQty: number;
};
