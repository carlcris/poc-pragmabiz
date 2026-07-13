export type PutawayTaskStatus = "pending" | "partial" | "completed" | "cancelled";

export type PutawayTaskSourceType = "transformation_order" | "grn" | "production";

export type PutawayTask = {
  id: string;
  companyId: string;
  businessUnitId: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  warehouseName: string | null;
  itemId: string;
  itemCode: string | null;
  itemName: string | null;
  uomId: string | null;
  uomCode: string | null;
  uomName: string | null;
  sourceUnitName: string;
  sourceQtyPerUnit: number;
  sourceType: string;
  sourceId: string;
  sourceLineId: string | null;
  sourceReference: string | null;
  sourceBatchCode: string | null;
  suggestedLocationId: string | null;
  quantity: number;
  pendingQuantity: number;
  postedQuantity: number;
  unitCost: number;
  status: PutawayTaskStatus;
  notes: string | null;
  createdAt: string;
};

export type PutawayTaskListResponse = {
  data: PutawayTask[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type PutawayTaskFilters = {
  status?: PutawayTaskStatus | "open" | "all";
  warehouseId?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type PostPutawayTaskRequest = {
  locationId: string;
  quantity: number;
  batchCode: string;
};

export type PostPutawayTaskResponse = {
  message: string;
  transactionId: string;
  batchLocationId: string;
  batchLocationSku: string;
  batchCode: string;
  postedQuantity: number;
  postedDate: string;
  locationId: string;
};

export type PutawayTaskLabel = {
  boxId: string;
  itemId: string;
  batchLocationSku: string | null;
  batchNumber: string;
  referenceNumber: string;
  itemCode: string;
  itemName: string;
  boxNumber: number;
  quantity: number;
  postedDate: string;
  warehouseCode: string | null;
  locationId: string | null;
  locationCode: string | null;
};

export type PutawayTaskLabelsResponse = {
  data: PutawayTaskLabel[];
};
