import type { PickSourceResult } from "../../../../src/types/pick-source";
import { getPickingUnitLabel } from "../../../../src/lib/picking-quantities";
import { apiRequest } from "@/api/client";
import type {
  PickListDetail,
  PickListItem,
  PickListItemClaim,
  PickListSummary,
  PickedLocation,
} from "@/contracts/picking";
import { asArray, asRecord, firstRecord, maybeStr, num, str } from "@/utils/record";
import { summarizePickProgress } from "./pick-progress";

type ListResponse = {
  data?: unknown;
};

export type { PickSourceResolution, PickSourceResult } from "../../../../src/types/pick-source";

export type PickLocationMap = {
  warehouse: {
    id: string;
    name: string;
  };
  location: {
    id: string;
    code: string;
    name: string | null;
  };
  map: {
    id: string;
    floorNumber: number;
    name: string;
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
    version: number;
  };
  racks: {
    warehouseLocationId: string;
    code: string;
    name: string | null;
    xBasisPoints: number;
    yBasisPoints: number;
    widthBasisPoints: number;
    heightBasisPoints: number;
  }[];
  highlight: {
    xBasisPoints: number;
    yBasisPoints: number;
    widthBasisPoints: number;
    heightBasisPoints: number;
  };
};

const ASSIGNEE_COLORS = ["#6366F1", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#06B6D4"];

const pickListPriorityLabel = (status: string) => {
  if (status === "in_progress") return "ACTIVE";
  if (status === "pending") return "PENDING";
  if (status === "done") return "DONE";
  return status.toUpperCase();
};

const initialsFor = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const pickRowTotals = (value: unknown) => {
  const byPickListItem = new Map<string, number>();
  for (const pickRowValue of asArray(value)) {
    const pickRow = asRecord(pickRowValue);
    const pickListItemId = maybeStr(
      pickRow.pickListItemId || pickRow.pick_list_item_id || pickRow.lineId || pickRow.line_id
    );
    const pickedQty = num(pickRow.pickedQty || pickRow.picked_qty);
    if (pickListItemId) {
      byPickListItem.set(pickListItemId, (byPickListItem.get(pickListItemId) || 0) + pickedQty);
    }
  }
  return byPickListItem;
};

const normalizePickItem = (
  value: unknown,
  pickedQtyOverride: number | undefined,
  pickedLocations: PickedLocation[]
): PickListItem => {
  const record = asRecord(value);
  const item = firstRecord(record.item || record.items);
  const unitOption = firstRecord(
    record.itemUnitOption || record.item_unit_option || record.item_unit_options
  );
  const unit = firstRecord(record.uom || record.unit || record.units_of_measure);
  const location = firstRecord(
    record.location ||
      record.warehouse_location ||
      record.warehouse_locations ||
      record.suggestedPickLocation ||
      record.suggested_pick_location
  );
  const warehouse = firstRecord(location.warehouse || location.warehouses);
  const batch = firstRecord(record.batch || record.item_batches);
  const source = firstRecord(record.source || record.source_location);
  const dnLine = firstRecord(
    record.deliveryNoteItem || record.delivery_note_item || record.delivery_note_items
  );
  const pickListItemId = str(
    record.pickListItemId ||
      record.pick_list_item_id ||
      record.lineId ||
      record.line_id ||
      record.id
  );
  const unitLabel = str(record.uom || record.uomSymbol || unit.symbol || unit.name, "unit");

  return {
    id: pickListItemId,
    pickListItemId,
    deliveryNoteItemId: str(
      record.deliveryNoteItemId ||
        record.delivery_note_item_id ||
        record.dnItemId ||
        record.dn_item_id
    ),
    itemId: str(record.itemId || record.item_id || item.id),
    name: str(record.itemName || record.item_name || item.item_name || item.name, "Unnamed item"),
    code: str(record.itemCode || record.item_code || item.item_code || item.code),
    barcode: maybeStr(
      record.barcode || record.locationSku || record.location_sku || unitOption.barcode
    ),
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
    sourceWarehouseCode: maybeStr(
      record.sourceWarehouseCode ||
        record.source_warehouse_code ||
        warehouse.warehouseCode ||
        warehouse.warehouse_code
    ),
    sourceLocationCode: maybeStr(
      record.sourceLocationCode ||
        record.source_location_code ||
        record.locationCode ||
        record.location_code ||
        location.code
    ),
    sourceBatchReceivedAt: maybeStr(
      record.pickedBatchReceivedAt ||
        record.picked_batch_received_at ||
        record.suggestedPickBatchReceivedAt ||
        record.suggested_pick_batch_received_at ||
        dnLine.suggested_pick_batch_received_at ||
        source.batch_received_at
    ),
    uom: getPickingUnitLabel(
      unitLabel,
      num(unitOption.qty_per_unit, 1),
      maybeStr(unitOption.option_label)
    ),
    requiredQty: num(
      record.requiredQty ||
        record.required_qty ||
        record.allocatedQty ||
        record.allocated_qty ||
        record.pickQty ||
        record.pick_qty
    ),
    pickedQty: pickedQtyOverride ?? num(record.pickedQty || record.picked_qty),
    pickedLocations,
    locationName: maybeStr(record.locationName || location.name || location.code),
    locationPath: maybeStr(location.location_path),
    locationNamePath: maybeStr(location.location_name_path),
    batchNumber:
      maybeStr(record.batchNumber || record.batch_number || batch.batch_number) ||
      maybeStr(
        record.pickedBatchCode ||
          record.picked_batch_code ||
          record.suggestedPickBatchCode ||
          record.suggested_pick_batch_code ||
          source.batch_code
      ),
  };
};

type PickRowInput = {
  pickListItemId: string;
  deliveryNoteItemId: string;
  pickedQty: number;
  batchLocationSku?: string | null;
  pickedLocationId?: string | null;
  pickedBatchCode?: string | null;
  pickedBatchReceivedAt?: string | null;
  isMismatchWarningAcknowledged?: boolean;
  mismatchReason?: string | null;
};

export type RecordPickProgressInput = {
  pickListItemId: string;
  operationId: string;
  pickedQty: number;
  batchLocationSku?: string | null;
  pickedLocationId?: string | null;
  pickedBatchCode?: string | null;
  pickedBatchReceivedAt?: string | null;
  isMismatchWarningAcknowledged?: boolean;
  mismatchReason?: string | null;
};

const toPickRows = (items: PickRowInput[]) =>
  items.map((item) => {
    const pickListItemId = item.pickListItemId.trim();
    if (!pickListItemId) {
      throw new Error("Pick list item id is required.");
    }

    return {
      pickListItemId,
      deliveryNoteItemId: item.deliveryNoteItemId,
      batchLocationSku: item.batchLocationSku || undefined,
      pickedLocationId: item.pickedLocationId || "",
      pickedBatchCode: item.pickedBatchCode || "",
      pickedBatchReceivedAt: item.pickedBatchReceivedAt || "",
      pickedQty: item.pickedQty,
      isMismatchWarningAcknowledged: item.isMismatchWarningAcknowledged ?? false,
      mismatchReason: item.mismatchReason?.trim() || null,
    };
  });

const normalizePickDetail = (value: unknown): PickListDetail => {
  const record = asRecord(value);
  const deliveryNote = firstRecord(
    record.deliveryNote || record.delivery_note || record.delivery_notes
  );
  const pickRows = asArray(record.deliveryNoteItemPicks || record.delivery_note_item_picks);
  const progressByLine = summarizePickProgress(pickRows);
  const items = asArray(record.items || record.pickListItems || record.pick_list_items).map(
    (itemValue) => {
      const itemRecord = asRecord(itemValue);
      const pickListItemId = str(
        itemRecord.id || itemRecord.pickListItemId || itemRecord.pick_list_item_id
      );
      const progress = progressByLine.get(pickListItemId);
      return normalizePickItem(itemValue, progress?.pickedQty, [
        ...(progress?.locations.values() ?? []),
      ]);
    }
  );
  const claims = asArray(record.pickListItemClaims || record.pick_list_item_claims)
    .map((claimValue): PickListItemClaim | null => {
      const claim = asRecord(claimValue);
      const user = firstRecord(claim.users || claim.user);
      const expiresAt = str(claim.expiresAt || claim.expires_at);
      const releasedAt = maybeStr(claim.releasedAt || claim.released_at);
      if (releasedAt) return null;
      if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) return null;
      const claimedByName =
        [maybeStr(user.first_name), maybeStr(user.last_name)].filter(Boolean).join(" ") ||
        maybeStr(user.email) ||
        "Picker";
      return {
        pickListItemId: str(claim.pickListItemId || claim.pick_list_item_id),
        claimedBy: str(claim.claimedBy || claim.claimed_by),
        claimedByName,
        expiresAt,
      };
    })
    .filter((claim): claim is PickListItemClaim => claim !== null && !!claim.pickListItemId);

  return {
    id: str(record.id),
    code: str(record.code || record.pickListNo || record.pick_list_no || record.request_code),
    status: str(record.status, "unknown"),
    priority: pickListPriorityLabel(str(record.status, "unknown")),
    zone: null,
    lines: num(record.lines || items.length),
    pickedLines: items.filter((item) => item.pickedQty > 0).length,
    assignedTo: maybeStr(record.assignedTo || record.assigned_to || record.created_by_email),
    assignees: [],
    requiredDate: maybeStr(record.requiredDate || record.required_date || record.created_at),
    deliveryNoteCode: maybeStr(
      record.deliveryNoteCode ||
        record.delivery_note_code ||
        deliveryNote.dn_no ||
        deliveryNote.code
    ),
    items,
    claims,
  };
};

