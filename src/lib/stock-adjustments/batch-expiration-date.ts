import { z } from "zod";

export const batchExpirationDateSchema = z.iso
  .date()
  .refine((value) => value >= "0001-01-01")
  .nullable()
  .optional();

export const getBatchExpirationDateError = () => ({
  code: "STOCK_ADJUSTMENT_EXPIRATION_DATE_INVALID" as const,
  error: "Enter a valid expiration date or leave it blank for each new batch.",
  status: 400,
});
