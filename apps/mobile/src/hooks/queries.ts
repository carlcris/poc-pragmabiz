import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as businessUnitsApi from "@/api/businessUnits";
import * as dashboardApi from "@/api/dashboard";
import * as itemInfoApi from "@/api/itemInfo";
import * as pickingApi from "@/api/picking";
import * as receivingApi from "@/api/receiving";
import { useAuthStore } from "@/stores/authStore";
import type { DashboardData } from "@/contracts/dashboard";
import type { PickListDetail, PickListSummary } from "@/contracts/picking";
import type {
  RecordDeliveryNoteReceivingScanPayload,
  SubmitDeliveryNoteReceivingPayload
} from "@/contracts/receiving";

export const queryKeys = {
  businessUnits: ["business-units"] as const,
  dashboard: ["dashboard"] as const,
  loadLists: (status: string, search: string) => ["load-lists", status, search] as const,
  loadListReceiving: (id: string) => ["load-list-receiving", id] as const,
  deliveryNotes: (status: string, search: string) => ["delivery-notes", status, search] as const,
  deliveryNote: (id: string) => ["delivery-note", id] as const,
  scannedItemInfo: (payload: string) => ["scanned-item-info", payload] as const,
  pickLists: (status: string, search: string) => ["pick-lists", status, search] as const,
  pickList: (id: string) => ["pick-list", id] as const
};

export const useBusinessUnits = () =>
  useQuery({
    queryKey: queryKeys.businessUnits,
    queryFn: businessUnitsApi.listBusinessUnits
  });

export const useSetBusinessUnit = () => {
  const client = useQueryClient();
  const { session, setSession } = useAuthStore();

  return useMutation({
    mutationFn: businessUnitsApi.setBusinessUnitContext,
    onSuccess: async (result) => {
      if (session) {
        await setSession({
          ...session,
          token: result.token,
          refreshToken: result.refreshToken,
          cookieHeader: result.cookieHeader,
          currentBusinessUnit: {
            id: result.business_unit.id,
            code: result.business_unit.code,
            name: result.business_unit.name
          }
        });
      }

      client.removeQueries({ queryKey: queryKeys.dashboard });
      client.removeQueries({ queryKey: ["load-lists"] });
      client.removeQueries({ queryKey: ["load-list-receiving"] });
      client.removeQueries({ queryKey: ["delivery-notes"] });
      client.removeQueries({ queryKey: ["delivery-note"] });
      client.removeQueries({ queryKey: ["pick-lists"] });
      client.removeQueries({ queryKey: ["pick-list"] });
      await client.invalidateQueries({ queryKey: queryKeys.businessUnits });
    }
  });
};

const syncPickListCaches = (client: QueryClient, updated: PickListDetail) => {
  client.setQueryData(queryKeys.pickList(updated.id), updated);

  const listCaches = client.getQueriesData<PickListSummary[]>({ queryKey: ["pick-lists"] });
  for (const [queryKey, cached] of listCaches) {
    if (!cached) continue;
    client.setQueryData(
      queryKey,
      cached.map((row) =>
        row.id === updated.id
          ? {
              ...row,
              code: updated.code || row.code,
              status: updated.status,
              lines: updated.lines,
              requiredDate: updated.requiredDate
            }
          : row
      )
    );
  }

  client.setQueryData<DashboardData | undefined>(queryKeys.dashboard, (cached) => {
    if (!cached) return cached;
    return {
      ...cached,
      queues: {
        ...cached.queues,
        pick_list: cached.queues.pick_list.map((row) =>
          row.id === updated.id ? { ...row, status: updated.status } : row
        )
      }
    };
  });
};

export const useDashboard = () =>
  useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: dashboardApi.getDashboard
  });

export const useLoadLists = (status: string, search: string) =>
  useQuery({
    queryKey: queryKeys.loadLists(status, search),
    queryFn: () => receivingApi.listLoadLists(status, search)
  });

export const useLoadListReceiving = (id: string) =>
  useQuery({
    queryKey: queryKeys.loadListReceiving(id),
    queryFn: () => receivingApi.getLoadListReceiving(id),
    enabled: Boolean(id)
  });

export const useDeliveryNotes = (status: string, search: string) =>
  useQuery({
    queryKey: queryKeys.deliveryNotes(status, search),
    queryFn: () => receivingApi.listDeliveryNotes(status, search)
  });

export const useDeliveryNote = (id: string) =>
  useQuery({
    queryKey: queryKeys.deliveryNote(id),
    queryFn: () => receivingApi.getDeliveryNote(id)
  });

export const useScannedItemInfo = (payload: string) =>
  useQuery({
    queryKey: queryKeys.scannedItemInfo(payload),
    queryFn: () => itemInfoApi.getScannedItemInfo(payload),
    enabled: Boolean(payload.trim())
  });

export const useStartReceiving = (id: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => receivingApi.startReceiving(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.deliveryNote(id) });
    }
  });
};

export const useRecordDeliveryNoteReceivingScan = (id: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordDeliveryNoteReceivingScanPayload) =>
      receivingApi.recordDeliveryNoteReceivingScan(id, data),
    onSuccess: async (response) => {
      client.setQueryData(queryKeys.deliveryNote(id), response.deliveryNote);
      await client.invalidateQueries({ queryKey: ["delivery-notes"] });
      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
    }
  });
};

export const useSubmitReceiving = (id: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: SubmitDeliveryNoteReceivingPayload) => receivingApi.submitReceiving(id, data),
    onSuccess: async (updated) => {
      client.setQueryData(queryKeys.deliveryNote(id), updated);
      await client.invalidateQueries({ queryKey: ["delivery-notes"] });
      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
    }
  });
};

export const usePickLists = (status: string, search: string) =>
  useQuery({
    queryKey: queryKeys.pickLists(status, search),
    queryFn: () => pickingApi.listPickLists({ status, search })
  });

export const usePickList = (id: string) =>
  useQuery({
    queryKey: queryKeys.pickList(id),
    queryFn: () => pickingApi.getPickList(id)
  });

export const useSetPickListStatus = (id: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (status: "in_progress" | "paused" | "done") =>
      pickingApi.setPickListStatus(id, status),
    onSuccess: async (updated) => {
      syncPickListCaches(client, updated);
      await client.invalidateQueries({ queryKey: queryKeys.pickList(id) });
      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
    }
  });
};

export const useUpdatePickedItems = (id: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (
      items: {
        deliveryNoteItemId: string;
        pickedQty: number;
        batchLocationSku?: string | null;
        pickedLocationId?: string | null;
        pickedBatchCode?: string | null;
        pickedBatchReceivedAt?: string | null;
      }[]
    ) =>
      pickingApi.updatePickedItems(id, items),
    onSuccess: async (updated) => {
      syncPickListCaches(client, updated);
      await client.invalidateQueries({ queryKey: queryKeys.pickList(id) });
      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
    }
  });
};
