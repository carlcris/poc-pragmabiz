import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface StockTransferItem {
  id: string;
  itemId: string;
  code: string;
  name: string;
  quantity: number;
  receivedQuantity: number;
  uomId: string;
  uom: string;
  sortOrder: number;
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

interface StockTransfer {
  id: string;
  code: string;
  date: string;
  status: string;
  notes: string | null;
  totalItems: number;
  fromWarehouse: Warehouse;
  toWarehouse: Warehouse;
  items: StockTransferItem[];
}

interface StockTransfersData {
  data: StockTransfer[];
}

export function useStockTransfers(status?: string, toWarehouseId?: string | null) {
  return useQuery({
    queryKey: ["stockTransfers", status, toWarehouseId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (toWarehouseId) params.append("to_warehouse_id", toWarehouseId);

      const response = await apiClient.get<StockTransfersData>(
        `/api/stock-transfers?${params.toString()}`
      );
      return response.data;
    },
    enabled: !!toWarehouseId, // Only fetch if warehouse ID is provided
  });
}

export function useConfirmStockTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transferId: string) => {
      const response = await apiClient.post(`/api/stock-transfers/${transferId}/confirm`, {});
      return response;
    },
    onSuccess: () => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ["stockTransfers"] });
      queryClient.invalidateQueries({ queryKey: ["vanInventory"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast.success("Stock transfer confirmed successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to confirm transfer: ${error.message}`);
    },
  });
}

interface CreateStockTransferData {
  fromWarehouseId: string;
  toWarehouseId: string;
  transferDate: string;
  notes?: string;
  fromLocationId?: string;
  toLocationId?: string;
  items: Array<{
    itemId: string;
    code: string;
    name: string;
    quantity: number;
    uomId: string;
    uomName: string;
  }>;
}

export function useCreateStockTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateStockTransferData) => {
      const response = await apiClient.post("/api/stock-transfers", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stockTransfers"] });
      toast.success("Stock transfer created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create transfer: ${error.message}`);
    },
  });
}
