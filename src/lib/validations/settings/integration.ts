import { z } from "zod";

export const createIntegrationSettingsSchema = () =>
  z.object({
    api_enabled: z.boolean().default(false),
    webhook_url: z
      .string()
      .url("Invalid webhook URL")
      .max(500)
      .optional()
      .or(z.literal("")),
    webhook_secret: z
      .string()
      .max(255)
      .optional()
      .or(z.literal("")),
    accounting_integration: z.enum([
      "none",
      "quickbooks",
      "xero",
      "sage",
    ] as const),
    accounting_sync_enabled: z.boolean().default(false),
    ecommerce_integration: z
      .string()
      .max(100)
      .optional()
      .or(z.literal("")),
  });

type IntegrationSettingsSchema = ReturnType<typeof createIntegrationSettingsSchema>;

export type IntegrationSettingsFormInput = z.input<IntegrationSettingsSchema>;
export type IntegrationSettingsFormData = z.output<IntegrationSettingsSchema>;
