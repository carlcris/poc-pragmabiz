import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { stockAdjustmentsApi } from "@/lib/api/stock-adjustments";
import type {
  StockAdjustmentListParams,
  CreateStockAdjustmentRequest,
  UpdateStockAdjustmentRequest,
  PostStockAdjustmentRequest,
} from "@/types/stock-adjustment";

export const STOCK_ADJUSTMENTS_QUERY_KEY = "stock-adjustments";

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/**
 * Hook to fetch list of stock adjustments
 */
export function useStockAdjustments(params?: StockAdjustmentListParams) {
  return useQuery({
    queryKey: [STOCK_ADJUSTMENTS_QUERY_KEY, params],
    queryFn: () => stockAdjustmentsApi.list(params),
  });
}

/**
 * Hook to fetch single stock adjustment
 */
export function useStockAdjustment(id: string) {
  return useQuery({
    queryKey: [STOCK_ADJUSTMENTS_QUERY_KEY, id],
    queryFn: () => stockAdjustmentsApi.getById(id),
    enabled: !!id,
  });
}

/**
 * Hook to create stock adjustment
 */
export function useCreateStockAdjustment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateStockAdjustmentRequest) => stockAdjustmentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_ADJUSTMENTS_QUERY_KEY] });
      toast.success("Stock adjustment created successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to create stock adjustment"));
    },
  });
}

/**
 * Hook to update stock adjustment
 */
export function useUpdateStockAdjustment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStockAdjustmentRequest }) =>
      stockAdjustmentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_ADJUSTMENTS_QUERY_KEY] });
      toast.success("Stock adjustment updated successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to update stock adjustment"));
    },
  });
}

/**
 * Hook to delete stock adjustment
 */
export function useDeleteStockAdjustment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => stockAdjustmentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_ADJUSTMENTS_QUERY_KEY] });
      toast.success("Stock adjustment deleted successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to delete stock adjustment"));
    },
  });
}

/**
 * Hook to post/approve stock adjustment
 */
export function usePostStockAdjustment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: PostStockAdjustmentRequest }) =>
      stockAdjustmentsApi.post(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_ADJUSTMENTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["stock-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
      toast.success("Stock adjustment posted successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to post stock adjustment"));
    },
  });
}
