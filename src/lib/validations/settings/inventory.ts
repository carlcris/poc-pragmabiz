import { z } from "zod";

export const createInventorySettingsSchema = () =>
  z.object({
    default_uom: z.string().min(1, "Default UOM is required").max(50),
    low_stock_threshold: z
      .number()
      .int("Threshold must be a whole number")
      .min(0, "Threshold must be 0 or greater"),
    critical_stock_threshold: z
      .number()
      .int("Threshold must be a whole number")
      .min(0, "Threshold must be 0 or greater"),
    valuation_method: z.enum([
      "FIFO",
      "LIFO",
      "AVERAGE",
      "STANDARD",
    ] as const),
    auto_allocation_enabled: z.boolean().default(false),
    negative_stock_allowed: z.boolean().default(false),
    track_lot_numbers: z.boolean().default(false),
    track_serial_numbers: z.boolean().default(false),
    barcode_format: z.string().max(50).optional().or(z.literal("")),
  });

type InventorySettingsSchema = ReturnType<typeof createInventorySettingsSchema>;

export type InventorySettingsFormInput = z.input<InventorySettingsSchema>;
export type InventorySettingsFormData = z.output<InventorySettingsSchema>;
