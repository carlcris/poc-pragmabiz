export type ItemLocationBatch = {
  id: string;
  batchCode: string;
  receivedAt: string;
  expirationDate: string | null;
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
  locationPath: string;
  locationNamePath: string;
  pathIds: string[];
  warehouseOnHand: number;
  batchCount: number;
  batchPage: number;
  batchPageSize: number;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  maxQuantity?: number | null;
  isDefault?: boolean;
  defaultLocationId?: string | null;
  batches?: ItemLocationBatch[];
};

export type ItemStockPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ItemWarehouseStock = {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  locationCount: number;
  maxQuantity: number | null;
  defaultLocationId: string | null;
  defaultLocationName: string | null;
  defaultLocationNamePath: string | null;
};

// One location in an item's stock tree: branch totals plus stock held directly on it.
export type ItemLocationStockNode = {
  locationId: string;
  warehouseId: string;
  code: string;
  name: string | null;
  locationType: string;
  isStorable: boolean;
  namePath: string;
  isDefault: boolean;
  subtreeOnHand: number;
  subtreeReserved: number;
  subtreeAvailable: number;
  directOnHand: number;
  directReserved: number;
  directAvailable: number;
  directBatchCount: number;
  hasStockedChildren: boolean;
};

export type WarehouseLocationAncestor = {
  id: string;
  code: string;
  name: string | null;
  locationPath: string;
  isActive: boolean;
};

export type WarehouseLocationDetail = {
  id: string;
  warehouseId: string;
  code: string;
  name: string | null;
  parentId: string | null;
  locationType: string;
  isPickable: boolean;
  isStorable: boolean;
  isActive: boolean;
  maxCapacity: number | null;
  locationPath: string;
  ancestors: WarehouseLocationAncestor[];
  childCount: number;
  activeChildCount: number;
  descendantCount: number;
  directOnHand: number;
  directReserved: number;
  subtreeOnHand: number;
  subtreeReserved: number;
  stockedLocationCount: number;
  directPendingPutaway: number;
  subtreePendingPutaway: number;
};

export type WarehouseLocationBatchRange = {
  locationType: string;
  parentId: string | null;
  from: number;
  to: number;
  namePrefix: string | null;
};

export type WarehouseLocationBatchPreview = {
  rows: Array<{
    code: string;
    name: string | null;
    locationPath: string;
  }>;
};

export type WarehouseLocationBatchResult = {
  createdCount: number;
};

export type WarehouseLocationCopyRequest = {
  destinationParentId: string | null;
  nameFind: string | null;
  nameReplace: string | null;
};

export type WarehouseLocationCopyPreview = {
  rows: Array<{
    sourceId: string;
    depth: number;
    code: string;
    name: string | null;
    locationPath: string;
    locationType: string;
  }>;
};

export type WarehouseLocationCopyResult = {
  rootId: string;
  createdCount: number;
};

export type WarehouseLocation = {
  id: string;
  companyId: string;
  warehouseId: string;
  code: string;
  name?: string | null;
  parentId?: string | null;
  locationPath: string;
  locationNamePath?: string;
  childCount?: number;
  subtreeQuantity?: number;
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
