/**
 * Stubs for removed packaging functionality.
 * Packaging is deprecated in favor of item UOM, so these hooks return
 * empty data and no-op mutations to keep callers stable.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type ItemPackage = {
  id: string;
  packType?: string;
  packName?: string;
  qtyPerPack?: number;
  uomId?: string;
  uom?: {
    id: string;
    code: string;
    name: string;
    symbol?: string;
  };
  barcode?: string;
  isDefault?: boolean;
  isBasePackage?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CreatePackageInput = Record<string, never>;
export type UpdatePackageInput = Record<string, never>;

export function useItemPackages(itemId: string) {
  return useQuery({
    queryKey: ["items", itemId, "packages"],
    queryFn: async () => [] as ItemPackage[],
    enabled: !!itemId,
    staleTime: Infinity,
  });
}

export function useItemPackage(itemId: string, packageId: string) {
  return useQuery({
    queryKey: ["items", itemId, "packages", packageId],
    queryFn: async () => null as ItemPackage | null,
    enabled: !!itemId && !!packageId,
    staleTime: Infinity,
  });
}

export function useCreateItemPackage(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      throw new Error("Packaging is deprecated and cannot be created.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["items", itemId, "packages"] });
    },
  });
}

export function useUpdateItemPackage(itemId: string, packageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      throw new Error("Packaging is deprecated and cannot be updated.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["items", itemId, "packages", packageId] });
      queryClient.invalidateQueries({ queryKey: ["items", itemId, "packages"] });
    },
  });
}

export function useDeleteItemPackage(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      throw new Error("Packaging is deprecated and cannot be deleted.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["items", itemId, "packages"] });
    },
  });
}

export function useBasePackage() {
  return {
    data: null as ItemPackage | null,
    isLoading: false,
    isError: false,
  };
}

export function useActivePackages() {
  return {
    data: [] as ItemPackage[],
    isLoading: false,
    isError: false,
  };
}
