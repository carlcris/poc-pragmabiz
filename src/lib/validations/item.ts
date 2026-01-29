import * as z from "zod";

export const itemTypeEnum = z.enum(["raw_material", "finished_good", "asset", "service"]);

export const itemFormSchema = z.object({
  code: z
    .string()
    .min(1, "Item code is required")
    .max(50, "Item code must be less than 50 characters")
    .regex(/^[A-Z0-9-]+$/, "Item code must contain only uppercase letters, numbers, and hyphens"),
  name: z
    .string()
    .min(1, "Item name is required")
    .max(200, "Item name must be less than 200 characters"),
  chineseName: z.string().max(200, "Chinese name must be less than 200 characters").optional(),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
  itemType: itemTypeEnum,
  uom: z.string().min(1, "Unit of measure is required"),
  category: z.string().min(1, "Category is required"),
  standardCost: z.number().min(0, "Standard cost must be 0 or greater").optional(),
  listPrice: z.number().min(0, "List price must be 0 or greater"),
  reorderLevel: z.number().int().min(0, "Reorder level must be 0 or greater").optional(),
  reorderQty: z.number().int().min(0, "Reorder quantity must be 0 or greater").optional(),
  imageUrl: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

export const createItemSchema = itemFormSchema.extend({
  companyId: z.string().uuid(),
});

export const updateItemSchema = itemFormSchema.partial().omit({ code: true });
