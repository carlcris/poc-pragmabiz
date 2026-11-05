import { z } from "zod";

export const batchReceivedDateSchema = z.iso.date().refine((value) => value >= "0001-01-01");

export const STOCK_ADJUSTMENT_DATE_ERROR_CODES = [
  "STOCK_ADJUSTMENT_RECEIVED_DATE_INVALID",
  "STOCK_ADJUSTMENT_RECEIVED_DATE_CONFLICT",
] as const;

export const getBatchReceivedDateError = (code: string | undefined) => {
  if (code === "SA001") {
    return {
      code: STOCK_ADJUSTMENT_DATE_ERROR_CODES[0],
      error: "Enter a valid received date for each new batch.",
      status: 400,
    };
  }
  if (code === "SA002") {
    return {
      code: STOCK_ADJUSTMENT_DATE_ERROR_CODES[1],
      error:
        "This batch already has a different received date. Use its original date or a different batch code.",
      status: 409,
    };
  }
  return null;
};
