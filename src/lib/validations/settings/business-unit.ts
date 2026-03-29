import { z } from "zod";

export const createBusinessUnitSettingsSchema = () =>
  z.object({
    display_name: z
      .string()
      .max(200, "Display name must be 200 characters or less")
      .optional()
      .or(z.literal("")),
    short_code: z
      .string()
      .max(20, "Short code must be 20 characters or less")
      .optional()
      .or(z.literal("")),
    local_email: z
      .string()
      .email("Invalid email address")
      .max(100, "Email must be 100 characters or less")
      .optional()
      .or(z.literal("")),
    local_phone: z
      .string()
      .max(50, "Phone must be 50 characters or less")
      .optional()
      .or(z.literal("")),
    manager_name: z
      .string()
      .max(200, "Manager name must be 200 characters or less")
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
    timezone: z
      .string()
      .max(100, "Timezone must be 100 characters or less")
      .optional()
      .or(z.literal("")),
    operating_hours_start: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)")
      .optional()
      .or(z.literal("")),
    operating_hours_end: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)")
      .optional()
      .or(z.literal("")),
    days_open: z.array(z.string()).optional().default([]),
    receipt_header: z
      .string()
      .max(1000, "Receipt header must be 1000 characters or less")
      .optional()
      .or(z.literal("")),
    receipt_footer: z
      .string()
      .max(1000, "Receipt footer must be 1000 characters or less")
      .optional()
      .or(z.literal("")),
  });

type BusinessUnitSettingsSchema = ReturnType<typeof createBusinessUnitSettingsSchema>;

export type BusinessUnitSettingsFormInput = z.input<BusinessUnitSettingsSchema>;
export type BusinessUnitSettingsFormData = z.output<BusinessUnitSettingsSchema>;
