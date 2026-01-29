import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

// Types for tablet receiving
export type TabletReceiptSummary = {
  id: string;
  receiptCode: string;
  receiptDate: string;
  status: string;
  supplier: {
    id: string;
    code: string;
    name: string;
  };
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  purchaseOrder: {
    id: string;
    orderCode: string;
  };
  supplierInvoiceNumber?: string;
  supplierInvoiceDate?: string;
  notes?: string;
  summary: {
    totalItems: number;
    receivedItems: number;
    isPartiallyReceived: boolean;
    isFullyReceived: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

export type TabletReceiptItem = {
  id: string;
  itemId: string;
  item: {
    id: string;
    item_code: string;
    item_name: string;
    item_name_cn?: string;
  };
  quantityOrdered: number;
  quantityReceived: number;
  uom: {
    id: string;
    code: string;
    name: string;
    symbol?: string;
  };
  packaging?: {
    id: string;
    pack_name: string;
    qty_per_pack: number;
  } | null;
  rate: number;
  lineTotal: number;
  notes?: string;
  isFullyReceived: boolean;
  isPartiallyReceived: boolean;
  remainingQty: number;
};

export type TabletReceiptDetail = {
  id: string;
  receiptCode: string;
  receiptDate: string;
  status: string;
  supplier: {
    id: string;
    code: string;
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
  };
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  purchaseOrder: {
    id: string;
    order_code: string;
    order_date: string;
    expected_delivery_date: string;
    status: string;
  };
  supplierInvoiceNumber?: string;
  supplierInvoiceDate?: string;
  items: TabletReceiptItem[];
  notes?: string;
  summary: {
    totalItems: number;
    fullyReceivedItems: number;
    partiallyReceivedItems: number;
    notReceivedItems: number;
  };
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy?: string;
};

export type ReceiptListParams = {
  status?: string;
  warehouse_id?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
};

// Hook: List purchase receipts
export function useTabletPurchaseReceipts(params: ReceiptListParams = {}) {
  return useQuery({
    queryKey: ["tablet", "purchase-receipts", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();

      if (params.status) searchParams.set("status", params.status);
      if (params.warehouse_id) searchParams.set("warehouse_id", params.warehouse_id);
      if (params.search) searchParams.set("search", params.search);
      if (params.from_date) searchParams.set("from_date", params.from_date);
      if (params.to_date) searchParams.set("to_date", params.to_date);
      if (params.page) searchParams.set("page", params.page.toString());
      if (params.limit) searchParams.set("limit", params.limit.toString());

      const url = `/api/tablet/purchase-receipts?${searchParams.toString()}`;
      return apiClient.get<{
        data: TabletReceiptSummary[];
        pagination: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        };
      }>(url);
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true,
  });
}

// Hook: Get single purchase receipt
export function useTabletPurchaseReceipt(receiptId: string | undefined) {
  return useQuery({
    queryKey: ["tablet", "purchase-receipt", receiptId],
    queryFn: async () => {
      if (!receiptId) throw new Error("Receipt ID is required");
      return apiClient.get<TabletReceiptDetail>(`/api/tablet/purchase-receipts/${receiptId}`);
    },
    enabled: !!receiptId,
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true,
  });
}

// Hook: Receive all items (auto-fill quantities)
export function useReceiveAll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (receiptId: string) => {
      return apiClient.post(`/api/tablet/purchase-receipts/${receiptId}/receive-all`, {});
    },
    onSuccess: (data, receiptId) => {
      // Invalidate receipt queries
      queryClient.invalidateQueries({ queryKey: ["tablet", "purchase-receipt", receiptId] });
      queryClient.invalidateQueries({ queryKey: ["tablet", "purchase-receipts"] });
    },
  });
}

// Hook: Update item received quantity
export function useUpdateReceiptItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      itemId,
      quantityReceived,
      notes,
    }: {
      receiptId: string;
      itemId: string;
      quantityReceived: number;
      notes?: string;
    }) => {
      return apiClient.patch<TabletReceiptItem>(
        `/api/tablet/purchase-receipts/${receiptId}/items/${itemId}`,
        { quantityReceived, notes }
      );
    },
    onSuccess: (data, variables) => {
      // Invalidate receipt queries
      queryClient.invalidateQueries({
        queryKey: ["tablet", "purchase-receipt", variables.receiptId],
      });
      queryClient.invalidateQueries({ queryKey: ["tablet", "purchase-receipts"] });
    },
  });
}

// Hook: Post receipt (finalize and create stock transactions)
export function usePostReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (receiptId: string) => {
      return apiClient.post<{
        message: string;
        receiptId: string;
        stockTransactionId: string;
        stockTransactionCode: string;
      }>(`/api/tablet/purchase-receipts/${receiptId}/post`, {});
    },
    onSuccess: (data, receiptId) => {
      // Invalidate all receipt queries
      queryClient.invalidateQueries({ queryKey: ["tablet", "purchase-receipt", receiptId] });
      queryClient.invalidateQueries({ queryKey: ["tablet", "purchase-receipts"] });
    },
  });
}
