import { z } from "zod";

export const createPOSSettingsSchema = () =>
  z.object({
    receipt_header: z.string().max(500, "Receipt header must be 500 characters or less"),
    receipt_footer: z.string().max(500, "Receipt footer must be 500 characters or less"),
    show_logo_on_receipt: z.boolean().default(true),
    allow_discounts: z.boolean().default(true),
    max_discount_percent: z
      .number()
      .min(0, "Discount percentage must be 0 or greater")
      .max(100, "Discount percentage cannot exceed 100%"),
    require_manager_approval_threshold: z
      .number()
      .min(0, "Threshold must be 0 or greater"),
    cash_drawer_enabled: z.boolean().default(true),
    print_receipt_auto: z.boolean().default(false),
    default_payment_method: z.string().max(50).optional().or(z.literal("")),
  });

type POSSettingsSchema = ReturnType<typeof createPOSSettingsSchema>;

export type POSSettingsFormInput = z.input<POSSettingsSchema>;
export type POSSettingsFormData = z.output<POSSettingsSchema>;
