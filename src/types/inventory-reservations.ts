export const INVENTORY_RESERVATION_STATUSES = [
  "active",
  "partial",
  "consumed",
  "released",
  "transferred",
  "closed",
] as const;

export type InventoryReservationStatus = (typeof INVENTORY_RESERVATION_STATUSES)[number];

export const INVENTORY_RESERVATION_SOURCE_TYPES = [
  "delivery_note",
  "sales_order",
  "transformation_order",
  "frame_job_order",
] as const;

export type InventoryReservationSourceType = (typeof INVENTORY_RESERVATION_SOURCE_TYPES)[number];

export const INVENTORY_RESERVATION_SORT_FIELDS = [
  "updated_at",
  "source_reference",
  "item_code",
  "warehouse_code",
  "active_quantity_base",
  "status",
] as const;

export type InventoryReservationSortField = (typeof INVENTORY_RESERVATION_SORT_FIELDS)[number];
export type InventoryReservationSortOrder = "asc" | "desc";

export type InventoryReservationRow = {
  reservationId: string;
  sourceType: InventoryReservationSourceType;
  sourceId: string;
  sourceReference: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  uomId: string;
  uomCode: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  committedQuantityBase: number;
  physicallyAllocatedBase: number;
  activeQuantityBase: number;
  consumedBase: number;
  releasedBase: number;
  transferredOutBase: number;
  status: InventoryReservationStatus;
  updatedAt: string;
};

export type InventoryReservationAllocationRow = {
  allocationId: string;
  ownerType: "pick_list" | "transformation_order";
  ownerId: string;
  ownerReference: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  itemBatchId: string;
  batchCode: string;
  itemBatchLocationId: string;
  locationSku: string;
  locationId: string;
  locationCode: string;
  locationName: string | null;
  quantityBase: number;
  transferredInBase: number;
  transferredOutBase: number;
  activeQuantityBase: number;
  consumedBase: number;
  releasedBase: number;
  status: InventoryReservationStatus;
  updatedAt: string;
};

export type InventoryReservationFilters = {
  search?: string;
  sourceType?: InventoryReservationSourceType;
  status?: InventoryReservationStatus;
  itemId?: string;
  warehouseId?: string;
  sortBy?: InventoryReservationSortField;
  sortOrder?: InventoryReservationSortOrder;
  page?: number;
  limit?: number;
};

export type InventoryReservationPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type InventoryReservationsResponse = {
  data: InventoryReservationRow[];
  pagination: InventoryReservationPagination;
};

export type InventoryReservationAllocationsResponse = {
  data: InventoryReservationAllocationRow[];
  pagination: InventoryReservationPagination;
};
