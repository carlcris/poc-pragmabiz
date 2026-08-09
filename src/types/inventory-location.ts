export type ItemLocationBatch = {
  id: string;
  batchCode: string;
  receivedAt: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
};

export type ItemLocation = {
  id: string;
  itemId: string;
  warehouseId: string;
  locationId: string;
  warehouseCode: string;
  warehouseName: string;
  locationCode: string;
  locationName: string;
  locationType: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  maxQuantity?: number | null;
  isDefault?: boolean;
  defaultLocationId?: string | null;
  batches?: ItemLocationBatch[];
};

export type WarehouseLocation = {
  id: string;
  companyId: string;
  warehouseId: string;
  code: string;
  name?: string | null;
  parentId?: string | null;
  locationType: string;
  isPickable: boolean;
  isStorable: boolean;
  isActive: boolean;
  maxCapacity?: number | null;
  usedCapacity?: number;
  utilizationPercent?: number;
  capacityStatus?:
    | "not_storable"
    | "not_configured"
    | "empty"
    | "partial"
    | "full"
    | "over_capacity";
  createdAt: string;
  updatedAt: string;
};
