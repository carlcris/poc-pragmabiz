import { z } from "zod";

const dateSchema = z.string().date();
const nullableDateSchema = z.union([dateSchema, z.literal(""), z.null()]).optional();

const effectiveRangeSchema = z
  .object({
    effectiveFrom: dateSchema,
    effectiveTo: nullableDateSchema,
  })
  .refine(
    ({ effectiveFrom, effectiveTo }) =>
      !effectiveTo || new Date(effectiveTo).getTime() >= new Date(effectiveFrom).getTime(),
    { message: "Effective end date must be on or after the start date", path: ["effectiveTo"] }
  );

export const createCustomerItemPriceSchema = z
  .object({
    itemId: z.string().uuid(),
    priceTier: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[a-zA-Z0-9_-]+$/),
    price: z.coerce.number().min(0).max(999999999999999999),
    currencyCode: z
      .string()
      .trim()
      .length(3)
      .regex(/^[a-zA-Z]{3}$/),
    effectiveFrom: dateSchema,
    effectiveTo: nullableDateSchema,
    isActive: z.boolean(),
  })
  .strict()
  .and(effectiveRangeSchema);

export const updateCustomerItemPriceSchema = z
  .object({
    price: z.coerce.number().min(0).max(999999999999999999).optional(),
    currencyCode: z
      .string()
      .trim()
      .length(3)
      .regex(/^[a-zA-Z]{3}$/)
      .optional(),
    effectiveFrom: dateSchema.optional(),
    effectiveTo: nullableDateSchema,
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "No changes provided" });

export const resolveCustomerPricingSchema = z
  .object({
    customerId: z.string().uuid(),
    itemIds: z.array(z.string().uuid()).min(1).max(50),
    asOfDate: dateSchema.optional(),
  })
  .strict();

export const validateCustomerPriceEffectiveRange = (value: {
  effectiveFrom: string;
  effectiveTo?: string | null;
}) => effectiveRangeSchema.safeParse(value).success;
