import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { posApi } from "@/lib/api/pos";
import type { POSTransactionCreate } from "@/types/pos";
import type { ApiQueryParams } from "@/types/api";
import { toast } from "sonner";

export function usePOSTransactions(params?: ApiQueryParams) {
  return useQuery({
    queryKey: ["pos-transactions", params],
    queryFn: () => posApi.getTransactions(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function usePOSTransaction(id: string) {
  return useQuery({
    queryKey: ["pos-transactions", id],
    queryFn: () => posApi.getTransaction(id),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useCreatePOSTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: POSTransactionCreate) => posApi.createTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-transactions"] });
      toast.success("Transaction completed successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to complete transaction: ${error.message}`);
    },
  });
}

export function useVoidPOSTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => posApi.voidTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-transactions"] });
      toast.success("Transaction voided successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to void transaction: ${error.message}`);
    },
  });
}
