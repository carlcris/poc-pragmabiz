import { apiRequest } from "@/api/client";
import type {
  DeliveryNoteDetail,
  DeliveryNoteSummary,
  GrnDetail,
  GrnLine,
  LoadListDetail,
  LoadListReceivingDetail,
  LoadListSummary,
  ReceivingLine,
  RecordDeliveryNoteReceivingScanResult,
  RecordDeliveryNoteReceivingScanPayload,
  SubmitDeliveryNoteReceivingPayload
} from "@/contracts/receiving";
import { asArray, asRecord, firstRecord, maybeStr, num, str } from "@/utils/record";

type ListResponse = {
  data?: unknown;
};

const normalizeLoadList = (value: unknown): LoadListSummary => {
  const record = asRecord(value);
  const supplier = asRecord(record.supplier);
  return {
    id: str(record.id),
    llNumber: str(record.llNumber || record.ll_number),
    status: str(record.status, "unknown"),
    supplierName: str(supplier.name || supplier.supplier_name, "Unknown supplier"),
    estimatedArrivalDate: maybeStr(record.estimatedArrivalDate || record.estimated_arrival_date),
    itemCount: num(record.itemCount || record.item_count || asArray(record.items).length)
  };
};

const normalizeLoadListDetail = (value: unknown): LoadListDetail => {
  const record = asRecord(value);
  const summary = normalizeLoadList(record);
  const warehouse = asRecord(record.warehouse);
  return {
    ...summary,
    supplierLlNumber: maybeStr(record.supplierLlNumber || record.supplier_ll_number),
    warehouseName: maybeStr(warehouse.name || warehouse.warehouse_name),
    actualArrivalDate: maybeStr(record.actualArrivalDate || record.actual_arrival_date),
    containerNumber: maybeStr(record.containerNumber || record.container_number),
    sealNumber: maybeStr(record.sealNumber || record.seal_number),
    batchNumber: maybeStr(record.batchNumber || record.batch_number)
  };
};

const normalizeGrnLine = (value: unknown): GrnLine => {
  const record = asRecord(value);
  const item = asRecord(record.item);
  const unitOption = asRecord(record.itemUnitOption || record.item_unit_option);
  return {
    id: str(record.id),
    itemName: str(record.itemName || record.item_name || item.name || item.item_name, "Unnamed item"),
    itemCode: str(record.itemCode || record.item_code || item.code || item.item_code),
    unitLabel: str(unitOption.displayLabel || unitOption.display_label || unitOption.optionLabel || unitOption.option_label, "unit"),
    expectedQty: num(record.loadListQty || record.load_list_qty),
    expectedBaseQty: num(record.expectedBaseQty || record.expected_base_qty || record.loadListQty || record.load_list_qty),
    receivedQty: num(record.receivedQty || record.received_qty),
    damagedQty: num(record.damagedQty || record.damaged_qty),
    boxCount: num(record.numBoxes || record.num_boxes),
    notes: maybeStr(record.notes)
  };
};

const normalizeGrn = (value: unknown): GrnDetail => {
  const record = asRecord(value);
  return {
    id: str(record.id),
    grnNumber: str(record.grnNumber || record.grn_number),
    status: str(record.status, "unknown"),
    receivingDate: maybeStr(record.receivingDate || record.receiving_date),
    deliveryDate: maybeStr(record.deliveryDate || record.delivery_date),
    items: asArray(record.items).map(normalizeGrnLine)
  };
};

const normalizeReceivingLine = (value: unknown): ReceivingLine => {
  const record = asRecord(value);
  const item = firstRecord(record.item || record.items);
  const unitOption = firstRecord(record.itemUnitOption || record.item_unit_option || record.item_unit_options);
  const unitOptionUnit = firstRecord(unitOption.units_of_measure);
  const unit = firstRecord(record.unit || record.units_of_measure);
  const allocatedQty = num(
    record.dispatchedQty ||
      record.dispatched_qty ||
      record.allocatedQty ||
      record.allocated_qty ||
      record.quantity
  );
  const receivedQty = num(record.receivedQty || record.received_qty || record.receivedQuantity);
  const varianceQty = num(record.receivingVarianceQty || record.receiving_variance_qty, receivedQty - allocatedQty);

  return {
    id: str(record.id || record.delivery_note_item_id),
    itemId: str(record.itemId || record.item_id || item.id),
    itemUnitOptionId: maybeStr(
      record.itemUnitOptionId ||
        record.item_unit_option_id ||
        unitOption.id
    ),
    name: str(record.itemName || record.item_name || item.item_name || item.name, "Unnamed item"),
    code: str(record.itemCode || record.item_code || item.item_code || item.code),
    barcode: maybeStr(record.barcode || unitOption.barcode),
    suggestedBatchLocationSku: maybeStr(
      record.suggestedBatchLocationSku ||
        record.suggested_batch_location_sku
    ),
    uom: str(
      record.uomLabel ||
        record.uom_label ||
        record.uomSymbol ||
        record.uom_symbol ||
        unitOption.option_label ||
        unitOptionUnit.symbol ||
        unitOptionUnit.name ||
        unit.symbol ||
        unit.name,
      "unit"
    ),
    allocatedQty,
    receivedQty,
    varianceQty,
    receivingStatus: str(record.receivingStatus || record.receiving_status, varianceQty === 0 ? "exact" : varianceQty < 0 ? "short" : "over")
  };
};

