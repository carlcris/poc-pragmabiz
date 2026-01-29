import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { transformationOrdersApi } from "@/lib/api/transformation-orders";
import type {
  TransformationOrderFilters,
  CreateTransformationOrderRequest,
  UpdateTransformationOrderRequest,
  ExecuteTransformationOrderRequest,
  CompleteTransformationOrderRequest,
} from "@/types/transformation-order";

export const TRANSFORMATION_ORDERS_QUERY_KEY = "transformation-orders";

type InsufficientItem = {
  itemName: string;
  available: number;
  required: number;
};

type ErrorWithResponseData = {
  response?: {
    data?: {
      insufficientItems?: InsufficientItem[];
    };
  };
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const getInsufficientItems = (error: unknown): InsufficientItem[] | null => {
  if (!error || typeof error !== "object") return null;
  const errorWithResponse = error as ErrorWithResponseData;
  return errorWithResponse.response?.data?.insufficientItems ?? null;
};

/**
 * Hook to fetch list of transformation orders
 */
export function useTransformationOrders(params?: TransformationOrderFilters) {
  return useQuery({
    queryKey: [TRANSFORMATION_ORDERS_QUERY_KEY, params],
    queryFn: () => transformationOrdersApi.list(params),
  });
}

/**
 * Hook to fetch single transformation order
 */
export function useTransformationOrder(id: string) {
  return useQuery({
    queryKey: [TRANSFORMATION_ORDERS_QUERY_KEY, id],
    queryFn: () => transformationOrdersApi.getById(id),
    enabled: !!id,
  });
}

/**
 * Hook to create transformation order from template
 */
export function useCreateTransformationOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTransformationOrderRequest) => transformationOrdersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_ORDERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["transformation-templates"] });
      toast.success("Transformation order created successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to create transformation order"));
    },
  });
}

/**
 * Hook to update transformation order
 * Note: Only allowed in DRAFT status
 */
export function useUpdateTransformationOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTransformationOrderRequest }) =>
      transformationOrdersApi.update(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_ORDERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_ORDERS_QUERY_KEY, variables.id] });
      toast.success("Transformation order updated successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to update transformation order"));
    },
  });
}

/**
 * Hook to delete transformation order
 * Note: Only allowed in DRAFT status
 */
export function useDeleteTransformationOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => transformationOrdersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_ORDERS_QUERY_KEY] });
      toast.success("Transformation order deleted successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to delete transformation order"));
    },
  });
}

/**
 * Hook to release transformation order (DRAFT → RELEASED)
 * Validates template and stock availability
 */
export function useReleaseTransformationOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => transformationOrdersApi.release(id),
    onSuccess: (response, id) => {
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_ORDERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_ORDERS_QUERY_KEY, id] });
      toast.success(response.message || "Order released successfully");
    },
    onError: (error: unknown) => {
      // Check if error has insufficientItems
      const insufficientItems = getInsufficientItems(error);
      if (insufficientItems) {
        const items = insufficientItems
          .map((item) => `${item.itemName}: ${item.available}/${item.required}`)
          .join(", ");
        toast.error(`Insufficient stock: ${items}`);
      } else {
        toast.error(getErrorMessage(error, "Failed to release transformation order"));
      }
    },
  });
}

/**
 * Hook to execute transformation (RELEASED → EXECUTING → COMPLETED)
 * Consumes inputs, produces outputs, records lineage
 * This is the main transformation operation
 */
export function useExecuteTransformationOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExecuteTransformationOrderRequest }) =>
      transformationOrdersApi.execute(id, data),
    onSuccess: (response, variables) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_ORDERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_ORDERS_QUERY_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: ["stock-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
      queryClient.invalidateQueries({ queryKey: ["item-warehouse"] });
      toast.success(response.message || "Transformation executed successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to execute transformation"));
    },
  });
}

/**
 * Hook to complete transformation order (EXECUTING → COMPLETED)
 * Note: Usually auto-completed during execution
 */
export function useCompleteTransformationOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: CompleteTransformationOrderRequest }) =>
      transformationOrdersApi.complete(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_ORDERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_ORDERS_QUERY_KEY, variables.id] });
      toast.success(response.message || "Order completed successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to complete transformation order"));
    },
  });
}

/**
 * Hook to close transformation order (COMPLETED → CLOSED)
 */
export function useCloseTransformationOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => transformationOrdersApi.close(id),
    onSuccess: (response, id) => {
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_ORDERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_ORDERS_QUERY_KEY, id] });
      toast.success(response.message || "Order closed successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to close transformation order"));
    },
  });
}
