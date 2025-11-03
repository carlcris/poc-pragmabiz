import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { customersApi } from "@/lib/api/customers";
import type {
  CustomerFilters,
  CreateCustomerRequest,
  UpdateCustomerRequest,
} from "@/types/customer";

const CUSTOMERS_QUERY_KEY = "customers";

export function useCustomers(filters?: CustomerFilters) {
  return useQuery({
    queryKey: [CUSTOMERS_QUERY_KEY, filters],
    queryFn: () => customersApi.getCustomers(filters),
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: [CUSTOMERS_QUERY_KEY, id],
    queryFn: () => customersApi.getCustomer(id),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCustomerRequest) => customersApi.createCustomer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_QUERY_KEY] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomerRequest }) =>
      customersApi.updateCustomer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_QUERY_KEY] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => customersApi.deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_QUERY_KEY] });
    },
  });
}
