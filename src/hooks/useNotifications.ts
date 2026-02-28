import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { Notification } from "@/types/notifications";
import { useAuthStore } from "@/stores/authStore";
import { useRealtimeDomainInvalidation } from "@/hooks/useRealtimeDomainInvalidation";
import { NOTIFICATIONS_QUERY_KEY } from "@/hooks/queryKeys";

type NotificationsResponse = {
  data: Notification[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
};

export function useNotifications({
  unreadOnly = false,
  limit = 10,
  offset = 0,
  enabled = true,
}: {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
  enabled?: boolean;
} = {}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  useRealtimeDomainInvalidation("notifications", {
    queryKeys: [NOTIFICATIONS_QUERY_KEY],
    enabled: isAuthenticated && enabled,
  });

  return useQuery({
    queryKey: [NOTIFICATIONS_QUERY_KEY, { unreadOnly, limit, offset }],
    enabled: isAuthenticated && enabled,
    queryFn: async () => {
      const response = await apiClient.get<NotificationsResponse>("/api/notifications", {
        params: {
          limit,
          offset,
          unread: unreadOnly ? "true" : undefined,
        },
      });
      return response;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.patch<{ success: boolean; data: Notification }>(
        `/api/notifications/${id}/read`,
        {}
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY] });
    },
  });
}
