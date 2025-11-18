import * as z from "zod";

export const warehouseFormSchema = z.object({
  code: z
    .string()
    .min(1, "Warehouse code is required")
    .max(50, "Warehouse code must be less than 50 characters")
    .regex(
      /^[A-Z0-9-]+$/,
      "Warehouse code must contain only uppercase letters, numbers, and hyphens"
    ),
  name: z
    .string()
    .min(1, "Warehouse name is required")
    .max(200, "Warehouse name must be less than 200 characters"),
  description: z
    .string()
    .max(1000, "Description must be less than 1000 characters")
    .optional()
    .default(""),
  address: z
    .string()
    .max(500, "Address must be less than 500 characters")
    .optional()
    .default(""),
  city: z
    .string()
    .max(100, "City must be less than 100 characters")
    .optional()
    .default(""),
  state: z
    .string()
    .max(100, "State must be less than 100 characters")
    .optional()
    .default(""),
  postalCode: z
    .string()
    .max(20, "Postal code must be less than 20 characters")
    .optional()
    .default(""),
  country: z
    .string()
    .max(100, "Country must be less than 100 characters")
    .optional()
    .default(""),
  phone: z
    .string()
    .max(50, "Phone must be less than 50 characters")
    .optional()
    .default(""),
  email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters")
    .optional()
    .or(z.literal(""))
    .default(""),
  managerId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
});

export type WarehouseFormValues = z.infer<typeof warehouseFormSchema>;

export const createWarehouseSchema = warehouseFormSchema.extend({
  companyId: z.string().uuid(),
});

export const updateWarehouseSchema = warehouseFormSchema.partial().omit({ code: true });
