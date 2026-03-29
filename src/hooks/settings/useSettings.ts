import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SettingsGroupKey, SettingsForGroup } from "@/types/settings";
import { apiClient } from "@/lib/api";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type { BusinessUnitWithAccess } from "@/types/business-unit";

const SETTINGS_QUERY_KEY = "settings";
const BUSINESS_UNITS_QUERY_KEY = "business-units";

/**
 * Fetch settings for a specific group
 */
async function fetchSettings<T extends SettingsGroupKey>(
  group: T
): Promise<SettingsForGroup<T>> {
  const response = await fetch(`/api/settings/${group}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch settings");
  }

  const { data } = await response.json();
  return data as SettingsForGroup<T>;
}

/**
 * Update settings for a specific group
 */
async function updateSettings<T extends SettingsGroupKey>(
  group: T,
  settings: Partial<SettingsForGroup<T>>
): Promise<SettingsForGroup<T>> {
  const response = await fetch(`/api/settings/${group}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update settings");
  }

  const { data } = await response.json();
  return data as SettingsForGroup<T>;
}

/**
 * Hook to fetch settings for a specific group
 */
export function useSettings<T extends SettingsGroupKey>(group: T) {
  const currentBusinessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id ?? null);
  const scopeKey = group === "company" ? "company" : currentBusinessUnitId;

  return useQuery({
    queryKey: [SETTINGS_QUERY_KEY, group, scopeKey],
    enabled: group === "company" || currentBusinessUnitId !== null,
    queryFn: () => fetchSettings(group),
    staleTime: 5 * 60 * 1000, // 5 minutes - settings don't change often
  });
}

/**
 * Hook to update settings for a specific group
 */
export function useUpdateSettings<T extends SettingsGroupKey>(group: T) {
  const queryClient = useQueryClient();
  const { currentBusinessUnit, setAvailableBusinessUnits, setCurrentBusinessUnit } =
    useBusinessUnitStore();
  const scopeKey = group === "company" ? "company" : currentBusinessUnit?.id ?? null;

  return useMutation({
    mutationFn: (settings: Partial<SettingsForGroup<T>>) =>
      updateSettings(group, settings),
    onSuccess: async (data) => {
      // Update cache with new data
      queryClient.setQueryData([SETTINGS_QUERY_KEY, group, scopeKey], data);
      // Also invalidate to ensure fresh data on next fetch
      await queryClient.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY, group, scopeKey] });

      if (group === "business_unit") {
        const businessUnitsResponse =
          await apiClient.get<{ data: BusinessUnitWithAccess[] }>("/api/business-units");
        const businessUnits = Array.isArray(businessUnitsResponse.data)
          ? businessUnitsResponse.data
          : [];

        queryClient.setQueryData([BUSINESS_UNITS_QUERY_KEY], businessUnits);
        setAvailableBusinessUnits(businessUnits);

        if (currentBusinessUnit) {
          const refreshedCurrentBusinessUnit =
            businessUnits.find((businessUnit) => businessUnit.id === currentBusinessUnit.id) ?? null;
          setCurrentBusinessUnit(refreshedCurrentBusinessUnit);
        }
      }
    },
  });
}

/**
 * Helper to invalidate all settings queries
 */
export function useInvalidateSettings() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY] });
  };
}
