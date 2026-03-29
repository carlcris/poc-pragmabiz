import { z } from "zod";

export const createFinancialSettingsSchema = () =>
  z.object({
    default_tax_rate: z
      .number()
      .min(0, "Tax rate must be 0 or greater")
      .max(100, "Tax rate cannot exceed 100%"),
    default_payment_terms: z
      .number()
      .int("Payment terms must be a whole number")
      .min(0, "Payment terms must be 0 or greater"),
    fiscal_year_start: z
      .string()
      .regex(/^\d{2}-\d{2}$/, "Fiscal year start must be in MM-DD format")
      .refine(
        (val) => {
          const [month, day] = val.split("-").map(Number);
          return month >= 1 && month <= 12 && day >= 1 && day <= 31;
        },
        { message: "Invalid date" }
      ),
    invoice_prefix: z
      .string()
      .max(20, "Invoice prefix must be 20 characters or less")
      .optional()
      .or(z.literal("")),
    invoice_start_number: z
      .number()
      .int("Start number must be a whole number")
      .min(1, "Start number must be at least 1"),
    quote_prefix: z
      .string()
      .max(20, "Quote prefix must be 20 characters or less")
      .optional()
      .or(z.literal("")),
    quote_start_number: z
      .number()
      .int("Start number must be a whole number")
      .min(1, "Start number must be at least 1"),
    credit_note_prefix: z
      .string()
      .max(20, "Credit note prefix must be 20 characters or less")
      .optional()
      .or(z.literal("")),
    auto_calculate_tax: z.boolean().default(true),
  });

type FinancialSettingsSchema = ReturnType<typeof createFinancialSettingsSchema>;

export type FinancialSettingsFormInput = z.input<FinancialSettingsSchema>;
export type FinancialSettingsFormData = z.output<FinancialSettingsSchema>;
