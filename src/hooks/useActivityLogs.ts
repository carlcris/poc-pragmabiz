import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export type ActivityLogOutcome = "succeeded" | "failed";
export type ActivityLogSource = "web" | "mobile" | "tablet" | "api" | "system";

export type ActivityLogFilters = {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  timeZone?: string;
  search?: string;
  outcome?: ActivityLogOutcome | "all";
  source?: ActivityLogSource | "all";
};

export type ActivityLogRow = {
  id: string;
  occurred_at: string;
  request_id: string;
  actor_type: "user" | "system" | "anonymous";
  actor_label: string | null;
  user_id: string | null;
  business_unit_id: string | null;
  source: ActivityLogSource;
  http_method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | null;
  route: string | null;
  action: string;
  resource_type: string;
  entity_id: string | null;
  entity_code: string | null;
  entity_label: string | null;
  outcome: ActivityLogOutcome;
  http_status: number | null;
  duration_ms: number | null;
  error_code: string | null;
  message_key: string;
  display_message: string;
};

export type ActivityLogsResponse = {
  data: ActivityLogRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    startDate: string | null;
    endDate: string | null;
    timeZone: string | null;
    search: string | null;
    outcome: ActivityLogOutcome | null;
    source: ActivityLogSource | null;
  };
};

export function useActivityLogs(filters: ActivityLogFilters) {
  return useQuery<ActivityLogsResponse>({
    queryKey: ["activity-logs", filters],
    queryFn: async () => {
      const { outcome, source, ...baseFilters } = filters;
      const params: Record<string, string | number | undefined> = {
        ...baseFilters,
        outcome: outcome && outcome !== "all" ? outcome : undefined,
        source: source && source !== "all" ? source : undefined,
      };

      return apiClient.get<ActivityLogsResponse>("/api/admin/activity-logs", { params });
    },
    staleTime: 30_000,
  });
}
