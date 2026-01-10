import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface VanWarehouse {
  id: string;
  code: string;
  name: string;
  isVan: boolean;
}

interface UserVanWarehouseData {
  userId: string;
  fullName: string;
  email: string;
  employeeId: string | null;
  vanWarehouseId: string | null;
  vanWarehouse: VanWarehouse | null;
}

export function useUserVanWarehouse() {
  return useQuery({
    queryKey: ["userVanWarehouse"],
    queryFn: async () => {
      const response = await apiClient.get<{ data: UserVanWarehouseData }>(
        "/api/users/me/van-warehouse"
      );
      return response.data;
    },
  });
}

export function useAssignVanWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vanWarehouseId: string | null) => {
      const response = await apiClient.patch("/api/users/me/van-warehouse", {
        van_warehouse_id: vanWarehouseId,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userVanWarehouse"] });
      toast.success("Van warehouse assignment updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update assignment: ${error.message}`);
    },
  });
}

interface VanItem {
  id: string;
  code: string;
  name: string;
  description: string;
  sellPrice: number;
  availableStock: number;
  uomId: string;
  uomName: string;
  categoryName: string;
}

interface VanInventoryData {
  data: VanItem[];
}

export function useVanItems(warehouseId?: string | null, search?: string) {
  return useQuery({
    queryKey: ["vanItems", warehouseId, search],
    queryFn: async () => {
      if (!warehouseId) {
        return { data: [] };
      }

      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const response = await apiClient.get<VanInventoryData>(
        `/api/warehouses/${warehouseId}/inventory?${params.toString()}`
      );
      return response.data;
    },
    enabled: !!warehouseId,
  });
}

interface VanSalesStats {
  todaySales: number;
  transactions: number;
  itemsSold: number;
  invoices: unknown[];
}

export function useVanSalesStats() {
  return useQuery({
    queryKey: ["vanSalesStats"],
    queryFn: async () => {
      try {
        const data = await apiClient.get<VanSalesStats>("/api/van-sales/stats");
        return data || {
          todaySales: 0,
          transactions: 0,
          itemsSold: 0,
          invoices: [],
        };
      } catch {
        // Return default values on error
        return {
          todaySales: 0,
          transactions: 0,
          itemsSold: 0,
          invoices: [],
        };
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
