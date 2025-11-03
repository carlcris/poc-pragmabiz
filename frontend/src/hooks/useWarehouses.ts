import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { warehousesApi } from "@/lib/api/warehouses";
import type {
  WarehouseFilters,
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
} from "@/types/warehouse";

const WAREHOUSES_QUERY_KEY = "warehouses";

export function useWarehouses(filters?: WarehouseFilters) {
  return useQuery({
    queryKey: [WAREHOUSES_QUERY_KEY, filters],
    queryFn: () => warehousesApi.getWarehouses(filters),
    placeholderData: keepPreviousData,
  });
}

export function useWarehouse(id: string) {
  return useQuery({
    queryKey: [WAREHOUSES_QUERY_KEY, id],
    queryFn: () => warehousesApi.getWarehouse(id),
    enabled: !!id,
  });
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWarehouseRequest) => warehousesApi.createWarehouse(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WAREHOUSES_QUERY_KEY] });
    },
  });
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWarehouseRequest }) =>
      warehousesApi.updateWarehouse(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WAREHOUSES_QUERY_KEY] });
    },
  });
}

export function useDeleteWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => warehousesApi.deleteWarehouse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WAREHOUSES_QUERY_KEY] });
    },
  });
}
