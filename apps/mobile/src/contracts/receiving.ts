export type LoadListSummary = {
  id: string;
  llNumber: string;
  status: string;
  supplierName: string;
  estimatedArrivalDate: string | null;
  itemCount: number;
};

export type LoadListDetail = LoadListSummary & {
  supplierLlNumber: string | null;
  warehouseName: string | null;
  actualArrivalDate: string | null;
  containerNumber: string | null;
  sealNumber: string | null;
  batchNumber: string | null;
};

export type GrnLine = {
  id: string;
  itemName: string;
  itemCode: string;
  unitLabel: string;
  expectedQty: number;
  expectedBaseQty: number;
  receivedQty: number;
  damagedQty: number;
  boxCount: number;
  notes: string | null;
};

export type GrnDetail = {
  id: string;
  grnNumber: string;
  status: string;
  receivingDate: string | null;
  deliveryDate: string | null;
  items: GrnLine[];
};

export type LoadListReceivingDetail = {
  loadList: LoadListDetail;
  grn: GrnDetail | null;
};

export type DeliveryNoteSummary = {
  id: string;
  code: string;
  status: string;
  fulfillmentMode: string;
  dispatchedAt: string | null;
  receivingStartedAt: string | null;
  receivedQty: number;
  totalQty: number;
};

export type ReceivingLine = {
  id: string;
  itemId: string;
  itemUnitOptionId: string | null;
  name: string;
  code: string;
  barcode: string | null;
  suggestedBatchLocationSku: string | null;
  uom: string;
  allocatedQty: number;
  receivedQty: number;
  varianceQty: number;
  receivingStatus: string;
};

export type DeliveryNoteDetail = DeliveryNoteSummary & {
  notes: string | null;
  items: ReceivingLine[];
};

export type RecordDeliveryNoteReceivingScanPayload = {
  qrCode: string;
  boxId: string;
  itemId?: string | null;
  itemUnitOptionId?: string | null;
  qty: number;
  batchNumber?: string | null;
  locationId?: string | null;
};

export type RecordDeliveryNoteReceivingScanResult = {
  type: string;
  scanId: string | null;
  exceptionId: string | null;
  deliveryNoteItemId: string | null;
  isUnexpected: boolean;
  isOverReceived: boolean;
};

export type SubmitDeliveryNoteReceivingPayload = {
  receivedDate?: string;
  notes?: string;
  acknowledgeDiscrepancy?: boolean;
  discrepancyNotes?: string;
};
