import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

type CapabilitiesResponse = {
  data: {
    action: string;
    capabilities: Record<string, boolean>;
  };
};

export function useGranularCapabilities(keys: readonly string[], action = "view") {
  const uniqueKeys = Array.from(new Set(keys)).sort();

  return useQuery({
    queryKey: ["granular-capabilities", action, uniqueKeys],
    queryFn: async () => {
      if (uniqueKeys.length === 0) return {};

      const params = new URLSearchParams({
        action,
        keys: uniqueKeys.join(","),
      });
      const response = await apiClient.get<CapabilitiesResponse>(`/api/rbac/capabilities?${params}`);
      return response.data.capabilities;
    },
    enabled: uniqueKeys.length > 0,
    staleTime: 0,
    gcTime: 1000 * 60 * 5,
  });
}
