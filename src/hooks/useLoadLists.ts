import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { LOAD_LISTS_QUERY_KEY, STOCK_REQUISITIONS_QUERY_KEY } from "@/hooks/queryKeys";
import { useRealtimeDomainInvalidation } from "@/hooks/useRealtimeDomainInvalidation";
import { loadListsApi } from "@/lib/api/load-lists";
import type {
  LoadListFilters,
  CreateLoadListRequest,
  UpdateLoadListRequest,
  UpdateLoadListStatusRequest,
  CreateLoadListSRLinkRequest,
} from "@/types/load-list";

export function useLoadLists(filters?: LoadListFilters) {
  useRealtimeDomainInvalidation("purchasing", { queryKeys: [LOAD_LISTS_QUERY_KEY] });

  return useQuery({
    queryKey: [LOAD_LISTS_QUERY_KEY, filters],
    queryFn: () => loadListsApi.getLoadLists(filters),
    placeholderData: keepPreviousData,
  });
}

export function useLoadList(id: string) {
  useRealtimeDomainInvalidation("purchasing", {
    queryKeys: [LOAD_LISTS_QUERY_KEY],
    enabled: !!id,
  });

  return useQuery({
    queryKey: [LOAD_LISTS_QUERY_KEY, id],
    queryFn: () => loadListsApi.getLoadList(id),
    enabled: !!id,
  });
}

export function useCreateLoadList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateLoadListRequest) => loadListsApi.createLoadList(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY] });
    },
  });
}

export function useUpdateLoadList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLoadListRequest }) =>
      loadListsApi.updateLoadList(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY] });
    },
  });
}

export function useDeleteLoadList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => loadListsApi.deleteLoadList(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY] });
    },
  });
}

export function useUpdateLoadListStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLoadListStatusRequest }) =>
      loadListsApi.updateLoadListStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY] });
    },
  });
}

export function useLinkSRsToLoadList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateLoadListSRLinkRequest }) =>
      loadListsApi.linkSRsToLoadList(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUISITIONS_QUERY_KEY] });
    },
  });
}

export function useLoadListSRLinks(id: string) {
  useRealtimeDomainInvalidation("purchasing", {
    queryKeys: [LOAD_LISTS_QUERY_KEY],
    enabled: !!id,
  });

  return useQuery({
    queryKey: [LOAD_LISTS_QUERY_KEY, id, "sr-links"],
    queryFn: () => loadListsApi.getLoadListSRLinks(id),
    enabled: !!id,
  });
}