const extractDeliveryItems = (record: Record<string, unknown>) =>
  asArray(record.items || record.deliveryNoteItems || record.delivery_note_items).map(
    normalizeReceivingLine
  );

const normalizeDeliveryNote = (value: unknown): DeliveryNoteSummary => {
  const record = asRecord(value);
  const items = extractDeliveryItems(record);
  const totalQty =
    num(record.totalQty || record.total_qty || record.allocatedQty || record.allocated_qty) ||
    items.reduce((sum, item) => sum + item.allocatedQty, 0);
  const receivedQty =
    num(record.receivedQty || record.received_qty || record.receivedQuantity) ||
    items.reduce((sum, item) => sum + item.receivedQty, 0);

  return {
    id: str(record.id),
    code: str(record.dnNo || record.dn_no || record.code),
    status: str(record.status, "unknown"),
    fulfillmentMode: str(record.fulfillmentMode || record.fulfillment_mode, "Warehouse Transfer"),
    dispatchedAt: maybeStr(record.dispatchedAt || record.dispatched_at),
    receivingStartedAt: maybeStr(record.receivingStartedAt || record.receiving_started_at),
    receivedQty,
    totalQty
  };
};

const normalizeDeliveryDetail = (value: unknown): DeliveryNoteDetail => {
  const record = asRecord(value);
  const summary = normalizeDeliveryNote(record);
  return {
    ...summary,
    notes: maybeStr(record.notes),
    items: extractDeliveryItems(record)
  };
};

const normalizeReceivingScanResult = (
  value: unknown
): RecordDeliveryNoteReceivingScanResult => {
  const record = asRecord(value);
  return {
    type: str(record.type),
    scanId: maybeStr(record.scanId || record.scan_id),
    exceptionId: maybeStr(record.exceptionId || record.exception_id),
    deliveryNoteItemId: maybeStr(record.deliveryNoteItemId || record.delivery_note_item_id),
    isUnexpected: record.isUnexpected === true || record.is_unexpected === true,
    isOverReceived: record.isOverReceived === true || record.is_over_received === true
  };
};

export const listLoadLists = async (status: string, search: string) => {
  const response = await apiRequest<ListResponse>("/api/load-lists", {
    query: { status, search, page: 1, limit: 20 }
  });
  return asArray(response.data).map(normalizeLoadList);
};

export const getLoadListReceiving = async (
  id: string
): Promise<LoadListReceivingDetail> => {
  const loadListResponse = await apiRequest<unknown>(`/api/load-lists/${id}`);
  const grnsResponse = await apiRequest<ListResponse>("/api/grns", {
    query: { load_list_id: id, page: 1, limit: 1 }
  });
  const grnSummary = firstRecord(grnsResponse.data);
  const grn = grnSummary.id
    ? normalizeGrn(await apiRequest<unknown>(`/api/grns/${String(grnSummary.id)}`))
    : null;

  return {
    loadList: normalizeLoadListDetail(loadListResponse),
    grn
  };
};

export const listDeliveryNotes = async (status: string, search: string) => {
  const response = await apiRequest<ListResponse>("/api/delivery-notes", {
    query: { status: status === "all" ? undefined : status, search }
  });
  return asArray(response.data).map(normalizeDeliveryNote);
};

export const getDeliveryNote = async (id: string) => {
  const response = await apiRequest<ListResponse | unknown>(`/api/delivery-notes/${id}`);
  return normalizeDeliveryDetail(asRecord(response).data || response);
};

export const startReceiving = (id: string) =>
  apiRequest<{ data?: unknown }>(`/api/delivery-notes/${id}/start-receiving`, {
    method: "POST"
  });

export const recordDeliveryNoteReceivingScan = async (
  id: string,
  data: RecordDeliveryNoteReceivingScanPayload
) => {
  const response = await apiRequest<{ result?: unknown; deliveryNote?: unknown }>(
    `/api/delivery-notes/${id}/receiving-scans`,
    {
      method: "POST",
      body: data
    }
  );

  return {
    result: normalizeReceivingScanResult(response.result),
    deliveryNote: normalizeDeliveryDetail(response.deliveryNote)
  };
};

export const submitReceiving = async (
  id: string,
  data: SubmitDeliveryNoteReceivingPayload
) => {
  const response = await apiRequest<unknown>(`/api/delivery-notes/${id}/submit-receiving`, {
    method: "POST",
    body: data
  });

  return normalizeDeliveryDetail(asRecord(response).data || response);
};
