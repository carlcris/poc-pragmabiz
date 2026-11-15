/**
 * Business Units Hook
 *
 * React hook for fetching and managing business units
 *
 * JWT-BASED APPROACH:
 * The API validates access and refreshes the session before the client applies the new scope.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { WAREHOUSE_DASHBOARD_QUERY_KEY } from "@/hooks/queryKeys";
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
  requires_refresh: boolean;
  token: string;
  refreshToken: string;
};

/**
 * Fetch business units accessible by current user
 */
export function useBusinessUnits() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoggingOut = useAuthStore((state) => state.isLoggingOut);
  return useQuery({
    queryKey: ["business-units"],
    enabled: isAuthenticated && !isLoggingOut,
    queryFn: async ({ signal }) => {
      // apiClient.get returns the JSON response directly, not wrapped
      const response = await apiClient.get<BusinessUnitsResponse>("/api/business-units", {
        signal,
      });

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

/** Set the active business unit once the browser and server sessions agree. */
export function useSetBusinessUnitContext(options?: { silent?: boolean }) {
  const queryClient = useQueryClient();
  const silent = options?.silent ?? false;

  return useMutation({
    mutationFn: async (businessUnitId: string) => {
      const { isSwitching, setSwitching } = useBusinessUnitStore.getState();
      if (isSwitching) throw new Error("A business unit switch is already in progress");

      setSwitching(true);
      let reloadingToReconcile = false;
      try {
        // Dashboard requests use the session cookie, which changes during the switch.
        const dashboardKey = [WAREHOUSE_DASHBOARD_QUERY_KEY];
        await queryClient.cancelQueries({ queryKey: dashboardKey });
        const response = await apiClient.post<SetContextResponse>(
          "/api/business-units/set-context",
          {
            business_unit_id: businessUnitId,
          }
        );

        let accessToken: string;
        try {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: response.token,
            refresh_token: response.refreshToken,
          });
          if (sessionError) throw sessionError;
          if (!data.session) throw new Error("Session sync returned no session");
          accessToken = data.session.access_token;
        } catch (error) {
          // The POST already changed the server cookie. Keep old data hidden until the
          // new document hydrates from verified server context, with an empty query cache.
          reloadingToReconcile = true;
          queryClient.removeQueries({ queryKey: dashboardKey });
          window.location.reload();
          throw new Error("Failed to sync authentication session", { cause: error });
        }

        useAuthStore.getState().setToken(accessToken);
        const { availableBusinessUnits, setCurrentBusinessUnit } = useBusinessUnitStore.getState();
        const selectedBusinessUnit =
          availableBusinessUnits.find((unit) => unit.id === response.business_unit.id) ??
          response.business_unit;

        // Silent switches retain other queries, but dashboard data must come from the new scope.
        if (silent) queryClient.removeQueries({ queryKey: dashboardKey });
        setCurrentBusinessUnit(selectedBusinessUnit);
        if (silent) {
          void queryClient.invalidateQueries({ queryKey: ["granular-capabilities"] });
        } else {
          queryClient.clear();
          void queryClient.resetQueries();
        }
        return response;
      } finally {
        if (!reloadingToReconcile) setSwitching(false);
      }
    },
  });
}
