import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { stockRequestsApi } from "@/lib/api/stock-requests";
import type {
  StockRequestListParams,
  CreateStockRequestPayload,
  UpdateStockRequestPayload,
  ReceiveStockRequestPayload,
} from "@/types/stock-request";

export const STOCK_REQUESTS_QUERY_KEY = "stock-requests";

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/**
 * Hook to fetch list of stock requests
 */
export function useStockRequests(params?: StockRequestListParams) {
  return useQuery({
    queryKey: [STOCK_REQUESTS_QUERY_KEY, params],
    queryFn: () => stockRequestsApi.list(params),
  });
}

/**
 * Hook to fetch single stock request
 */
export function useStockRequest(id: string) {
  return useQuery({
    queryKey: [STOCK_REQUESTS_QUERY_KEY, id],
    queryFn: () => stockRequestsApi.getById(id),
    enabled: !!id,
  });
}

/**
 * Hook to create stock request
 */
export function useCreateStockRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateStockRequestPayload) => stockRequestsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUESTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-dashboard"] });
      toast.success("Stock request created successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to create stock request"));
    },
  });
}

/**
 * Hook to update stock request
 */
export function useUpdateStockRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStockRequestPayload }) =>
      stockRequestsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUESTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-dashboard"] });
      toast.success("Stock request updated successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to update stock request"));
    },
  });
}

/**
 * Hook to delete stock request
 */
export function useDeleteStockRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => stockRequestsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUESTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-dashboard"] });
      toast.success("Stock request deleted successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to delete stock request"));
    },
  });
}

/**
 * Hook to submit stock request for approval
 */
export function useSubmitStockRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => stockRequestsApi.submit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUESTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-dashboard"] });
      toast.success("Stock request submitted for approval");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to submit stock request"));
    },
  });
}

/**
 * Hook to approve stock request
 */
export function useApproveStockRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => stockRequestsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUESTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-dashboard"] });
      toast.success("Stock request approved");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to approve stock request"));
    },
  });
}

/**
 * Hook to reject stock request
 */
export function useRejectStockRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      stockRequestsApi.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUESTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-dashboard"] });
      toast.success("Stock request rejected");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to reject stock request"));
    },
  });
}

/**
 * Hook to mark stock request as ready for picking
 */
export function useMarkReadyForPick() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => stockRequestsApi.markReadyForPick(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUESTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-dashboard"] });
      toast.success("Stock request marked as ready for picking");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to mark as ready for pick"));
    },
  });
}

/**
 * Hook to mark stock request as delivered
 */
export function useMarkDelivered() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => stockRequestsApi.markDelivered(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUESTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-dashboard"] });
      toast.success("Stock request marked as delivered");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to mark as delivered"));
    },
  });
}

/**
 * Hook to complete stock request
 */
export function useCompleteStockRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => stockRequestsApi.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUESTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["stock-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
      toast.success("Stock request completed successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to complete stock request"));
    },
  });
}

/**
 * Hook to cancel stock request
 */
export function useCancelStockRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      stockRequestsApi.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUESTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-dashboard"] });
      toast.success("Stock request cancelled");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to cancel stock request"));
    },
  });
}

/**
 * Hook to receive delivered stock request
 */
export function useReceiveStockRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReceiveStockRequestPayload }) =>
      stockRequestsApi.receive(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUESTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast.success("Stock request received successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to receive stock request"));
    },
  });
}
