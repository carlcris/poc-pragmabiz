import type {
  PurchaseReceipt,
  PurchaseReceiptListResponse,
  PurchaseReceiptFilters,
  CreatePurchaseReceiptRequest,
  UpdatePurchaseReceiptRequest,
} from "@/types/purchase-receipt";

const API_BASE = "/api/purchase-receipts";

export const purchaseReceiptsApi = {
  // Get all purchase receipts with optional filters
  getReceipts: async (
    filters?: PurchaseReceiptFilters
  ): Promise<PurchaseReceiptListResponse> => {
    const params = new URLSearchParams();

    if (filters?.search) params.append("search", filters.search);
    if (filters?.status && filters.status !== "all")
      params.append("status", filters.status);
    if (filters?.purchaseOrderId)
      params.append("purchase_order_id", filters.purchaseOrderId);
    if (filters?.supplierId)
      params.append("supplier_id", filters.supplierId);
    if (filters?.warehouseId)
      params.append("warehouse_id", filters.warehouseId);
    if (filters?.dateFrom) params.append("from_date", filters.dateFrom);
    if (filters?.dateTo) params.append("to_date", filters.dateTo);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const response = await fetch(`${API_BASE}?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch purchase receipts");
    return response.json();
  },

  // Get a single purchase receipt by ID
  getReceipt: async (id: string): Promise<PurchaseReceipt> => {
    const response = await fetch(`${API_BASE}/${id}`);
    if (!response.ok) throw new Error("Failed to fetch purchase receipt");
    return response.json();
  },

  // Create a new purchase receipt
  createReceipt: async (
    data: CreatePurchaseReceiptRequest
  ): Promise<{ id: string; receiptCode: string }> => {
    const response = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create purchase receipt");
    return response.json();
  },

  // Update an existing purchase receipt (draft only)
  updateReceipt: async (
    id: string,
    data: UpdatePurchaseReceiptRequest
  ): Promise<void> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update purchase receipt");
  },

  // Delete a purchase receipt (soft delete, draft only)
  deleteReceipt: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete purchase receipt");
  },

  // Receive goods from a purchase order
  receiveGoodsFromPO: async (
    purchaseOrderId: string,
    data: {
      warehouseId: string;
      locationId?: string;
      receiptDate?: string;
      supplierInvoiceNumber?: string;
      supplierInvoiceDate?: string;
      notes?: string;
        items?: Array<{
          purchaseOrderItemId: string;
          itemId: string;
          quantityOrdered: number;
          quantityReceived: number;
          packagingId?: string | null;
          uomId: string;
          rate: number;
          notes?: string;
        }>;
    }
  ): Promise<{ id: string; receiptCode: string; message: string }> => {
    const response = await fetch(
      `/api/purchase-orders/${purchaseOrderId}/receive`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    if (!response.ok) throw new Error("Failed to receive goods");
    return response.json();
  },
};
