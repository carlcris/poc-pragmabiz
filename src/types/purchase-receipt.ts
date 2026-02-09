// Purchase Receipt Types
// Based on database tables: purchase_receipts, purchase_receipt_items

export type PurchaseReceiptStatus = "draft" | "received" | "cancelled";

export interface PurchaseReceipt {
  id: string;
  companyId: string;
  receiptCode: string;
  batchSequenceNumber?: string | null;

  // Relations
  purchaseOrderId: string;
  purchaseOrder?: {
    id: string;
    orderCode: string;
  };

  supplierId: string;
  supplier?: {
    id: string;
    code: string;
    name: string;
  };

  warehouseId: string;
  warehouse?: {
    id: string;
    code: string;
    name: string;
  };

  receiptDate: string;

  // Supplier Invoice Details
  supplierInvoiceNumber?: string;
  supplierInvoiceDate?: string;

  status: PurchaseReceiptStatus;
  notes?: string;

  // Line Items
  items?: PurchaseReceiptItem[];

  // Audit Fields
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy?: string;
  deletedAt?: string | null;
  version: number;
  customFields?: Record<string, unknown>;
}

export interface PurchaseReceiptItem {
  id: string;
  companyId: string;
  receiptId: string;
  purchaseOrderItemId: string;

  itemId: string;
  item?: {
    id: string;
    code: string;
    name: string;
  };

  quantityOrdered: number;
  quantityReceived: number;

  uomId: string;
  uom?: {
    id: string;
    code: string;
    name: string;
  };

  rate: number;
  lineTotal?: number;
  notes?: string;

  // Audit Fields
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy?: string;
  deletedAt?: string | null;
}

// API Request/Response Types

export interface CreatePurchaseReceiptRequest {
  purchaseOrderId: string;
  warehouseId: string;
  locationId?: string;
  receiptDate: string;
  batchSequenceNumber?: string | null;
  supplierInvoiceNumber?: string;
  supplierInvoiceDate?: string;
  notes?: string;
  items: CreatePurchaseReceiptItemRequest[];
}

export interface CreatePurchaseReceiptItemRequest {
  purchaseOrderItemId: string;
  itemId: string;
  quantityOrdered: number;
  quantityReceived: number;
  uomId: string;
  rate: number;
  notes?: string;
}

export interface UpdatePurchaseReceiptRequest {
  warehouseId?: string;
  receiptDate?: string;
  batchSequenceNumber?: string | null;
  supplierInvoiceNumber?: string;
  supplierInvoiceDate?: string;
  notes?: string;
  status?: PurchaseReceiptStatus;
  items?: UpdatePurchaseReceiptItemRequest[];
}

export interface UpdatePurchaseReceiptItemRequest {
  id?: string; // if editing existing item
  purchaseOrderItemId: string;
  itemId: string;
  quantityOrdered: number;
  quantityReceived: number;
  uomId: string;
  rate: number;
  notes?: string;
}

export interface PurchaseReceiptListResponse {
  data: PurchaseReceipt[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PurchaseReceiptFilters {
  search?: string;
  status?: PurchaseReceiptStatus | "all";
  purchaseOrderId?: string;
  supplierId?: string;
  warehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}
