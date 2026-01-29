import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { salesOrdersApi } from "@/lib/api/sales-orders";
import type {
  CreateSalesOrderRequest,
  UpdateSalesOrderRequest,
  SalesOrderFilters,
} from "@/types/sales-order";
import { toast } from "sonner";

const SALES_ORDERS_KEY = "sales-orders";

export function useSalesOrders(filters?: SalesOrderFilters) {
  return useQuery({
    queryKey: [SALES_ORDERS_KEY, filters],
    queryFn: () => salesOrdersApi.getSalesOrders(filters),
    placeholderData: keepPreviousData,
  });
}

export function useSalesOrder(id: string) {
  return useQuery({
    queryKey: [SALES_ORDERS_KEY, id],
    queryFn: () => salesOrdersApi.getSalesOrder(id),
    enabled: !!id,
  });
}

export function useCreateSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSalesOrderRequest) => salesOrdersApi.createSalesOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SALES_ORDERS_KEY] });
      toast.success("Sales order created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create sales order");
    },
  });
}

export function useUpdateSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSalesOrderRequest }) =>
      salesOrdersApi.updateSalesOrder(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SALES_ORDERS_KEY] });
      toast.success("Sales order updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update sales order");
    },
  });
}

export function useDeleteSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => salesOrdersApi.deleteSalesOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SALES_ORDERS_KEY] });
      toast.success("Sales order deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete sales order");
    },
  });
}

export function useConfirmOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => salesOrdersApi.confirmOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SALES_ORDERS_KEY] });
      toast.success("Sales order confirmed successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to confirm sales order");
    },
  });
}

export function useShipOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => salesOrdersApi.shipOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SALES_ORDERS_KEY] });
      toast.success("Sales order marked as shipped");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to ship sales order");
    },
  });
}

export function useDeliverOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => salesOrdersApi.deliverOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SALES_ORDERS_KEY] });
      toast.success("Sales order marked as delivered");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to deliver sales order");
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => salesOrdersApi.cancelOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SALES_ORDERS_KEY] });
      toast.success("Sales order cancelled");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel sales order");
    },
  });
}

export function useConvertToInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      warehouseId,
      locationId,
    }: {
      orderId: string;
      warehouseId: string;
      locationId?: string;
    }) => salesOrdersApi.convertToInvoice(orderId, warehouseId, locationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SALES_ORDERS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Sales order converted to invoice successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to convert sales order to invoice");
    },
  });
}

export function useSalesOrderPaymentSummary(salesOrderId: string) {
  return useQuery({
    queryKey: [SALES_ORDERS_KEY, salesOrderId, "payment-summary"],
    queryFn: () => salesOrdersApi.getPaymentSummary(salesOrderId),
    enabled: !!salesOrderId,
  });
}
