import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { loadListsApi } from "@/lib/api/load-lists";
import type {
  LoadListFilters,
  CreateLoadListRequest,
  UpdateLoadListRequest,
  LoadListStatus,
  CreateLoadListSRLinkRequest,
} from "@/types/load-list";

const LOAD_LISTS_QUERY_KEY = "loadLists";

export function useLoadLists(filters?: LoadListFilters) {
  return useQuery({
    queryKey: [LOAD_LISTS_QUERY_KEY, filters],
    queryFn: () => loadListsApi.getLoadLists(filters),
    placeholderData: keepPreviousData,
  });
}

export function useLoadList(id: string) {
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
    mutationFn: ({ id, status }: { id: string; status: LoadListStatus }) =>
      loadListsApi.updateLoadListStatus(id, status),
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
      queryClient.invalidateQueries({ queryKey: ["stockRequisitions"] });
    },
  });
}

export function useLoadListSRLinks(id: string) {
  return useQuery({
    queryKey: [LOAD_LISTS_QUERY_KEY, id, "sr-links"],
    queryFn: () => loadListsApi.getLoadListSRLinks(id),
    enabled: !!id,
  });
}
