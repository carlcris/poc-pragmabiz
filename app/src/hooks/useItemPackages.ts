/**
 * React Hook for managing item packages
 * Provides CRUD operations for item packaging
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export type ItemPackage = {
  id: string;
  packType: string;
  packName: string;
  qtyPerPack: number;
  uomId?: string;
  uom?: {
    id: string;
    code: string;
    name: string;
    symbol?: string;
  };
  barcode?: string;
  isDefault: boolean;
  isBasePackage: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreatePackageInput = {
  packType: string;
  packName: string;
  qtyPerPack: number;
  uomId?: string;
  barcode?: string;
  isDefault?: boolean;
  isActive?: boolean;
};

export type UpdatePackageInput = Partial<CreatePackageInput>;

// Fetch all packages for an item
export function useItemPackages(itemId: string) {
  return useQuery({
    queryKey: ['items', itemId, 'packages'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: ItemPackage[] }>(
        `/api/items/${itemId}/packages`
      );
      return response.data;
    },
    enabled: !!itemId,
  });
}

// Fetch a specific package
export function useItemPackage(itemId: string, packageId: string) {
  return useQuery({
    queryKey: ['items', itemId, 'packages', packageId],
    queryFn: async () => {
      const response = await apiClient.get<{ data: ItemPackage }>(
        `/api/items/${itemId}/packages/${packageId}`
      );
      return response.data;
    },
    enabled: !!itemId && !!packageId,
  });
}

// Create a new package
export function useCreateItemPackage(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePackageInput) => {
      const response = await apiClient.post<{ data: ItemPackage; message: string }>(
        `/api/items/${itemId}/packages`,
        input
      );
      return response;
    },
    onSuccess: () => {
      // Invalidate packages list
      queryClient.invalidateQueries({ queryKey: ['items', itemId, 'packages'] });
    },
  });
}

// Update a package
export function useUpdateItemPackage(itemId: string, packageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePackageInput) => {
      const response = await apiClient.put<{ data: ItemPackage; message: string }>(
        `/api/items/${itemId}/packages/${packageId}`,
        input
      );
      return response;
    },
    onSuccess: () => {
      // Invalidate both the specific package and the list
      queryClient.invalidateQueries({ queryKey: ['items', itemId, 'packages', packageId] });
      queryClient.invalidateQueries({ queryKey: ['items', itemId, 'packages'] });
    },
  });
}

// Delete a package
export function useDeleteItemPackage(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (packageId: string) => {
      const response = await apiClient.delete<{ message: string }>(
        `/api/items/${itemId}/packages/${packageId}`
      );
      return response;
    },
    onSuccess: () => {
      // Invalidate packages list
      queryClient.invalidateQueries({ queryKey: ['items', itemId, 'packages'] });
    },
  });
}

// Get the base package for an item (helper)
export function useBasePackage(itemId: string) {
  const { data: packages, ...query } = useItemPackages(itemId);

  const basePackage = packages?.find((pkg) => pkg.isBasePackage);

  return {
    ...query,
    data: basePackage,
  };
}

// Get active packages for an item (helper for UI selectors)
export function useActivePackages(itemId: string) {
  const { data: packages, ...query } = useItemPackages(itemId);

  const activePackages = packages?.filter((pkg) => pkg.isActive) || [];

  return {
    ...query,
    data: activePackages,
  };
}
