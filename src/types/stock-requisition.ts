export type StockRequisitionStatus =
  | "draft"
  | "submitted"
  | "partially_fulfilled"
  | "fulfilled"
  | "cancelled";

export type StockRequisitionItem = {
  id: string;
  srId: string;
  itemId: string;
  item?: {
    id: string;
    code: string;
    name: string;
  };
  requestedQty: number;
  fulfilledQty: number;
  outstandingQty: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
};

export type StockRequisition = {
  id: string;
  srNumber: string;
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
  requisitionDate: string;
  requestedBy?: string;
  requestedByUser?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  requiredByDate?: string;
  status: StockRequisitionStatus;
  totalAmount: number;
  notes?: string;
  items: StockRequisitionItem[];
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

export type CreateStockRequisitionRequest = {
  supplierId: string;
  requisitionDate?: string;
  requiredByDate?: string;
  notes?: string;
  items: {
    itemId: string;
    requestedQty: number;
    unitPrice: number;
    notes?: string;
  }[];
};

export type UpdateStockRequisitionRequest = Partial<CreateStockRequisitionRequest>;

export type StockRequisitionFilters = {
  search?: string;
  status?: StockRequisitionStatus | "all";
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

export type StockRequisitionsResponse = {
  data: StockRequisition[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};
