import { describe, expect, it } from "vitest";
import { isManufacturingStartBlocked } from "./start-eligibility";

describe("production start eligibility", () => {
  it.each(["ready", "queued"])("allows a %s frame job to use residual materials", (status) => {
    expect(
      isManufacturingStartBlocked({ frameJobOrderId: "job", hasMaterialShortage: true, status })
    ).toBe(false);
  });
  it("preserves unrelated standalone production shortage behavior", () => {
    expect(
      isManufacturingStartBlocked({
        frameJobOrderId: null,
        hasMaterialShortage: true,
        status: "ready",
      })
    ).toBe(true);
    expect(
      isManufacturingStartBlocked({
        frameJobOrderId: null,
        hasMaterialShortage: false,
        status: "ready",
      })
    ).toBe(false);
  });
});