export const listPickLists = async (params: {
  search?: string;
  status?: string;
}): Promise<PickListSummary[]> => {
  const response = await apiRequest<ListResponse | unknown>("/api/pick-lists", {
    query: {
      status: params.status && params.status !== "all" ? params.status : undefined,
      search: params.search?.trim() || undefined,
      limit: 50,
    },
  });
  const rows = asArray(asRecord(response).data || response);

  return rows.map((value) => {
    const record = asRecord(value);
    const deliveryNote = firstRecord(
      record.delivery_notes || record.deliveryNote || record.delivery_note
    );
    const fulfillingWarehouse = firstRecord(
      deliveryNote.fulfilling_warehouse || deliveryNote.fulfillingWarehouse
    );
    const assignees = asArray(record.pick_list_assignees || record.assignees);
    const mappedAssignees = assignees
      .map((assigneeValue, index) => {
        const assignee = asRecord(assigneeValue);
        const user = firstRecord(assignee.users || assignee.user);
        const fullName =
          [maybeStr(user.first_name), maybeStr(user.last_name)].filter(Boolean).join(" ") ||
          maybeStr(user.email) ||
          maybeStr(assignee.user_id) ||
          "Picker";

        return {
          id: str(user.id || assignee.user_id || `${record.id}-${index}`),
          firstName: fullName.split(/\s+/)[0] || fullName,
          initials: initialsFor(fullName),
          color: ASSIGNEE_COLORS[index % ASSIGNEE_COLORS.length],
        };
      })
      .filter((assignee) => assignee.id);
    const assignedTo = mappedAssignees.map((assignee) => assignee.firstName).join(", ") || null;
    const items = asArray(record.pick_list_items || record.items);
    const totalsByPickListItem = pickRowTotals(
      record.delivery_note_item_picks || record.deliveryNoteItemPicks
    );
    const pickedLines = items.filter((itemValue) => {
      const itemRecord = asRecord(itemValue);
      const pickListItemId = str(
        itemRecord.id || itemRecord.pickListItemId || itemRecord.pick_list_item_id
      );
      return (
        (totalsByPickListItem.get(pickListItemId) ??
          num(itemRecord.picked_qty || itemRecord.pickedQty)) > 0
      );
    }).length;

    return {
      id: str(record.id),
      code: str(record.pick_list_no || record.code || record.request_code, "Pick list"),
      status: str(record.status, "unknown"),
      priority: pickListPriorityLabel(str(record.status, "unknown")),
      zone: maybeStr(
        fulfillingWarehouse.warehouse_name ||
          fulfillingWarehouse.warehouseName ||
          fulfillingWarehouse.warehouse_code ||
          fulfillingWarehouse.warehouseCode
      ),
      lines: items.length,
      pickedLines,
      assignedTo,
      assignees: mappedAssignees,
      requiredDate: maybeStr(record.created_at || record.requiredDate || record.required_date),
      deliveryNoteCode: maybeStr(deliveryNote.dn_no || deliveryNote.code),
    };
  });
};

