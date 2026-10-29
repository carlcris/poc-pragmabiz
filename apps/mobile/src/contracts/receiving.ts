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
  destinationBusinessUnitName: string | null;
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

export type UpdateGrnLinePayload = {
  id: string;
  receivedQty: number;
  damagedQty: number;
  numBoxes: number;
  notes?: string;
};

export type UpdateGrnReceivingPayload = {
  receivingDate?: string;
  notes?: string;
  items: UpdateGrnLinePayload[];
};

export type SubmitGrnReceivingPayload = {
  notes?: string;
  receivingPatch?: UpdateGrnReceivingPayload;
};

export type GrnDetail = {
  id: string;
  grnNumber: string;
  status: string;
  warehouseId: string | null;
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
  latestActiveScanId: string | null;
};

export type ReceivingUnexpectedItemStatus = "pending_review" | "accepted" | "resolved";

export type ReceivingUnexpectedItem = {
  itemId: string;
  itemUnitOptionId: string | null;
  name: string;
  code: string;
  uom: string;
  status: ReceivingUnexpectedItemStatus;
  scannedQty: number;
  exceptionIds: string[];
  latestExceptionId: string;
};

export type DeliveryNoteDetail = DeliveryNoteSummary & {
  sourceBusinessUnitName: string | null;
  notes: string | null;
  items: ReceivingLine[];
  unexpectedItems: ReceivingUnexpectedItem[];
};

export type ReceivingWarehouseOption = {
  id: string;
  code: string;
  name: string;
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

export type ResolvedDeliveryNoteReceivingItem = {
  itemId: string;
  itemUnitOptionId: string | null;
  batchNumber: string | null;
  locationId: string | null;
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

export type ReceivingInboxStage =
  | "ready"
  | "in_progress"
  | "expected"
  | "awaiting_approval"
  | "completed";

export type ReceivingInboxStageFilter = ReceivingInboxStage | "to_receive" | "all";

export type ReceivingInboxDocumentKind = "load_list" | "delivery_note";

export type ReceivingInboxKindFilter = ReceivingInboxDocumentKind | "all";

export type ReceivingInboxRow = {
  kind: ReceivingInboxDocumentKind;
  id: string;
  code: string;
  counterpartyName: string | null;
  status: string;
  stage: ReceivingInboxStage;
  expectedAt: string | null;
  completedAt: string | null;
  lineCount: number;
  doneQty: number | null;
  totalQty: number | null;
};

export type ReceivingInboxStageCount = {
  stage: ReceivingInboxStage;
  kind: ReceivingInboxDocumentKind;
  count: number;
};

export type ReceivingInboxPage = {
  rows: ReceivingInboxRow[];
  stageCounts: ReceivingInboxStageCount[];
  access: {
    loadLists: boolean;
    deliveryNotes: boolean;
  };
  page: number;
  totalPages: number;
  total: number;
};
