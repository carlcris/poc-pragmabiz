export type PickSourceResolution = {
  batchLocationSku: string;
  source: {
    itemId: string;
    warehouseId: string;
    warehouseName: string;
    locationId: string;
    locationCode: string;
    locationName: string;
    batchCode: string;
    batchReceivedAt: string;
    qtyOnHand: number;
    availableBaseQty: number;
  };
  line: {
    pickListItemId: string;
    deliveryNoteItemId: string;
    remainingQty: number;
    remainingBaseQty: number;
    maxPickQty: number;
    allocatedQty: number;
    pickedQty: number;
  };
  isMismatch: boolean;
};

export type PickSourceResult =
  | { kind: "resolved"; resolution: PickSourceResolution }
  | { kind: "choose_location"; sources: PickSourceResolution[]; page: number; hasMore: boolean };
