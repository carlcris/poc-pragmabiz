import { z } from "zod";

export const warehouseFormSchema = z.object({
  code: z
    .string()
    .min(1, "Warehouse code is required")
    .regex(/^[A-Z0-9-]+$/, "Code must contain only uppercase letters, numbers, and hyphens"),
  name: z.string().min(1, "Warehouse name is required"),
  description: z.string().default(""),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().min(1, "Country is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Invalid email address"),
  managerId: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type WarehouseFormValues = z.infer<typeof warehouseFormSchema>;
