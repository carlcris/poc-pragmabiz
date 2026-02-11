/**
 * Business Units Hook
 *
 * React hook for fetching and managing business units
 *
 * JWT-BASED APPROACH:
 * When switching business units:
 * 1. Call API to validate access (calls update_current_business_unit DB function)
 * 2. Update Zustand store with new BU
 * 3. Refresh Supabase session to get new JWT with updated current_business_unit_id claim
 * 4. Invalidate all queries to refetch data with new BU context from JWT
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { useAuthStore } from "@/stores/authStore";
import type { BusinessUnitWithAccess } from "@/types/business-unit";
import { supabase } from "@/lib/supabase/client";

type BusinessUnitsResponse = {
  data: BusinessUnitWithAccess[];
};

type SetContextResponse = {
  success: boolean;
  message: string;
  business_unit_id: string;
  business_unit: BusinessUnitWithAccess;
  requires_refresh: boolean; // Flag indicating session refresh is needed
};

type SetSessionPayload = {
  accessToken: string;
  refreshToken: string;
};

/**
 * Fetch business units accessible by current user
 */
export function useBusinessUnits() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ["business-units"],
    enabled: isAuthenticated,
    queryFn: async () => {
      // apiClient.get returns the JSON response directly, not wrapped
      const response = await apiClient.get<BusinessUnitsResponse>("/api/business-units");

      // Validate response structure
      if (!response.data) {
        throw new Error("Invalid response from business units API");
      }

      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Retry once on failure
  });
}

/**
 * Set the active business unit context
 *
 * JWT-BASED APPROACH:
 * 1. Validates access via API (calls update_current_business_unit DB function)
 * 2. Updates Zustand store
 * 3. Refreshes Supabase session to get new JWT with current_business_unit_id claim
 * 4. Invalidates queries to refetch with new BU context (optional - can be silenced for initial load)
 */
export function useSetBusinessUnitContext(options?: { silent?: boolean }) {
  const queryClient = useQueryClient();
  const { setCurrentBusinessUnit } = useBusinessUnitStore();
  const silent = options?.silent ?? false;

  return useMutation({
    mutationFn: async (businessUnitId: string) => {
      // Step 1: Call API to validate access
      const response = await apiClient.post<SetContextResponse>("/api/business-units/set-context", {
        business_unit_id: businessUnitId,
      });

      // Step 2: If API requires session refresh, do it now
      if (response.requires_refresh) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !refreshed.session) {
          throw new Error("Failed to refresh authentication session");
        }

        await apiClient.post("/api/auth/set-session", {
          accessToken: refreshed.session.access_token,
          refreshToken: refreshed.session.refresh_token,
        } satisfies SetSessionPayload);

        useAuthStore.getState().setToken(refreshed.session.access_token);
      }

      return response;
    },
    onSuccess: (response) => {
      // Update current business unit in store first
      if (response.business_unit) {
        setCurrentBusinessUnit(response.business_unit as BusinessUnitWithAccess);
      }

      // Only clear and refetch queries if not in silent mode
      // Silent mode is used during initial load to prevent flickering
      if (!silent) {
        // SECURITY: Clear ALL cached data FIRST to prevent data leakage from previous BU
        // This must happen before updating the store to avoid race conditions
        queryClient.clear();

        // Force immediate refetch of all queries with new BU context from JWT
        // resetQueries forces all queries back to fetching state
        queryClient.resetQueries();
      }
    },
  });
}

/**
 * Initialize business unit context
 * Loads available BUs and sets default if none is selected
 */
export function useInitializeBusinessUnit() {
  const { data: businessUnits, isLoading } = useBusinessUnits();
  const { mutate: setContext } = useSetBusinessUnitContext();
  const { currentBusinessUnit, getDefaultBusinessUnit } = useBusinessUnitStore();

  // Auto-select default business unit if none is currently selected
  if (!isLoading && businessUnits && !currentBusinessUnit) {
    const defaultBU = getDefaultBusinessUnit();
    if (defaultBU) {
      setContext(defaultBU.id);
    } else if (businessUnits.length > 0) {
      // If no default, select the first available
      setContext(businessUnits[0].id);
    }
  }

  return {
    businessUnits,
    isLoading,
    currentBusinessUnit,
  };
}
