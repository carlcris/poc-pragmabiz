import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { quotationsApi } from "@/lib/api/quotations";
import type {
  CreateQuotationRequest,
  UpdateQuotationRequest,
  QuotationFilters,
} from "@/types/quotation";

const QUOTATIONS_KEY = "quotations";

export function useQuotations(filters?: QuotationFilters) {
  return useQuery({
    queryKey: [QUOTATIONS_KEY, filters],
    queryFn: () => quotationsApi.getQuotations(filters),
    placeholderData: filters?.cursor ? undefined : keepPreviousData,
  });
}

export function useQuotation(id: string) {
  return useQuery({
    queryKey: [QUOTATIONS_KEY, id],
    queryFn: () => quotationsApi.getQuotation(id),
    enabled: !!id,
  });
}

export function useCreateQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateQuotationRequest) => quotationsApi.createQuotation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUOTATIONS_KEY] });
    },
  });
}

export function useUpdateQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateQuotationRequest }) =>
      quotationsApi.updateQuotation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUOTATIONS_KEY] });
    },
  });
}

export function useDeleteQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => quotationsApi.deleteQuotation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUOTATIONS_KEY] });
    },
  });
}

export function useConvertToOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => quotationsApi.convertToOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUOTATIONS_KEY] });
    },
  });
}

export function useChangeQuotationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      quotationsApi.changeStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUOTATIONS_KEY] });
    },
  });
}

export function useConfirmQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, warehouseId }: { id: string; warehouseId?: string | null }) =>
      quotationsApi.confirm(id, warehouseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUOTATIONS_KEY] });
    },
  });
}
