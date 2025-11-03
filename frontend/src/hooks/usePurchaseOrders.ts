import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { purchaseOrdersApi } from "@/lib/api/purchase-orders";
import type {
  PurchaseOrderFilters,
  CreatePurchaseOrderRequest,
  UpdatePurchaseOrderRequest,
} from "@/types/purchase-order";

const PURCHASE_ORDERS_QUERY_KEY = "purchaseOrders";

export function usePurchaseOrders(filters?: PurchaseOrderFilters) {
  return useQuery({
    queryKey: [PURCHASE_ORDERS_QUERY_KEY, filters],
    queryFn: () => purchaseOrdersApi.getPurchaseOrders(filters),
    placeholderData: keepPreviousData,
  });
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: [PURCHASE_ORDERS_QUERY_KEY, id],
    queryFn: () => purchaseOrdersApi.getPurchaseOrder(id),
    enabled: !!id,
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePurchaseOrderRequest) => purchaseOrdersApi.createPurchaseOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PURCHASE_ORDERS_QUERY_KEY] });
    },
  });
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePurchaseOrderRequest }) =>
      purchaseOrdersApi.updatePurchaseOrder(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PURCHASE_ORDERS_QUERY_KEY] });
    },
  });
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.deletePurchaseOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PURCHASE_ORDERS_QUERY_KEY] });
    },
  });
}
