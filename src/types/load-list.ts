export type LoadListStatus =
  | "draft"
  | "confirmed"
  | "in_transit"
  | "arrived"
  | "receiving"
  | "pending_approval"
  | "received"
  | "cancelled";

export type LoadListItem = {
  id: string;
  loadListId: string;
  itemId: string;
  item?: {
    id: string;
    code: string;
    name: string;
  };
  loadListQty: number;
  receivedQty: number;
  damagedQty: number;
  shortageQty: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
};

export type LoadList = {
  id: string;
  llNumber: string;
  supplierLlNumber?: string;
  companyId: string;
  businessUnitId?: string;
  businessUnit?: {
    id: string;
    name: string;
    code: string;
  };
  supplierId: string;
  supplier?: {
    id: string;
    name: string;
    code: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
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
  estimatedArrivalDate?: string;
  actualArrivalDate?: string;
  loadDate?: string;
  status: LoadListStatus;
  notes?: string;
  items: LoadListItem[];
  createdBy: string;
  createdByUser?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  receivedBy?: string;
  receivedByUser?: {
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
  receivedDate?: string;
  approvedDate?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  deletedAt?: string;
};

export type CreateLoadListRequest = {
  supplierId: string;
  warehouseId: string;
  supplierLlNumber?: string;
  containerNumber?: string;
  sealNumber?: string;
  batchNumber?: string;
  estimatedArrivalDate?: string;
  loadDate?: string;
  notes?: string;
  items: {
    itemId: string;
    loadListQty: number;
    unitPrice: number;
    notes?: string;
  }[];
};

export type UpdateLoadListRequest = Partial<CreateLoadListRequest>;

export type LoadListFilters = {
  search?: string;
  status?: LoadListStatus | "all";
  supplierId?: string;
  warehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

export type LoadListsResponse = {
  data: LoadList[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

// SR to LL Linking types
export type LoadListSRLink = {
  id: string;
  fulfilledQty: number;
  loadListItem: {
    id: string;
    loadListQty: number;
    item: {
      id: string;
      code: string;
      name: string;
    };
  };
  srItem: {
    id: string;
    requestedQty: number;
    fulfilledQty: number;
    sr: {
      id: string;
      srNumber: string;
      requisitionDate: string;
      status: string;
    };
  };
};

export type CreateLoadListSRLinkRequest = {
  links: {
    loadListItemId: string;
    srItemId: string;
    fulfilledQty: number;
  }[];
};
