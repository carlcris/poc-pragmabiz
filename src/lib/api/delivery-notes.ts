import { apiClient } from "@/lib/api";
import type {
  AddDeliveryNoteItemsPayload,
  AdjustDispatchedDeliveryNoteItemPayload,
  CreateDeliveryNotePayload,
  DeliveryNoteAllocatableItem,
  DeliveryNote,
  DeliveryNoteListParams,
  DeliveryNoteListResponse,
  DispatchDeliveryNotePayload,
  MarkDispatchReadyPayload,
  RecordDeliveryNoteReceivingScanPayload,
  RecordDeliveryNoteReceivingScanResponse,
  ReceiveDirectPickupDeliveryNotePayload,
  ReceiveDeliveryNotePayload,
  ReviewDeliveryNoteReceivingExceptionPayload,
  ReviewDeliveryNoteReceivingOveragePayload,
  SubmitDeliveryNoteReceivingPayload,
} from "@/types/delivery-note";

export const deliveryNotesApi = {
  async list(params?: string | DeliveryNoteListParams): Promise<DeliveryNoteListResponse> {
    const searchParams = new URLSearchParams();
    if (typeof params === "string") {
      if (params) searchParams.set("status", params);
    } else if (params) {
      if (params.status) searchParams.set("status", params.status);
      if (params.requestingWarehouseId) {
        searchParams.set("requestingWarehouseId", params.requestingWarehouseId);
      }
      if (params.search) searchParams.set("search", params.search);
    }

    const query = searchParams.toString();
    return apiClient.get<DeliveryNoteListResponse>(
      query ? `/api/delivery-notes?${query}` : "/api/delivery-notes"
    );
  },

  async getById(id: string): Promise<DeliveryNote> {
    return apiClient.get<DeliveryNote>(`/api/delivery-notes/${id}`);
  },

  async create(data: CreateDeliveryNotePayload): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>("/api/delivery-notes", data);
  },

  async confirm(id: string): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>(`/api/delivery-notes/${id}/confirm`, {});
  },

  async startPicking(id: string): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>(`/api/delivery-notes/${id}/start-picking`, {});
  },

  async queuePicking(id: string): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>(`/api/delivery-notes/${id}/queue-picking`, {});
  },

  async markDispatchReady(id: string, data: MarkDispatchReadyPayload): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>(`/api/delivery-notes/${id}/dispatch-ready`, data);
  },

  async dispatch(id: string, data: DispatchDeliveryNotePayload): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>(`/api/delivery-notes/${id}/dispatch`, data);
  },

  async receive(id: string, data?: ReceiveDeliveryNotePayload): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>(`/api/delivery-notes/${id}/receive`, data || {});
  },

  async startReceiving(id: string): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>(`/api/delivery-notes/${id}/start-receiving`, {});
  },

  async recordReceivingScan(
    id: string,
    data: RecordDeliveryNoteReceivingScanPayload
  ): Promise<RecordDeliveryNoteReceivingScanResponse> {
    return apiClient.post<RecordDeliveryNoteReceivingScanResponse>(
      `/api/delivery-notes/${id}/receiving-scans`,
      data
    );
  },

  async voidReceivingScan(id: string, scanId: string, reason?: string): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>(
      `/api/delivery-notes/${id}/receiving-scans/${scanId}/void`,
      { reason }
    );
  },

  async submitReceiving(
    id: string,
    data?: SubmitDeliveryNoteReceivingPayload
  ): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>(`/api/delivery-notes/${id}/submit-receiving`, data || {});
  },

  async acceptReceivingException(
    id: string,
    exceptionId: string,
    data?: ReviewDeliveryNoteReceivingExceptionPayload
  ): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>(
      `/api/delivery-notes/${id}/receiving-exceptions/${exceptionId}/accept`,
      data || {}
    );
  },

  async rejectReceivingException(
    id: string,
    exceptionId: string,
    data?: ReviewDeliveryNoteReceivingExceptionPayload
  ): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>(
      `/api/delivery-notes/${id}/receiving-exceptions/${exceptionId}/reject`,
      data || {}
    );
  },

  async acceptReceivingOverage(
    id: string,
    itemId: string,
    data?: ReviewDeliveryNoteReceivingOveragePayload
  ): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>(
      `/api/delivery-notes/${id}/receiving-overages/${itemId}/accept`,
      data || {}
    );
  },

  async rejectReceivingOverage(
    id: string,
    itemId: string,
    data?: ReviewDeliveryNoteReceivingOveragePayload
  ): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>(
      `/api/delivery-notes/${id}/receiving-overages/${itemId}/reject`,
      data || {}
    );
  },

  async receiveDirectPickup(
    id: string,
    data?: ReceiveDirectPickupDeliveryNotePayload
  ): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>(`/api/delivery-notes/${id}/receive-direct-pickup`, {
      confirmDirectCustomerPickup: true,
      ...(data || {}),
    });
  },

  async void(id: string, reason?: string): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>(`/api/delivery-notes/${id}/void`, { reason });
  },

  async adjustItem(
    id: string,
    itemId: string,
    data: AdjustDispatchedDeliveryNoteItemPayload
  ): Promise<DeliveryNote> {
    return apiClient.patch<DeliveryNote>(`/api/delivery-notes/${id}/items/${itemId}`, data);
  },

  async getAllocatableItems(id: string): Promise<{ data: DeliveryNoteAllocatableItem[] }> {
    return apiClient.get<{ data: DeliveryNoteAllocatableItem[] }>(
      `/api/delivery-notes/${id}/allocatable-items`
    );
  },

  async addItems(id: string, data: AddDeliveryNoteItemsPayload): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>(`/api/delivery-notes/${id}/items`, data);
  },
};
