/**
 * React Hook for creating items with packages atomically
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export type CreateItemWithPackagesInput = {
  itemCode: string;
  itemName: string;
  itemDescription?: string;
  itemType?: 'raw_material' | 'finished_good' | 'asset' | 'service';
  basePackage: {
    packName: string;
    packType?: string;
    uomId?: string;
  };
  standardCost?: number;
  listPrice?: number;
  additionalPackages?: Array<{
    packType: string;
    packName: string;
    qtyPerPack: number;
    uomId?: string;
    barcode?: string;
    isActive?: boolean;
  }>;
};

export type CreateItemWithPackagesResult = {
  item: {
    id: string;
    itemCode: string;
    itemName: string;
    description?: string;
    itemType: string;
    packageId: string;
    setupComplete: boolean;
    standardCost: number;
    listPrice: number;
    basePackage: {
      id: string;
      pack_name: string;
      pack_type: string;
      qty_per_pack: number;
      uom_id?: string;
    };
    createdAt: string;
    updatedAt: string;
  };
  packages: Array<{
    id: string;
    packType: string;
    packName: string;
    qtyPerPack: number;
    uomId?: string;
    barcode?: string;
    isDefault: boolean;
    isActive: boolean;
  }>;
};

export function useCreateItemWithPackages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateItemWithPackagesInput) => {
      const response = await apiClient.post<{
        data: CreateItemWithPackagesResult;
        message: string;
      }>('/api/items/create-with-packages', input);
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate items list
      queryClient.invalidateQueries({ queryKey: ['items'] });

      // Set the new item in cache
      queryClient.setQueryData(['items', data.item.id], data.item);

      // Set the packages in cache
      queryClient.setQueryData(['items', data.item.id, 'packages'], data.packages);
    },
  });
}
