import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { USER_PROFILE_QUERY_KEY } from "@/hooks/queryKeys";
import type { UserProfile, UserProfileUpdateInput } from "@/types/user-profile";

export function useUserProfile() {
  return useQuery({
    queryKey: [USER_PROFILE_QUERY_KEY],
    queryFn: async () => {
      const response = await apiClient.get<{ data: UserProfile }>("/api/users/me");
      return response.data;
    },
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UserProfileUpdateInput) => {
      const response = await apiClient.patch<{ data: UserProfileUpdateInput }>(
        "/api/users/me",
        input
      );
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<UserProfile>([USER_PROFILE_QUERY_KEY], (current) =>
        current ? { ...current, ...updated } : current
      );

      // Keep the header user menu in sync with the saved name.
      useAuthStore.setState((state) =>
        state.user
          ? {
              user: {
                ...state.user,
                firstName: updated.firstName,
                lastName: updated.lastName,
                name: [updated.firstName, updated.lastName].filter(Boolean).join(" "),
              },
            }
          : {}
      );
    },
  });
}
