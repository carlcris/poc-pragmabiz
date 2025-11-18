import { z } from "zod";
import { MINDANAO_CITIES, MINDANAO_REGIONS } from "@/types/employee";

// Enums
export const employeeRoleEnum = z.enum([
  "admin",
  "manager",
  "sales_agent",
  "warehouse_staff",
  "accountant",
]);

export const employmentStatusEnum = z.enum([
  "active",
  "inactive",
  "terminated",
  "on_leave",
]);

// Employee form schema
export const employeeFormSchema = z.object({
  employeeCode: z
    .string()
    .min(1, "Employee code is required")
    .regex(
      /^[A-Z0-9-]+$/,
      "Code must contain only uppercase letters, numbers, and hyphens"
    ),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  role: employeeRoleEnum,
  department: z.string().optional(),
  hireDate: z.string().min(1, "Hire date is required"), // ISO date string
  terminationDate: z.string().optional(),
  employmentStatus: employmentStatusEnum.default("active"),
  commissionRate: z
    .number()
    .min(0, "Commission rate must be 0 or greater")
    .max(100, "Commission rate cannot exceed 100%")
    .default(5.0),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.enum(MINDANAO_CITIES as unknown as [string, ...string[]]).optional(),
  regionState: z
    .enum(MINDANAO_REGIONS as unknown as [string, ...string[]])
    .optional(),
  country: z.string().default("Philippines"),
  postalCode: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

// Territory assignment schema
export const territoryFormSchema = z.object({
  city: z
    .enum(MINDANAO_CITIES as unknown as [string, ...string[]])
    .refine((val) => val !== undefined, {
      message: "City is required",
    }),
  regionState: z
    .enum(MINDANAO_REGIONS as unknown as [string, ...string[]])
    .refine((val) => val !== undefined, {
      message: "Region is required",
    }),
  isPrimary: z.boolean().default(false),
  notes: z.string().optional(),
});

export type TerritoryFormValues = z.infer<typeof territoryFormSchema>;

// Commission split schema
export const commissionSplitSchema = z.object({
  employeeId: z.string().uuid("Invalid employee ID"),
  splitPercentage: z
    .number()
    .min(0, "Split percentage must be 0 or greater")
    .max(100, "Split percentage cannot exceed 100%"),
});

export const commissionSplitsSchema = z
  .array(commissionSplitSchema)
  .min(1, "At least one employee is required")
  .refine(
    (splits) => {
      const total = splits.reduce((sum, split) => sum + split.splitPercentage, 0);
      return Math.abs(total - 100) < 0.01; // Allow for floating point precision
    },
    {
      message: "Commission split percentages must sum to 100%",
    }
  );

export type CommissionSplitValues = z.infer<typeof commissionSplitSchema>;
export type CommissionSplitsValues = z.infer<typeof commissionSplitsSchema>;

// Employee filter schema (for search/filter forms)
export const employeeFilterSchema = z.object({
  search: z.string().optional(),
  role: employeeRoleEnum.optional(),
  employmentStatus: employmentStatusEnum.optional(),
  city: z.enum(MINDANAO_CITIES as unknown as [string, ...string[]]).optional(),
  regionState: z
    .enum(MINDANAO_REGIONS as unknown as [string, ...string[]])
    .optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

export type EmployeeFilterValues = z.infer<typeof employeeFilterSchema>;
