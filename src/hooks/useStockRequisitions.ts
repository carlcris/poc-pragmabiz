import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { stockRequisitionsApi } from "@/lib/api/stock-requisitions";
import type {
  StockRequisitionFilters,
  CreateStockRequisitionRequest,
  UpdateStockRequisitionRequest,
  StockRequisitionStatus,
} from "@/types/stock-requisition";

const STOCK_REQUISITIONS_QUERY_KEY = "stockRequisitions";

export function useStockRequisitions(filters?: StockRequisitionFilters) {
  return useQuery({
    queryKey: [STOCK_REQUISITIONS_QUERY_KEY, filters],
    queryFn: () => stockRequisitionsApi.getStockRequisitions(filters),
    placeholderData: keepPreviousData,
  });
}

export function useStockRequisition(id: string) {
  return useQuery({
    queryKey: [STOCK_REQUISITIONS_QUERY_KEY, id],
    queryFn: () => stockRequisitionsApi.getStockRequisition(id),
    enabled: !!id,
  });
}

export function useCreateStockRequisition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateStockRequisitionRequest) =>
      stockRequisitionsApi.createStockRequisition(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUISITIONS_QUERY_KEY] });
    },
  });
}

export function useUpdateStockRequisition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStockRequisitionRequest }) =>
      stockRequisitionsApi.updateStockRequisition(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUISITIONS_QUERY_KEY] });
    },
  });
}

export function useDeleteStockRequisition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => stockRequisitionsApi.deleteStockRequisition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUISITIONS_QUERY_KEY] });
    },
  });
}

export function useUpdateStockRequisitionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: StockRequisitionStatus }) =>
      stockRequisitionsApi.updateStockRequisitionStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUISITIONS_QUERY_KEY] });
    },
  });
}
