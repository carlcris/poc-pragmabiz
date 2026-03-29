import { z } from "zod";

export const createCompanySettingsSchema = () =>
  z.object({
    code: z
      .string()
      .min(1, "Company code is required")
      .max(50, "Company code must be 50 characters or less"),
    name: z
      .string()
      .min(1, "Company name is required")
      .max(200, "Company name must be 200 characters or less"),
    legal_name: z
      .string()
      .max(200, "Legal name must be 200 characters or less")
      .optional()
      .or(z.literal("")),
    tax_id: z
      .string()
      .max(50, "Tax ID must be 50 characters or less")
      .optional()
      .or(z.literal("")),
    email: z
      .string()
      .email("Invalid email address")
      .max(100, "Email must be 100 characters or less")
      .optional()
      .or(z.literal("")),
    phone: z
      .string()
      .max(50, "Phone must be 50 characters or less")
      .optional()
      .or(z.literal("")),
    address_line1: z
      .string()
      .max(500, "Address line 1 must be 500 characters or less")
      .optional()
      .or(z.literal("")),
    address_line2: z
      .string()
      .max(500, "Address line 2 must be 500 characters or less")
      .optional()
      .or(z.literal("")),
    city: z
      .string()
      .max(100, "City must be 100 characters or less")
      .optional()
      .or(z.literal("")),
    state: z
      .string()
      .max(100, "State must be 100 characters or less")
      .optional()
      .or(z.literal("")),
    postal_code: z
      .string()
      .max(20, "Postal code must be 20 characters or less")
      .optional()
      .or(z.literal("")),
    country: z
      .string()
      .max(100, "Country must be 100 characters or less")
      .optional()
      .or(z.literal("")),
    currency_code: z
      .string()
      .max(10, "Currency code must be 10 characters or less")
      .optional()
      .or(z.literal("")),
    is_active: z.boolean().default(true),
  });

type CompanySettingsSchema = ReturnType<typeof createCompanySettingsSchema>;

export type CompanySettingsFormInput = z.input<CompanySettingsSchema>;
export type CompanySettingsFormData = z.output<CompanySettingsSchema>;
