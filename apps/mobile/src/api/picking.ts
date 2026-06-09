import { apiRequest } from "@/api/client";
import type { PickListDetail, PickListItem, PickListSummary } from "@/contracts/picking";
import { asArray, asRecord, firstRecord, maybeStr, num, str } from "@/utils/record";

type ListResponse = {
  data?: unknown;
};

export type PickSourceResolution = {
  batchLocationSku: string;
  source: {
    itemId: string;
    locationId: string;
    locationCode: string | null;
    locationName: string | null;
    batchCode: string;
    batchReceivedAt: string;
  };
  line: {
    pickListItemId: string;
    deliveryNoteItemId: string;
    remainingQty: number;
    allocatedQty: number;
    pickedQty: number;
    item?: {
      barcode?: string | null;
      itemName?: string | null;
      itemCode?: string | null;
    } | null;
  } | null;
  isMismatch: boolean;
};

const normalizePickItem = (value: unknown): PickListItem => {
  const record = asRecord(value);
  const item = firstRecord(record.item || record.items);
  const unitOption = firstRecord(record.itemUnitOption || record.item_unit_option || record.item_unit_options);
  const unit = firstRecord(record.uom || record.unit || record.units_of_measure);
  const location = firstRecord(record.location || record.warehouse_location || record.warehouse_locations);
  const batch = firstRecord(record.batch || record.item_batches);
  const source = firstRecord(record.source || record.source_location);
  const dnLine = firstRecord(record.deliveryNoteItem || record.delivery_note_item || record.delivery_note_items);

  return {
    id: str(record.id || record.pickListItemId || record.pick_list_item_id),
    deliveryNoteItemId: str(
      record.deliveryNoteItemId || record.delivery_note_item_id || record.dnItemId || record.dn_item_id
    ),
    itemId: str(record.itemId || record.item_id || item.id),
    name: str(record.itemName || record.item_name || item.item_name || item.name, "Unnamed item"),
    code: str(record.itemCode || record.item_code || item.item_code || item.code),
    barcode: maybeStr(record.barcode || record.locationSku || record.location_sku || unitOption.barcode),
    sourceSku: maybeStr(
      record.batchLocationSku ||
        record.batch_location_sku ||
        record.suggestedBatchLocationSku ||
        record.suggested_batch_location_sku ||
        dnLine.suggested_batch_location_sku ||
        source.batch_location_sku
    ),
    sourceLocationId: maybeStr(
      record.pickedLocationId ||
        record.picked_location_id ||
        record.suggestedPickLocationId ||
        record.suggested_pick_location_id ||
        dnLine.suggested_pick_location_id ||
        source.location_id
    ),
    sourceBatchReceivedAt: maybeStr(
      record.pickedBatchReceivedAt ||
        record.picked_batch_received_at ||
        record.suggestedPickBatchReceivedAt ||
        record.suggested_pick_batch_received_at ||
        dnLine.suggested_pick_batch_received_at ||
        source.batch_received_at
    ),
    uom: str(record.uom || record.uomSymbol || unit.symbol || unit.name, "unit"),
    requiredQty: num(
      record.requiredQty ||
        record.required_qty ||
        record.allocatedQty ||
        record.allocated_qty ||
        record.pickQty ||
        record.pick_qty
    ),
    pickedQty: num(record.pickedQty || record.picked_qty),
    locationName: maybeStr(record.locationName || location.name || location.code),
    batchNumber: maybeStr(record.batchNumber || record.batch_number || batch.batch_number)
  };
};

const normalizePickDetail = (value: unknown): PickListDetail => {
  const record = asRecord(value);
  const deliveryNote = firstRecord(record.deliveryNote || record.delivery_note || record.delivery_notes);
  const items = asArray(record.items || record.pickListItems || record.pick_list_items).map(
    normalizePickItem
  );

  return {
    id: str(record.id),
    code: str(record.code || record.pickListNo || record.pick_list_no || record.request_code),
    status: str(record.status, "unknown"),
    lines: num(record.lines || items.length),
    assignedTo: maybeStr(record.assignedTo || record.assigned_to || record.created_by_email),
    requiredDate: maybeStr(record.requiredDate || record.required_date || record.created_at),
    deliveryNoteCode: maybeStr(
      record.deliveryNoteCode || record.delivery_note_code || deliveryNote.dn_no || deliveryNote.code
    ),
    items
  };
};

