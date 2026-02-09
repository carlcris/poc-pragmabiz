import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { grnsApi } from "@/lib/api/grns";
import type {
  GRNFilters,
  CreateGRNRequest,
  UpdateGRNRequest,
  GRNStatus,
  CreateDamagedItemRequest,
  UpdateDamagedItemRequest,
} from "@/types/grn";

const GRNS_QUERY_KEY = "grns";
const DAMAGED_ITEMS_QUERY_KEY = "damagedItems";

export function useGRNs(filters?: GRNFilters) {
  return useQuery({
    queryKey: [GRNS_QUERY_KEY, filters],
    queryFn: () => grnsApi.getGRNs(filters),
    placeholderData: keepPreviousData,
  });
}

export function useGRN(id: string) {
  return useQuery({
    queryKey: [GRNS_QUERY_KEY, id],
    queryFn: () => grnsApi.getGRN(id),
    enabled: !!id,
  });
}

export function useCreateGRN() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateGRNRequest) => grnsApi.createGRN(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GRNS_QUERY_KEY] });
    },
  });
}

export function useUpdateGRN() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGRNRequest }) =>
      grnsApi.updateGRN(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [GRNS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [GRNS_QUERY_KEY, variables.id] });
    },
  });
}

export function useDeleteGRN() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => grnsApi.deleteGRN(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GRNS_QUERY_KEY] });
    },
  });
}

export function useUpdateGRNStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: GRNStatus }) =>
      grnsApi.updateGRNStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GRNS_QUERY_KEY] });
    },
  });
}

export function useSubmitGRN() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => grnsApi.submitGRN(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GRNS_QUERY_KEY] });
    },
  });
}

export function useApproveGRN() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => grnsApi.approveGRN(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GRNS_QUERY_KEY] });
      // Also invalidate load lists as approval updates inventory
      queryClient.invalidateQueries({ queryKey: ["loadLists"] });
    },
  });
}

export function useRejectGRN() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => grnsApi.rejectGRN(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GRNS_QUERY_KEY] });
    },
  });
}

// Damaged Items hooks
export function useDamagedItems(grnId: string) {
  return useQuery({
    queryKey: [DAMAGED_ITEMS_QUERY_KEY, grnId],
    queryFn: () => grnsApi.getDamagedItems(grnId),
    enabled: !!grnId,
  });
}

export function useCreateDamagedItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ grnId, data }: { grnId: string; data: CreateDamagedItemRequest }) =>
      grnsApi.createDamagedItem(grnId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DAMAGED_ITEMS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [GRNS_QUERY_KEY] });
    },
  });
}

export function useUpdateDamagedItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDamagedItemRequest }) =>
      grnsApi.updateDamagedItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DAMAGED_ITEMS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [GRNS_QUERY_KEY] });
    },
  });
}

export function useDeleteDamagedItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => grnsApi.deleteDamagedItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DAMAGED_ITEMS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [GRNS_QUERY_KEY] });
    },
  });
}
