import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { transformationTemplatesApi } from '@/lib/api/transformation-templates';
import type {
  TransformationTemplateFilters,
  CreateTransformationTemplateRequest,
  UpdateTransformationTemplateRequest,
} from '@/types/transformation-template';

export const TRANSFORMATION_TEMPLATES_QUERY_KEY = 'transformation-templates';

/**
 * Hook to fetch list of transformation templates
 */
export function useTransformationTemplates(params?: TransformationTemplateFilters) {
  return useQuery({
    queryKey: [TRANSFORMATION_TEMPLATES_QUERY_KEY, params],
    queryFn: () => transformationTemplatesApi.list(params),
  });
}

/**
 * Hook to fetch single transformation template
 */
export function useTransformationTemplate(id: string) {
  return useQuery({
    queryKey: [TRANSFORMATION_TEMPLATES_QUERY_KEY, id],
    queryFn: () => transformationTemplatesApi.getById(id),
    enabled: !!id,
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
      toast.success('Transformation template created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create transformation template');
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
      queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_TEMPLATES_QUERY_KEY, variables.id] });
      toast.success('Transformation template updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update transformation template');
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
      toast.success('Transformation template deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete transformation template');
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
      toast.success('Transformation template deactivated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to deactivate transformation template');
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
      toast.success('Transformation template activated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to activate transformation template');
    },
  });
}
