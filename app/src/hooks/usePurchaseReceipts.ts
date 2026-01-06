import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseReceiptsApi } from "@/lib/api/purchase-receipts";
import type {
  PurchaseReceiptFilters,
  CreatePurchaseReceiptRequest,
  UpdatePurchaseReceiptRequest,
} from "@/types/purchase-receipt";

const PURCHASE_RECEIPTS_QUERY_KEY = "purchase-receipts";

// Get all purchase receipts
export function usePurchaseReceipts(filters?: PurchaseReceiptFilters) {
  return useQuery({
    queryKey: [PURCHASE_RECEIPTS_QUERY_KEY, filters],
    queryFn: () => purchaseReceiptsApi.getReceipts(filters),
  });
}

// Get a single purchase receipt by ID
export function usePurchaseReceipt(id: string) {
  return useQuery({
    queryKey: [PURCHASE_RECEIPTS_QUERY_KEY, id],
    queryFn: () => purchaseReceiptsApi.getReceipt(id),
    enabled: !!id,
  });
}

// Create a new purchase receipt
export function useCreatePurchaseReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePurchaseReceiptRequest) =>
      purchaseReceiptsApi.createReceipt(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PURCHASE_RECEIPTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] }); // Invalidate POs as status may change
    },
  });
}

// Update a purchase receipt
export function useUpdatePurchaseReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdatePurchaseReceiptRequest;
    }) => purchaseReceiptsApi.updateReceipt(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PURCHASE_RECEIPTS_QUERY_KEY] });
    },
  });
}

// Delete a purchase receipt
export function useDeletePurchaseReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => purchaseReceiptsApi.deleteReceipt(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PURCHASE_RECEIPTS_QUERY_KEY] });
    },
  });
}

// Receive goods from a purchase order
export function useReceiveGoodsFromPO() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      purchaseOrderId,
      data,
    }: {
      purchaseOrderId: string;
      data: {
        warehouseId: string;
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
      };
    }) => purchaseReceiptsApi.receiveGoodsFromPO(purchaseOrderId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PURCHASE_RECEIPTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] }); // Invalidate POs as status changes
      queryClient.invalidateQueries({ queryKey: ["items"] }); // Invalidate items as stock levels change
    },
  });
}
