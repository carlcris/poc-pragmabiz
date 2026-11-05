import { describe, expect, it } from "vitest";
import { batchReceivedDateSchema, getBatchReceivedDateError } from "./batch-received-date";

describe("stock adjustment received dates", () => {
  it("accepts historical dates and leap days without timestamp conversion", () => {
    expect(batchReceivedDateSchema.parse("1999-01-01")).toBe("1999-01-01");
    expect(batchReceivedDateSchema.parse("2024-02-29")).toBe("2024-02-29");
  });
  it.each([
    undefined,
    "",
    "0000-01-01",
    "2025-02-29",
    "2026-04-31",
    "2026-1-1",
    "2026-01-01T00:00:00Z",
  ])("rejects invalid date %s", (value) => {
    expect(batchReceivedDateSchema.safeParse(value).success).toBe(false);
  });
  it("maps known RPC failures to safe actionable errors only", () => {
    expect(getBatchReceivedDateError("SA001")).toMatchObject({
      status: 400,
      code: "STOCK_ADJUSTMENT_RECEIVED_DATE_INVALID",
    });
    expect(getBatchReceivedDateError("SA002")).toMatchObject({
      status: 409,
      code: "STOCK_ADJUSTMENT_RECEIVED_DATE_CONFLICT",
    });
    expect(getBatchReceivedDateError("XX000")).toBeNull();
  });
});
