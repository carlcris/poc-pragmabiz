import { describe, expect, it } from "vitest";
import { batchExpirationDateSchema } from "./batch-expiration-date";
import { getStockAdjustmentSaveError } from "./save-errors";
import { getStockAdjustmentSaveErrorMessage } from "./save-error-message";

describe("manual batch expiration contract", () => {
  it.each([undefined, null, "2024-02-29", "1999-01-01"])("accepts %s", (value) => {
    expect(batchExpirationDateSchema.safeParse(value).success).toBe(true);
  });
  it.each(["", "0000-01-01", "2025-02-29", "2026-01-01T00:00:00Z", 1, {}])(
    "rejects %s",
    (value) => {
      expect(batchExpirationDateSchema.safeParse(value).success).toBe(false);
    }
  );
  it("maps DB failures to safe HTTP and translated UI errors", () => {
    const failure = getStockAdjustmentSaveError({ code: "SA005", message: "internal details" });
    expect(failure).toMatchObject({
      status: 400,
      code: "STOCK_ADJUSTMENT_EXPIRATION_DATE_INVALID",
    });
    expect(failure?.error).not.toContain("internal details");
    const error = new Error("Request failed", { cause: failure });
    expect(getStockAdjustmentSaveErrorMessage(error, (key) => key)).toBe("expirationDateInvalid");
    expect(getStockAdjustmentSaveError({ code: "XX000", message: "internal details" })).toBeNull();
  });
});