export const listPickLists = async (params: {
  search?: string;
  status?: string;
}): Promise<PickListSummary[]> => {
  const response = await apiRequest<ListResponse | unknown>("/api/pick-lists", {
    query: {
      status: params.status && params.status !== "all" ? params.status : undefined
    }
  });
  const rows = asArray(asRecord(response).data || response);
  const needle = (params.search || "").trim().toLowerCase();

  return rows
    .map((value) => {
      const record = asRecord(value);
      const deliveryNote = firstRecord(record.delivery_notes || record.deliveryNote || record.delivery_note);
      const assignees = asArray(record.pick_list_assignees || record.assignees);
      const assignedTo =
        assignees
          .map((assigneeValue) => {
            const assignee = asRecord(assigneeValue);
            const user = firstRecord(assignee.users || assignee.user);
            return (
              str(
                [maybeStr(user.first_name), maybeStr(user.last_name)].filter(Boolean).join(" "),
                ""
              ) ||
              maybeStr(user.email) ||
              maybeStr(assignee.user_id)
            );
          })
          .filter(Boolean)
          .join(", ") || null;

      return {
        id: str(record.id),
        code: str(record.pick_list_no || record.code || record.request_code, "Pick list"),
        status: str(record.status, "unknown"),
        lines: asArray(record.pick_list_items || record.items).length,
        assignedTo,
        requiredDate: maybeStr(record.created_at || record.requiredDate || record.required_date),
        deliveryNoteCode: maybeStr(deliveryNote.dn_no || deliveryNote.code)
      };
    })
    .filter((item) => {
      if (!needle) return true;
      return `${item.code} ${item.status} ${item.assignedTo || ""} ${item.deliveryNoteCode || ""}`
        .toLowerCase()
        .includes(needle);
    });
};

export const getPickList = async (id: string) => {
  const response = await apiRequest<ListResponse | unknown>(`/api/pick-lists/${id}`);
  return normalizePickDetail(asRecord(response).data || response);
};

export const resolvePickSource = async (
  id: string,
  query: {
    batchLocationSku: string;
    itemId?: string | null;
    locationId?: string | null;
    batchCode?: string | null;
  }
): Promise<PickSourceResolution | null> => {
  const response = await apiRequest<ListResponse | unknown>(`/api/pick-lists/${id}/scan-source`, {
    query
  });
  const payload = asRecord(response);
  const data = asRecord(payload.data);
  if (!data || Object.keys(data).length === 0) return null;

  const source = asRecord(data.source);
  const line = asRecord(data.line);
  const item = asRecord(line.item);

  return {
    batchLocationSku: str(data.batchLocationSku || data.batch_location_sku),
    source: {
      itemId: str(source.itemId || source.item_id),
      locationId: str(source.locationId || source.location_id),
      locationCode: maybeStr(source.locationCode || source.location_code),
      locationName: maybeStr(source.locationName || source.location_name),
      batchCode: str(source.batchCode || source.batch_code),
      batchReceivedAt: str(source.batchReceivedAt || source.batch_received_at)
    },
    line: Object.keys(line).length
      ? {
          pickListItemId: str(line.pickListItemId || line.pick_list_item_id),
          deliveryNoteItemId: str(line.deliveryNoteItemId || line.delivery_note_item_id),
          remainingQty: num(line.remainingQty || line.remaining_qty),
          allocatedQty: num(line.allocatedQty || line.allocated_qty),
          pickedQty: num(line.pickedQty || line.picked_qty),
          item: Object.keys(item).length
            ? {
                barcode: maybeStr(item.barcode),
                itemName: maybeStr(item.itemName || item.item_name),
                itemCode: maybeStr(item.itemCode || item.item_code)
              }
            : null
        }
      : null,
    isMismatch: Boolean(data.isMismatch || data.is_mismatch)
  };
};

export const setPickListStatus = async (id: string, status: "in_progress" | "paused" | "done") => {
  const response = await apiRequest<ListResponse | unknown>(`/api/pick-lists/${id}/status`, {
    method: "PATCH",
    body: { status }
  });
  return normalizePickDetail(asRecord(response).data || response);
};

export const updatePickedItems = async (
  id: string,
  items: {
    deliveryNoteItemId: string;
    pickedQty: number;
    batchLocationSku?: string | null;
    pickedLocationId?: string | null;
    pickedBatchCode?: string | null;
    pickedBatchReceivedAt?: string | null;
  }[]
) => {
  const response = await apiRequest<ListResponse | unknown>(`/api/pick-lists/${id}/items`, {
    method: "PATCH",
    body: {
      pickRows: items.map((item) => ({
        deliveryNoteItemId: item.deliveryNoteItemId,
        batchLocationSku: item.batchLocationSku || undefined,
        pickedLocationId: item.pickedLocationId || "",
        pickedBatchCode: item.pickedBatchCode || "",
        pickedBatchReceivedAt: item.pickedBatchReceivedAt || "",
        pickedQty: item.pickedQty,
        isMismatchWarningAcknowledged: false,
        mismatchReason: null
      }))
    }
  });
  return normalizePickDetail(asRecord(response).data || response);
};
