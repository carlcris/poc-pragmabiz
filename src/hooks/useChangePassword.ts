import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { PasswordChangeRequest } from "@/lib/validations/password-change";

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: PasswordChangeRequest) =>
      apiClient.post<{ success: true }>("/api/auth/change-password", input),
  });
}
