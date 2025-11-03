import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { stockTransactionsApi } from "@/lib/api/stock-transactions";
import type {
  StockTransactionFilters,
  CreateStockTransactionRequest,
} from "@/types/stock-transaction";

const STOCK_TRANSACTIONS_QUERY_KEY = "stock-transactions";
const STOCK_BALANCES_QUERY_KEY = "stock-balances";

export function useStockTransactions(filters?: StockTransactionFilters) {
  return useQuery({
    queryKey: [STOCK_TRANSACTIONS_QUERY_KEY, filters],
    queryFn: () => stockTransactionsApi.getTransactions(filters),
  });
}

export function useStockTransaction(id: string) {
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
  return useQuery({
    queryKey: [STOCK_BALANCES_QUERY_KEY, filters],
    queryFn: () => stockTransactionsApi.getStockBalances(filters),
  });
}
