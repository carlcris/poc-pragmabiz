export type GRNStatus =
  | "draft"
  | "receiving"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "cancelled";

export type DamageType =
  | "broken"
  | "defective"
  | "missing"
  | "expired"
  | "wrong_item"
  | "other";

export type DamagedItemStatus = "reported" | "processing" | "resolved";

export type GRNItem = {
  id: string;
  grnId: string;
  itemId: string;
  item?: {
    id: string;
    code: string;
    name: string;
  };
  loadListQty: number;
  receivedQty: number;
  damagedQty: number;
  numBoxes: number;
  barcodesPrinted: boolean;
  notes?: string;
};

export type GRNBox = {
  id: string;
  grnItemId: string;
  boxNumber: number;
  barcode: string;
  qtyPerBox: number;
  warehouseLocationId?: string;
  warehouseLocation?: {
    id: string;
    code: string;
    name: string;
  };
  deliveryDate: string;
  containerNumber?: string;
  sealNumber?: string;
  createdAt: string;
};

export type DamagedItem = {
  id: string;
  grnId: string;
  itemId: string;
  item?: {
    id: string;
    code: string;
    name: string;
  };
  qty: number;
  damageType: DamageType;
  description?: string;
  reportedBy: string;
  reportedByUser?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  reportedDate: string;
  actionTaken?: string;
  status: DamagedItemStatus;
  createdAt: string;
  updatedAt: string;
};

export type GRN = {
  id: string;
  grnNumber: string;
  loadListId: string;
  loadList?: {
    id: string;
    llNumber: string;
    supplierLlNumber?: string;
    supplierId: string;
    supplier?: {
      id: string;
      name: string;
      code: string;
    };
  };
  companyId: string;
  businessUnitId?: string;
  businessUnit?: {
    id: string;
    name: string;
    code: string;
  };
  warehouseId: string;
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
  containerNumber?: string;
  sealNumber?: string;
  batchNumber?: string;
  receivingDate?: string;
  deliveryDate: string;
  status: GRNStatus;
  notes?: string;
  items: GRNItem[];
  damagedItems?: DamagedItem[];
  receivedBy?: string;
  receivedByUser?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  checkedBy?: string;
  checkedByUser?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  approvedBy?: string;
  approvedByUser?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  approvedDate?: string;
  createdBy: string;
  createdByUser?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  deletedAt?: string;
};

export type CreateGRNRequest = {
  loadListId: string;
  warehouseId: string;
  containerNumber?: string;
  sealNumber?: string;
  batchNumber?: string;
  deliveryDate: string;
  notes?: string;
  items: {
    itemId: string;
    loadListQty: number;
    receivedQty?: number;
    damagedQty?: number;
    numBoxes?: number;
    notes?: string;
  }[];
};

export type UpdateGRNRequest = {
  receivingDate?: string;
  notes?: string;
  items?: {
    id: string;
    receivedQty: number;
    damagedQty: number;
    numBoxes: number;
    notes?: string;
  }[];
};

export type GRNFilters = {
  search?: string;
  status?: GRNStatus | "all";
  warehouseId?: string;
  loadListId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

export type GRNsResponse = {
  data: GRN[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type CreateDamagedItemRequest = {
  itemId: string;
  qty: number;
  damageType: DamageType;
  description?: string;
};

export type UpdateDamagedItemRequest = {
  actionTaken?: string;
  status?: DamagedItemStatus;
};
