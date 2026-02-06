import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { Notification } from "@/types/notifications";

const NOTIFICATIONS_QUERY_KEY = "notifications";

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
}: {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
} = {}) {
  return useQuery({
    queryKey: [NOTIFICATIONS_QUERY_KEY, { unreadOnly, limit, offset }],
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
