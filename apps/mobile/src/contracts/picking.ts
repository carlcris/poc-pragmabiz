export type PickListSummary = {
  id: string;
  code: string;
  status: string;
  priority: string;
  zone: string | null;
  lines: number;
  pickedLines: number;
  assignedTo: string | null;
  assignees: {
    id: string;
    firstName: string;
    initials: string;
    color: string;
  }[];
  requiredDate: string | null;
  deliveryNoteCode?: string | null;
};

export type PickListItem = {
  id: string;
  pickListItemId: string;
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
