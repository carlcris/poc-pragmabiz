import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { STOCK_BALANCES_QUERY_KEY, STOCK_TRANSACTIONS_QUERY_KEY } from "@/hooks/queryKeys";
import { useRealtimeDomainInvalidation } from "@/hooks/useRealtimeDomainInvalidation";
import { stockTransactionsApi } from "@/lib/api/stock-transactions";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type {
  StockTransactionFilters,
  CreateStockTransactionRequest,
} from "@/types/stock-transaction";

export function useStockTransactions(filters?: StockTransactionFilters) {
  const currentBusinessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);

  useRealtimeDomainInvalidation("stock");

  return useQuery({
    queryKey: [STOCK_TRANSACTIONS_QUERY_KEY, currentBusinessUnitId ?? null, filters],
    queryFn: () => stockTransactionsApi.getTransactions(filters),
  });
}

export function useStockTransaction(id: string) {
  useRealtimeDomainInvalidation("stock", { enabled: !!id });

  return useQuery({
    queryKey: [STOCK_TRANSACTIONS_QUERY_KEY, id],
    queryFn: () => stockTransactionsApi.getTransaction(id),
    enabled: !!id,
  });
}

export function useCreateStockTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateStockTransactionRequest) =>
      stockTransactionsApi.createTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_TRANSACTIONS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [STOCK_BALANCES_QUERY_KEY] });
    },
  });
}

export function useStockBalances(filters?: { warehouseId?: string; itemId?: string }) {
  useRealtimeDomainInvalidation("stock");

  return useQuery({
    queryKey: [STOCK_BALANCES_QUERY_KEY, filters],
    queryFn: () => stockTransactionsApi.getStockBalances(filters),
  });
}
