import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface VanInventoryItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  description: string | null;
  currentStock: number;
  unitPrice: number;
  reorderPoint: number;
  categoryId: string | null;
  categoryName: string | null;
}

interface VanInventorySummary {
  totalItems: number;
  itemsInStock: number;
  lowStockItems: number;
  outOfStockItems: number;
}

interface VanInventoryData {
  warehouse: {
    id: string;
    code: string;
    name: string;
    isVan: boolean;
  };
  inventory: VanInventoryItem[];
  summary: VanInventorySummary;
}

export function useVanInventory(warehouseId: string | null | undefined) {
  return useQuery({
    queryKey: ["vanInventory", warehouseId],
    queryFn: async () => {
      if (!warehouseId) {
        throw new Error("No warehouse ID provided");
      }

      const response = await apiClient.get<{ data: VanInventoryData }>(
        `/api/warehouses/${warehouseId}/inventory`
      );
      return response.data;
    },
    enabled: !!warehouseId,
  });
}
