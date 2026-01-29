import { z } from "zod";

// ============================================================================
// UUID Validation (accepts all UUID formats including nil UUID)
// ============================================================================
const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid UUID format");

// ============================================================================
// Order Status Enum
// ============================================================================

export const transformationOrderStatusEnum = z.enum([
  "DRAFT",
  "PREPARING",
  "COMPLETED",
  "CANCELLED",
]);

// ============================================================================
// Create Order Schema
// ============================================================================

export const createTransformationOrderSchema = z.object({
  companyId: uuidSchema,
  templateId: uuidSchema,
  warehouseId: uuidSchema,
  plannedQuantity: z.number().min(0.0001, "Planned quantity must be greater than 0"),
  orderDate: z.string().optional(),
  plannedDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
  referenceType: z.string().max(50).optional(),
  referenceId: uuidSchema.optional(),
});

export type CreateTransformationOrderValues = z.infer<typeof createTransformationOrderSchema>;

// ============================================================================
// Update Order Schema (only for DRAFT status)
// ============================================================================

export const updateTransformationOrderSchema = z.object({
  plannedQuantity: z.number().min(0.0001, "Planned quantity must be greater than 0").optional(),
  plannedDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export type UpdateTransformationOrderValues = z.infer<typeof updateTransformationOrderSchema>;

// ============================================================================
// Execute Order Schema (actual quantities during execution)
// ============================================================================

export const executeTransformationOrderInputSchema = z.object({
  inputLineId: uuidSchema,
  consumedQuantity: z.number().min(0.0001, "Consumed quantity must be greater than 0"),
});

export const executeTransformationOrderOutputSchema = z.object({
  outputLineId: uuidSchema,
  producedQuantity: z.number().min(0, "Produced quantity must be at least 0"),
  wastedQuantity: z.number().min(0, "Wasted quantity must be at least 0").optional().default(0),
  wasteReason: z
    .string()
    .max(500, "Waste reason must be at most 500 characters")
    .optional()
    .nullable(),
});

export const executeTransformationOrderSchema = z.object({
  inputs: z.array(executeTransformationOrderInputSchema).min(1, "At least one input is required"),
  outputs: z
    .array(executeTransformationOrderOutputSchema)
    .min(1, "At least one output is required"),
  executionDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export type ExecuteTransformationOrderValues = z.infer<typeof executeTransformationOrderSchema>;

// ============================================================================
// Complete Order Schema
// ============================================================================

export const completeTransformationOrderSchema = z.object({
  completionDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export type CompleteTransformationOrderValues = z.infer<typeof completeTransformationOrderSchema>;

// ============================================================================
// Order Filters Schema (for list/search)
// ============================================================================

export const transformationOrderFiltersSchema = z.object({
  companyId: uuidSchema.optional(),
  search: z.string().optional(),
  status: transformationOrderStatusEnum.optional(),
  templateId: uuidSchema.optional(),
  warehouseId: uuidSchema.optional(),
  itemId: uuidSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type TransformationOrderFiltersValues = z.infer<typeof transformationOrderFiltersSchema>;

// ============================================================================
// State Transition Validation
// ============================================================================

export const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PREPARING", "CANCELLED"],
  PREPARING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateTransition(from: string, to: string): void {
  if (!isValidTransition(from, to)) {
    throw new Error(
      `Invalid state transition from ${from} to ${to}. Allowed transitions: ${
        VALID_TRANSITIONS[from]?.join(", ") || "none"
      }`
    );
  }
}