export const getPickList = async (id: string) => {
  const response = await apiRequest<ListResponse | unknown>(`/api/pick-lists/${id}`);
  return normalizePickDetail(asRecord(response).data || response);
};

export const getPickLocationMap = async (
  pickListId: string,
  pickListItemId: string
): Promise<PickLocationMap> => {
  const response = await apiRequest<ListResponse | unknown>(
    `/api/pick-lists/${pickListId}/items/${pickListItemId}/location-map`
  );
  const data = asRecord(asRecord(response).data || response);
  const warehouse = asRecord(data.warehouse);
  const location = asRecord(data.location);
  const map = asRecord(data.map);
  const racks = asArray(data.racks).map((value) => {
    const rack = asRecord(value);

    return {
      warehouseLocationId: str(rack.warehouseLocationId),
      code: str(rack.code),
      name: maybeStr(rack.name) || null,
      xBasisPoints: num(rack.xBasisPoints),
      yBasisPoints: num(rack.yBasisPoints),
      widthBasisPoints: num(rack.widthBasisPoints),
      heightBasisPoints: num(rack.heightBasisPoints),
    };
  });
  const highlight = asRecord(data.highlight);

  return {
    warehouse: {
      id: str(warehouse.id),
      name: str(warehouse.name),
    },
    location: {
      id: str(location.id),
      code: str(location.code),
      name: maybeStr(location.name),
    },
    map: {
      id: str(map.id),
      floorNumber: num(map.floorNumber),
      name: str(map.name),
      imageUrl: str(map.imageUrl || map.image_url),
      imageWidth: num(map.imageWidth || map.image_width),
      imageHeight: num(map.imageHeight || map.image_height),
      version: num(map.version),
    },
    racks,
    highlight: {
      xBasisPoints: num(highlight.xBasisPoints || highlight.x_basis_points),
      yBasisPoints: num(highlight.yBasisPoints || highlight.y_basis_points),
      widthBasisPoints: num(highlight.widthBasisPoints || highlight.width_basis_points),
      heightBasisPoints: num(highlight.heightBasisPoints || highlight.height_basis_points),
    },
  };
};

