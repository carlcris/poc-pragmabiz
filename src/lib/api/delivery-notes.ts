import { apiClient } from "@/lib/api";
import type {
  AddDeliveryNoteItemsPayload,
  AdjustDispatchedDeliveryNoteItemPayload,
  CreateDeliveryNotePayload,
  DeliveryNoteAllocatableItem,
  DeliveryNote,
  DeliveryNoteListResponse,
  DispatchDeliveryNotePayload,
  MarkDispatchReadyPayload,
  ReceiveDirectPickupDeliveryNotePayload,
  ReceiveDeliveryNotePayload,
} from "@/types/delivery-note";

export const deliveryNotesApi = {
  async list(status?: string): Promise<DeliveryNoteListResponse> {
    if (!status) return apiClient.get<DeliveryNoteListResponse>("/api/delivery-notes");
    return apiClient.get<DeliveryNoteListResponse>(`/api/delivery-notes?status=${status}`);
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

  async adjustItem(id: string, itemId: string, data: AdjustDispatchedDeliveryNoteItemPayload): Promise<DeliveryNote> {
    return apiClient.patch<DeliveryNote>(`/api/delivery-notes/${id}/items/${itemId}`, data);
  },

  async getAllocatableItems(id: string): Promise<{ data: DeliveryNoteAllocatableItem[] }> {
    return apiClient.get<{ data: DeliveryNoteAllocatableItem[] }>(`/api/delivery-notes/${id}/allocatable-items`);
  },

  async addItems(id: string, data: AddDeliveryNoteItemsPayload): Promise<DeliveryNote> {
    return apiClient.post<DeliveryNote>(`/api/delivery-notes/${id}/items`, data);
  },
};
