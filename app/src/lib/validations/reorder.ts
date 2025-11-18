import { z } from "zod";

export const reorderRuleSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  warehouseId: z.string().nullable().optional(),
  reorderPoint: z.number().min(0, "Reorder point must be non-negative"),
  reorderQuantity: z.number().min(1, "Reorder quantity must be at least 1"),
  minimumLevel: z.number().min(0, "Minimum level must be non-negative"),
  maximumLevel: z.number().min(0, "Maximum level must be non-negative"),
  leadTimeDays: z.number().min(0, "Lead time must be non-negative"),
  preferredSupplierId: z.string().optional(),
  autoGeneratePO: z.boolean().default(false),
  isActive: z.boolean().default(true),
}).refine((data) => data.reorderPoint >= data.minimumLevel, {
  message: "Reorder point must be greater than or equal to minimum level",
  path: ["reorderPoint"],
}).refine((data) => data.maximumLevel >= data.reorderPoint, {
  message: "Maximum level must be greater than or equal to reorder point",
  path: ["maximumLevel"],
});

export const reorderSuggestionUpdateSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "ordered"]),
  suggestedQuantity: z.number().min(1).optional(),
  supplierId: z.string().optional(),
});

export const acknowledgeAlertSchema = z.object({
  alertIds: z.array(z.string()).min(1, "At least one alert must be selected"),
});

export type ReorderRuleInput = z.infer<typeof reorderRuleSchema>;
export type ReorderSuggestionUpdate = z.infer<typeof reorderSuggestionUpdateSchema>;
export type AcknowledgeAlertInput = z.infer<typeof acknowledgeAlertSchema>;
