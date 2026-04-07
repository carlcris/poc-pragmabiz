import { apiClient } from "@/lib/api";
import type { ItemUnitOption } from "@/types/item";

export type ItemUnitOptionsResponse = {
  data: ItemUnitOption[];
  total: number;
};

export type CreateItemUnitOptionRequest = {
  uomId: string;
  qtyPerUnit: number;
  optionLabel?: string;
  isDefault?: boolean;
  isActive?: boolean;
};

export type UpdateItemUnitOptionRequest = {
  uomId?: string;
  qtyPerUnit?: number;
  optionLabel?: string;
  isDefault?: boolean;
  isActive?: boolean;
};

export const itemUnitOptionsApi = {
  getItemUnitOptions: async (itemId: string): Promise<ItemUnitOptionsResponse> =>
    apiClient.get<ItemUnitOptionsResponse>(`/api/items/${itemId}/unit-options`),

  createItemUnitOption: async (
    itemId: string,
    data: CreateItemUnitOptionRequest
  ): Promise<{ data: ItemUnitOption }> =>
    apiClient.post<{ data: ItemUnitOption }>(`/api/items/${itemId}/unit-options`, data),

  updateItemUnitOption: async (
    itemId: string,
    unitOptionId: string,
    data: UpdateItemUnitOptionRequest
  ): Promise<{ data: ItemUnitOption }> =>
    apiClient.put<{ data: ItemUnitOption }>(`/api/items/${itemId}/unit-options/${unitOptionId}`, data),

  deleteItemUnitOption: async (
    itemId: string,
    unitOptionId: string
  ): Promise<{ success: true }> =>
    apiClient.delete<{ success: true }>(`/api/items/${itemId}/unit-options/${unitOptionId}`),
};
