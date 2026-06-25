import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reorderApi } from "@/lib/api/reorder";
import type { ApiQueryParams } from "@/types/api";
import type {
  ReorderRuleInput,
  ReorderSuggestionUpdate,
  AcknowledgeAlertInput,
  ReorderSeasonInput,
  ReorderSeasonUpdate,
  ReorderSeasonItemPolicyInput,
  ReorderSeasonItemPolicyUpdate,
} from "@/lib/validations/reorder";
import { toast } from "sonner";

// Stock Levels
export function useStockLevels(params?: ApiQueryParams) {
  return useQuery({
    queryKey: ["stockLevels", params],
    queryFn: () => reorderApi.getStockLevels(params),
  });
}

// Reorder Suggestions
export function useReorderSuggestions(params?: ApiQueryParams) {
  return useQuery({
    queryKey: ["reorderSuggestions", params],
    queryFn: () => reorderApi.getReorderSuggestions(params),
  });
}

export function useReorderSuggestion(id: string) {
  return useQuery({
    queryKey: ["reorderSuggestion", id],
    queryFn: () => reorderApi.getReorderSuggestion(id),
    enabled: !!id,
  });
}

export function useUpdateReorderSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReorderSuggestionUpdate }) =>
      reorderApi.updateReorderSuggestion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reorderSuggestions"] });
      queryClient.invalidateQueries({ queryKey: ["reorderStatistics"] });
      toast.success("Reorder suggestion updated successfully");
    },
    onError: () => {
      toast.error("Failed to update reorder suggestion");
    },
  });
}

export function useApproveReorderSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reorderApi.approveReorderSuggestion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reorderSuggestions"] });
      queryClient.invalidateQueries({ queryKey: ["reorderStatistics"] });
      toast.success("Reorder suggestion approved");
    },
    onError: () => {
      toast.error("Failed to approve reorder suggestion");
    },
  });
}

export function useRejectReorderSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reorderApi.rejectReorderSuggestion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reorderSuggestions"] });
      queryClient.invalidateQueries({ queryKey: ["reorderStatistics"] });
      toast.success("Reorder suggestion rejected");
    },
    onError: () => {
      toast.error("Failed to reject reorder suggestion");
    },
  });
}

// Reorder Rules
export function useReorderRules(params?: ApiQueryParams) {
  return useQuery({
    queryKey: ["reorderRules", params],
    queryFn: () => reorderApi.getReorderRules(params),
  });
}

export function useReorderRule(id: string) {
  return useQuery({
    queryKey: ["reorderRule", id],
    queryFn: () => reorderApi.getReorderRule(id),
    enabled: !!id,
  });
}

export function useCreateReorderRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReorderRuleInput) => reorderApi.createReorderRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reorderRules"] });
      toast.success("Reorder rule created successfully");
    },
    onError: () => {
      toast.error("Failed to create reorder rule");
    },
  });
}

export function useUpdateReorderRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ReorderRuleInput> }) =>
      reorderApi.updateReorderRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reorderRules"] });
      toast.success("Reorder rule updated successfully");
    },
    onError: () => {
      toast.error("Failed to update reorder rule");
    },
  });
}

export function useDeleteReorderRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reorderApi.deleteReorderRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reorderRules"] });
      toast.success("Reorder rule deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete reorder rule");
    },
  });
}

// Reorder Alerts
export function useReorderAlerts(params?: ApiQueryParams) {
  return useQuery({
    queryKey: ["reorderAlerts", params],
    queryFn: () => reorderApi.getReorderAlerts(params),
  });
}

export function useAcknowledgeAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AcknowledgeAlertInput) => reorderApi.acknowledgeAlerts(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reorderAlerts"] });
      queryClient.invalidateQueries({ queryKey: ["reorderStatistics"] });
      toast.success("Alerts acknowledged");
    },
    onError: () => {
      toast.error("Failed to acknowledge alerts");
    },
  });
}

export function useUnacknowledgeAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AcknowledgeAlertInput) => reorderApi.unacknowledgeAlerts(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reorderAlerts"] });
      queryClient.invalidateQueries({ queryKey: ["reorderStatistics"] });
      toast.success("Alerts restored");
    },
    onError: () => {
      toast.error("Failed to restore alerts");
    },
  });
}

// Reorder Seasons
export function useReorderSeasons(params?: ApiQueryParams) {
  return useQuery({
    queryKey: ["reorderSeasons", params],
    queryFn: () => reorderApi.getReorderSeasons(params),
  });
}

export function useCreateReorderSeason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReorderSeasonInput) => reorderApi.createReorderSeason(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reorderSeasons"] });
      queryClient.invalidateQueries({ queryKey: ["reorderAlerts"] });
      queryClient.invalidateQueries({ queryKey: ["reorderStatistics"] });
    },
  });
}

export function useUpdateReorderSeason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReorderSeasonUpdate }) =>
      reorderApi.updateReorderSeason(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reorderSeasons"] });
      queryClient.invalidateQueries({ queryKey: ["reorderAlerts"] });
      queryClient.invalidateQueries({ queryKey: ["reorderStatistics"] });
    },
  });
}

export function useDeleteReorderSeason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reorderApi.deleteReorderSeason(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reorderSeasons"] });
      queryClient.invalidateQueries({ queryKey: ["reorderSeasonItemPolicies"] });
      queryClient.invalidateQueries({ queryKey: ["reorderAlerts"] });
      queryClient.invalidateQueries({ queryKey: ["reorderStatistics"] });
    },
  });
}

// Seasonal Reorder Policies
export function useReorderSeasonItemPolicies(params?: ApiQueryParams) {
  return useQuery({
    queryKey: ["reorderSeasonItemPolicies", params],
    queryFn: () => reorderApi.getReorderSeasonItemPolicies(params),
  });
}

export function useCreateReorderSeasonItemPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReorderSeasonItemPolicyInput) =>
      reorderApi.createReorderSeasonItemPolicy(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reorderSeasonItemPolicies"] });
      queryClient.invalidateQueries({ queryKey: ["reorderAlerts"] });
      queryClient.invalidateQueries({ queryKey: ["reorderStatistics"] });
    },
  });
}

export function useUpdateReorderSeasonItemPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReorderSeasonItemPolicyUpdate }) =>
      reorderApi.updateReorderSeasonItemPolicy(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reorderSeasonItemPolicies"] });
      queryClient.invalidateQueries({ queryKey: ["reorderAlerts"] });
      queryClient.invalidateQueries({ queryKey: ["reorderStatistics"] });
    },
  });
}

export function useDeleteReorderSeasonItemPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reorderApi.deleteReorderSeasonItemPolicy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reorderSeasonItemPolicies"] });
      queryClient.invalidateQueries({ queryKey: ["reorderAlerts"] });
      queryClient.invalidateQueries({ queryKey: ["reorderStatistics"] });
    },
  });
}

// Statistics
export function useReorderStatistics() {
  return useQuery({
    queryKey: ["reorderStatistics"],
    queryFn: () => reorderApi.getReorderStatistics(),
  });
}

// Generate Suggestions
export function useGenerateReorderSuggestions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reorderApi.generateReorderSuggestions(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["reorderSuggestions"] });
      queryClient.invalidateQueries({ queryKey: ["reorderStatistics"] });
      toast.success(`Generated ${data.generated} reorder suggestions`);
    },
    onError: () => {
      toast.error("Failed to generate reorder suggestions");
    },
  });
}
