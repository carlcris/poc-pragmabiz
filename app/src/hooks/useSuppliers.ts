import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { suppliersApi } from "@/lib/api/suppliers";
import type {
  SupplierFilters,
  CreateSupplierRequest,
  UpdateSupplierRequest,
} from "@/types/supplier";

const SUPPLIERS_QUERY_KEY = "suppliers";

export function useSuppliers(filters?: SupplierFilters) {
  return useQuery({
    queryKey: [SUPPLIERS_QUERY_KEY, filters],
    queryFn: () => suppliersApi.getSuppliers(filters),
    placeholderData: keepPreviousData,
  });
}

export function useSupplier(id: string) {
  return useQuery({
    queryKey: [SUPPLIERS_QUERY_KEY, id],
    queryFn: () => suppliersApi.getSupplier(id),
    enabled: !!id,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSupplierRequest) => suppliersApi.createSupplier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUPPLIERS_QUERY_KEY] });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSupplierRequest }) =>
      suppliersApi.updateSupplier(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUPPLIERS_QUERY_KEY] });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => suppliersApi.deleteSupplier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUPPLIERS_QUERY_KEY] });
    },
  });
}
