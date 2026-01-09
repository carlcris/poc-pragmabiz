import { z } from "zod";

// ============================================================================
// UUID Validation (accepts all UUID formats including nil UUID)
// ============================================================================
const uuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  "Invalid UUID format"
);

// ============================================================================
// Template Input/Output Item Schemas
// ============================================================================

const numberSchema = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() !== "") {
      return Number(value);
    }
    return value;
  },
  z.number().min(0.0001, "Quantity must be greater than 0")
);

const sequenceSchema = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() !== "") {
      return Number(value);
    }
    return value;
  },
  z.number().int().min(1)
);

export const templateInputItemSchema = z.object({
  itemId: uuidSchema,
  quantity: numberSchema,
  uomId: uuidSchema,
  sequence: sequenceSchema.optional(),
  notes: z.string().optional(),
});

export const templateOutputItemSchema = z.object({
  itemId: uuidSchema,
  quantity: numberSchema,
  uomId: uuidSchema,
  sequence: sequenceSchema.optional(),
  isScrap: z.preprocess(
    (value) => {
      if (typeof value === "string") {
        return value.toLowerCase() === "true";
      }
      return value;
    },
    z.boolean().default(false)
  ),
  notes: z.string().optional(),
});

// ============================================================================
// Create Template Schema
// ============================================================================

export const createTransformationTemplateSchema = z
  .object({
    companyId: uuidSchema,
    templateCode: z
      .string()
      .min(1, "Template code is required")
      .max(50, "Template code must be 50 characters or less"),
    templateName: z
      .string()
      .min(1, "Template name is required")
      .max(200, "Template name must be 200 characters or less"),
    description: z.string().max(1000).optional(),
    inputs: z
      .array(templateInputItemSchema)
      .min(1, "At least one input item is required"),
    outputs: z
      .array(templateOutputItemSchema)
      .min(1, "At least one output item is required"),
  })
  .refine(
    (data) => {
      // Validation: No circular references (same item as input and output)
      const inputItemIds = new Set(data.inputs.map((i) => i.itemId));
      const outputItemIds = new Set(data.outputs.map((o) => o.itemId));

      // Find items that are both input and output (circular)
      const circularItems = [...inputItemIds].filter((id) =>
        outputItemIds.has(id)
      );

      return circularItems.length === 0;
    },
    {
      message:
        "Input and output items must be different. Please choose a different output item.",
      path: ["inputs"],
    }
  )
  .refine(
    (data) => {
      // Validation: No duplicate items in inputs
      const inputItemIds = data.inputs.map((i) => i.itemId);
      const uniqueInputs = new Set(inputItemIds);
      return inputItemIds.length === uniqueInputs.size;
    },
    {
      message: "Duplicate items in inputs are not allowed",
      path: ["inputs"],
    }
  )
  .refine(
    (data) => {
      // Validation: No duplicate items in outputs
      const outputItemIds = data.outputs.map((o) => o.itemId);
      const uniqueOutputs = new Set(outputItemIds);
      return outputItemIds.length === uniqueOutputs.size;
    },
    {
      message: "Duplicate items in outputs are not allowed",
      path: ["outputs"],
    }
  );

export type CreateTransformationTemplateValues = z.infer<
  typeof createTransformationTemplateSchema
>;

// ============================================================================
// Update Template Schema (only name, description, isActive can be updated)
// ============================================================================

export const updateTransformationTemplateSchema = z.object({
  templateName: z
    .string()
    .min(1, "Template name is required")
    .max(200, "Template name must be 200 characters or less")
    .optional(),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateTransformationTemplateValues = z.infer<
  typeof updateTransformationTemplateSchema
>;

// ============================================================================
// Template Filters Schema (for list/search)
// ============================================================================

export const transformationTemplateFiltersSchema = z.object({
  companyId: z.string().uuid().optional(),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  itemId: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type TransformationTemplateFiltersValues = z.infer<
  typeof transformationTemplateFiltersSchema
>;
