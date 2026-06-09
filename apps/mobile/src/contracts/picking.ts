export type PickListSummary = {
  id: string;
  code: string;
  status: string;
  lines: number;
  assignedTo: string | null;
  requiredDate: string | null;
  deliveryNoteCode?: string | null;
};

export type PickListItem = {
  id: string;
  deliveryNoteItemId: string;
  itemId: string;
  name: string;
  code: string;
  barcode: string | null;
  sourceSku: string | null;
  sourceLocationId: string | null;
  sourceBatchReceivedAt: string | null;
  uom: string;
  requiredQty: number;
  pickedQty: number;
  locationName: string | null;
  batchNumber: string | null;
};

export type PickListDetail = PickListSummary & {
  deliveryNoteCode: string | null;
  items: PickListItem[];
};