export const resolvePickSource = async (
  id: string,
  query: { itemId: string; batchCode: string; locationId?: string; page?: number }
): Promise<PickSourceResult> => {
  const response = await apiRequest<{ data: PickSourceResult }>(
    `/api/pick-lists/${id}/scan-source`,
    {
      query,
    }
  );
  return response.data;
};

export const setPickListStatus = async (id: string, status: "in_progress" | "paused" | "done") => {
  const response = await apiRequest<ListResponse | unknown>(`/api/pick-lists/${id}/status`, {
    method: "PATCH",
    body: { status },
  });
  return normalizePickDetail(asRecord(response).data || response);
};

export const updatePickedItems = async (id: string, items: PickRowInput[]) => {
  const response = await apiRequest<ListResponse | unknown>(`/api/pick-lists/${id}/items`, {
    method: "PATCH",
    body: {
      pickRows: toPickRows(items),
    },
  });
  return normalizePickDetail(asRecord(response).data || response);
};

export const recordPickProgress = async (id: string, item: RecordPickProgressInput) => {
  const response = await apiRequest<ListResponse | unknown>(`/api/pick-lists/${id}/record-pick`, {
    method: "POST",
    body: {
      pickListItemId: item.pickListItemId,
      operationId: item.operationId,
      pickedQty: item.pickedQty,
      batchLocationSku: item.batchLocationSku,
      isMismatchWarningAcknowledged: item.isMismatchWarningAcknowledged,
      mismatchReason: item.mismatchReason,
    },
  });
  return normalizePickDetail(asRecord(response).data || response);
};

export const claimPickListItem = async (id: string, pickListItemId: string) => {
  const response = await apiRequest<{ expiresAt?: unknown }>(`/api/pick-lists/${id}/claim`, {
    method: "POST",
    body: { pickListItemId },
  });
  return str(response.expiresAt);
};

export const releasePickListItem = async (id: string, pickListItemId: string) => {
  await apiRequest<void>(`/api/pick-lists/${id}/claim`, {
    method: "DELETE",
    body: { pickListItemId },
  });
};

export const completePickList = async (id: string) => {
  const response = await apiRequest<ListResponse | unknown>(`/api/pick-lists/${id}/complete`, {
    method: "POST",
    body: {
      pickRows: [],
    },
  });
  return normalizePickDetail(asRecord(response).data || response);
};
