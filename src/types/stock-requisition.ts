import type { ItemUnitOption } from "@/types/item";

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
  itemUnitOptionId?: string | null;
  uomId: string;
  uomCode?: string;
  itemUnitOption?: ItemUnitOption | null;
  item?: {
    id: string;
    code: string;
    name: string;
    chineseName?: string;
  };
  requestedQty: number;
  fulfilledQty: number;
  outstandingQty: number;
  unitPrice: number | null;
  totalPrice: number | null;
  documentUnitPrice?: number | null;
  documentTotalPrice?: number | null;
  notes?: string;
};

export type StockRequisitionCapabilities = {
  canViewTotalAmount: boolean;
  canViewUnitCost: boolean;
  canViewSupplierCostSummary: boolean;
};

export type StockRequisitionDocumentSettings = {
  showUnitPrice: boolean;
  showLineTotal: boolean;
  showTotalAmount: boolean;
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
    lang?: "english" | "chinese";
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
  totalAmount: number | null;
  currency: string | null;
  documentTotalAmount?: number | null;
  documentCurrency?: string | null;
  notes?: string;
  items: StockRequisitionItem[];
  capabilities?: StockRequisitionCapabilities;
  documentSettings?: StockRequisitionDocumentSettings;
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
  currency?: string | null;
  requisitionDate?: string;
  requiredByDate?: string;
  notes?: string;
  items: {
    itemId: string;
    itemUnitOptionId?: string;
    uomId?: string;
    requestedQty: number;
    unitPrice?: number;
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
  capabilities?: StockRequisitionCapabilities;
  documentSettings?: StockRequisitionDocumentSettings;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};
