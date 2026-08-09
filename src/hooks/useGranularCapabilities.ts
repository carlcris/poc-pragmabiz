import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type { PermissionAction, ResourcePermission } from "@/types/rbac";

type CapabilitiesResponse = {
  data: {
    businessUnitId: string | null;
    capabilities: Record<string, ResourcePermission>;
  };
};

const isAllowed = (permission: ResourcePermission | undefined, action: PermissionAction) => {
  if (!permission) return false;

  switch (action) {
    case "view":
      return permission.can_view;
    case "create":
      return permission.can_create;
    case "edit":
      return permission.can_edit;
    case "delete":
      return permission.can_delete;
  }
};

export function useGranularCapabilities(
  keys: readonly string[],
  action: PermissionAction = "view"
) {
  const uniqueKeys = Array.from(new Set(keys)).sort();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const businessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id ?? null);
  const availableBusinessUnitCount = useBusinessUnitStore(
    (state) => state.availableBusinessUnits.length
  );
  const isBusinessUnitLoading = useBusinessUnitStore((state) => state.isLoading);
  const hasBusinessUnitHydrated = useBusinessUnitStore((state) => state.hasHydrated);
  const hasResolvedBusinessUnit = businessUnitId !== null || availableBusinessUnitCount === 0;

  return useQuery({
    queryKey: ["granular-capabilities", userId, businessUnitId],
    queryFn: async () => {
      const response = await apiClient.get<CapabilitiesResponse>("/api/rbac/capabilities");
      if (response.data.businessUnitId !== businessUnitId) {
        throw new Error("Capability scope does not match the active business unit");
      }
      return response.data;
    },
    select: ({ capabilities }) =>
      Object.fromEntries(
        uniqueKeys.map((key) => [key, isAllowed(capabilities[key], action)])
      ) as Record<string, boolean>,
    enabled:
      uniqueKeys.length > 0 &&
      userId !== null &&
      hasBusinessUnitHydrated &&
      !isBusinessUnitLoading &&
      hasResolvedBusinessUnit,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
