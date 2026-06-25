import { z } from "zod";

export const reorderRuleSchema = z
  .object({
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
  })
  .refine((data) => data.reorderPoint >= data.minimumLevel, {
    message: "Reorder point must be greater than or equal to minimum level",
    path: ["reorderPoint"],
  })
  .refine((data) => data.maximumLevel >= data.reorderPoint, {
    message: "Maximum level must be greater than or equal to reorder point",
    path: ["maximumLevel"],
  });

export const reorderSuggestionUpdateSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "ordered"]),
  suggestedQuantity: z.number().min(1).optional(),
  supplierId: z.string().optional(),
});

export const acknowledgeAlertSchema = z.object({
  alertIds: z.array(z.string().uuid()).min(1, "At least one alert must be selected"),
});

const reorderSeasonBaseSchema = z.object({
  code: z.string().trim().min(1, "Code is required").max(50, "Code must be 50 characters or less"),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(200, "Name must be 200 characters or less"),
  effectiveFrom: z.string().trim().min(1, "Effective from date is required"),
  effectiveTo: z.string().trim().min(1, "Effective to date is required"),
  priority: z.number().int().min(0, "Priority must be 0 or greater").default(0),
  isActive: z.boolean().default(true),
});

export const reorderSeasonSchema = reorderSeasonBaseSchema
  .refine((data) => data.effectiveFrom <= data.effectiveTo, {
    message: "Effective from date must be on or before effective to date",
    path: ["effectiveTo"],
  });

export const reorderSeasonUpdateSchema = reorderSeasonBaseSchema.partial().refine(
  (data) =>
    data.effectiveFrom === undefined ||
    data.effectiveTo === undefined ||
    data.effectiveFrom <= data.effectiveTo,
  {
    message: "Effective from date must be on or before effective to date",
    path: ["effectiveTo"],
  }
);

export const reorderSeasonItemPolicySchema = z.object({
  seasonId: z.string().uuid("Season is required"),
  itemId: z.string().uuid("Item is required"),
  itemUnitOptionId: z.string().uuid("Unit is required").nullable().optional(),
  reorderLevel: z.number().min(0, "Reorder level must be 0 or greater"),
  reorderQuantity: z.number().min(0, "Reorder quantity must be 0 or greater"),
  isActive: z.boolean().default(true),
});

export const reorderSeasonItemPolicyUpdateSchema = reorderSeasonItemPolicySchema.partial();

export type ReorderRuleInput = z.infer<typeof reorderRuleSchema>;
export type ReorderSuggestionUpdate = z.infer<typeof reorderSuggestionUpdateSchema>;
export type AcknowledgeAlertInput = z.infer<typeof acknowledgeAlertSchema>;
export type ReorderSeasonInput = z.infer<typeof reorderSeasonSchema>;
export type ReorderSeasonUpdate = z.infer<typeof reorderSeasonUpdateSchema>;
export type ReorderSeasonItemPolicyInput = z.infer<typeof reorderSeasonItemPolicySchema>;
export type ReorderSeasonItemPolicyUpdate = z.infer<typeof reorderSeasonItemPolicyUpdateSchema>;
