import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { STOCK_REQUESTS_QUERY_KEY } from "@/hooks/queryKeys";
import { stockRequestsApi } from "@/lib/api/stock-requests";
import { getApiErrorCode } from "@/lib/api";
import type {
  StockRequestListParams,
  CreateStockRequestPayload,
  UpdateStockRequestPayload,
} from "@/types/stock-request";

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const STOCK_REQUEST_DRAFT_ERROR_CODES = [
  "STOCK_REQUEST_SAVE_FAILED",
  "STOCK_REQUEST_UNAUTHORIZED",
  "STOCK_REQUEST_FORBIDDEN",
  "STOCK_REQUEST_CONTEXT_INVALID",
  "STOCK_REQUEST_NOT_DRAFT",
  "STOCK_REQUEST_HEADER_INVALID",
  "STOCK_REQUEST_BUSINESS_UNITS_MUST_DIFFER",
  "STOCK_REQUEST_FULFILLING_BUSINESS_UNIT_INVALID",
  "STOCK_REQUEST_FULFILLING_BUSINESS_UNIT_IMMUTABLE",
  "STOCK_REQUEST_ITEMS_INVALID",
  "STOCK_REQUEST_LINE_INVALID",
  "STOCK_REQUEST_ITEM_UNAVAILABLE",
  "STOCK_REQUEST_UNIT_OPTION_UNAVAILABLE",
  "STOCK_REQUEST_UNIT_OPTION_MISMATCH",
] as const;

type StockRequestDraftErrorCode = (typeof STOCK_REQUEST_DRAFT_ERROR_CODES)[number];

type StockRequestDraftMutationMessages = {
  success: string;
  fallbackError: string;
  errors: Partial<Record<StockRequestDraftErrorCode, string>>;
};

const getDraftMutationError = (error: unknown, messages: StockRequestDraftMutationMessages) => {
  const code = getApiErrorCode(error, STOCK_REQUEST_DRAFT_ERROR_CODES);
  return (code && messages.errors[code]) || messages.fallbackError;
};

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
export function useCreateStockRequest(messages: StockRequestDraftMutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateStockRequestPayload) => stockRequestsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUESTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-dashboard"] });
      toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getDraftMutationError(error, messages));
    },
  });
}

/**
 * Hook to update stock request
 */
export function useUpdateStockRequest(messages: StockRequestDraftMutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStockRequestPayload }) =>
      stockRequestsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUESTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-dashboard"] });
      toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getDraftMutationError(error, messages));
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
