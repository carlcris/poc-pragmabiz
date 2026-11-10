import { z } from "zod";

export const itemBatchExpirationSchema = z
  .object({
    expirationDate: z.iso
      .date()
      .refine((value) => value >= "0001-01-01")
      .nullable(),
  })
  .strict();

export const ITEM_BATCH_EXPIRATION_ERROR_CODES = [
  "BATCH_EXPIRATION_INVALID",
  "BATCH_EXPIRATION_NOT_FOUND",
  "BATCH_EXPIRATION_FORBIDDEN",
] as const;
