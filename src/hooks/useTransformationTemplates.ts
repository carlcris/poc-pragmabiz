import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorCode } from "@/lib/api";
import { transformationTemplatesApi } from "@/lib/api/transformation-templates";
import { ADDITIONAL_OUTPUT_IMAGE_SAVE_ERROR_CODES } from "@/lib/transformations/additional-output-images";
import type {
  TransformationTemplateFilters,
  TransformationTemplateListResponse,
  CreateTransformationTemplateRequest,
  UpdateTransformationTemplateRequest,
  TransformationTemplateCopySourceFilters,
} from "@/types/transformation-template";

export const TRANSFORMATION_TEMPLATES_QUERY_KEY = "transformation-templates";

type ErrorWithCause = {
  cause?: {
    error?: string;
    details?: Array<{ message?: string }>;
  };
};

const getTemplateErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object") {
    const errorWithCause = error as ErrorWithCause;
    const causeMessage = errorWithCause.cause?.error;
    const detailMessage = errorWithCause.cause?.details?.[0]?.message;
    if (causeMessage) return causeMessage;
    if (detailMessage) return detailMessage;
    if (error instanceof Error) return error.message;
  }
  return fallback;
};

/**
 * Hook to fetch list of transformation templates
 */
export function useTransformationTemplates(params?: TransformationTemplateFilters) {
  return useQuery({
    queryKey: [TRANSFORMATION_TEMPLATES_QUERY_KEY, params],
    queryFn: () => transformationTemplatesApi.list(params),
  });
}

/** One page of active templates for a picker, so each request stays bounded. */
const ACTIVE_TEMPLATE_OPTIONS_PAGE_SIZE = 5;

/**
 * Pages the active templates a create form can pick from, of either template
 * kind. The server owns search and ordering, so the combobox appends the next
 * page when the person scrolls or asks for more rather than filtering a full
 * list on the client.
 */
export function useActiveTransformationTemplateOptions(search = "") {
  const normalizedSearch = search.trim();

  return useInfiniteQuery({
    queryKey: [
      TRANSFORMATION_TEMPLATES_QUERY_KEY,
      "active-options",
      { search: normalizedSearch, limit: ACTIVE_TEMPLATE_OPTIONS_PAGE_SIZE },
    ],
    queryFn: ({ pageParam }) =>
      transformationTemplatesApi.list({
        isActive: true,
        search: normalizedSearch || undefined,
        page: pageParam,
        limit: ACTIVE_TEMPLATE_OPTIONS_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: TransformationTemplateListResponse) =>
      lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined,
  });
}

/**
 * Hook to fetch single transformation template
 */
export function useTransformationTemplate(id: string) {
  return useQuery({
    queryKey: [TRANSFORMATION_TEMPLATES_QUERY_KEY, id],
    queryFn: ({ signal }) => transformationTemplatesApi.getById(id, signal),
    enabled: !!id,
    staleTime: 0,
  });
}

export function useTransformationTemplateCopySources(
  params: TransformationTemplateCopySourceFilters,
  enabled = true
) {
  return useQuery({
    queryKey: [TRANSFORMATION_TEMPLATES_QUERY_KEY, "copy-sources", params],
    queryFn: () => transformationTemplatesApi.listCopySources(params),
    enabled,
  });
}

export function useTransformationTemplateCopySource(id: string) {
  return useQuery({
    queryKey: [TRANSFORMATION_TEMPLATES_QUERY_KEY, "copy-source", id],
    queryFn: () => transformationTemplatesApi.getCopySource(id),
    enabled: Boolean(id),
  });
}

export function useUploadTransformationAdditionalOutputImage() {
  return useMutation({
    mutationFn: (file: File) => transformationTemplatesApi.uploadAdditionalOutputImage(file),
    gcTime: 0,
    networkMode: "always",
  });
}

/**
 * Hook to create transformation template
 */
export function useCreateTransformationTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTransformationTemplateRequest) =>
      transformationTemplatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_TEMPLATES_QUERY_KEY] });
      toast.success("Transformation template created successfully");
    },
    onError: (error: unknown) => {
      if (getApiErrorCode(error, ADDITIONAL_OUTPUT_IMAGE_SAVE_ERROR_CODES)) return;
      toast.error(getTemplateErrorMessage(error, "Failed to create transformation template"));
    },
  });
}

/**
 * Hook to update transformation template
 * Note: Only name, description, and isActive can be updated
 * Structural changes are blocked if template is used (usage_count > 0)
 */
export function useUpdateTransformationTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTransformationTemplateRequest }) =>
      transformationTemplatesApi.update(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_TEMPLATES_QUERY_KEY] });
      queryClient.invalidateQueries({
        queryKey: [TRANSFORMATION_TEMPLATES_QUERY_KEY, variables.id],
      });
      toast.success("Transformation template updated successfully");
    },
    onError: (error: unknown) => {
      toast.error(getTemplateErrorMessage(error, "Failed to update transformation template"));
    },
  });
}

/**
 * Hook to delete transformation template
 * Note: Only allowed if usage_count === 0
 */
export function useDeleteTransformationTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => transformationTemplatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_TEMPLATES_QUERY_KEY] });
      toast.success("Transformation template deleted successfully");
    },
    onError: (error: unknown) => {
      toast.error(getTemplateErrorMessage(error, "Failed to delete transformation template"));
    },
  });
}

/**
 * Hook to deactivate transformation template
 */
export function useDeactivateTransformationTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => transformationTemplatesApi.deactivate(id),
    onSuccess: (response, id) => {
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_TEMPLATES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_TEMPLATES_QUERY_KEY, id] });
      toast.success("Transformation template deactivated");
    },
    onError: (error: unknown) => {
      toast.error(getTemplateErrorMessage(error, "Failed to deactivate transformation template"));
    },
  });
}

/**
 * Hook to activate transformation template
 */
export function useActivateTransformationTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => transformationTemplatesApi.activate(id),
    onSuccess: (response, id) => {
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_TEMPLATES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_TEMPLATES_QUERY_KEY, id] });
      toast.success("Transformation template activated");
    },
    onError: (error: unknown) => {
      toast.error(getTemplateErrorMessage(error, "Failed to activate transformation template"));
    },
  });
}
