import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getProductionMaterialRequestErrorCode,
  mutateProductionMaterialRequest,
} from "./production-material-request";

afterEach(() => vi.unstubAllGlobals());

describe("getProductionMaterialRequestErrorCode", () => {
  it("preserves a known API error code", () => {
    const error = new Error("Not enough stock", {
      cause: { code: "MATERIAL_REQUEST_INSUFFICIENT_STOCK" },
    });

    expect(getProductionMaterialRequestErrorCode(error)).toBe(
      "MATERIAL_REQUEST_INSUFFICIENT_STOCK"
    );
  });

  it("keeps unknown failures generic", () => {
    expect(
      getProductionMaterialRequestErrorCode(
        new Error("internal", { cause: { code: "RAW_DATABASE_ERROR" } })
      )
    ).toBe("MATERIAL_REQUEST_FAILED");
  });

  it("preserves the actionable unavailable-material error", () => {
    expect(
      getProductionMaterialRequestErrorCode(
        new Error("Required materials are unavailable", {
          cause: { code: "MATERIAL_REQUEST_MATERIAL_UNAVAILABLE" },
        })
      )
    ).toBe("MATERIAL_REQUEST_MATERIAL_UNAVAILABLE");
  });

  it("propagates unavailable-material conflicts through the HTTP client", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "MATERIAL_REQUEST_MATERIAL_UNAVAILABLE",
            error: "Reactivate the unavailable materials before creating the request.",
          }),
          { status: 409 }
        )
      )
    );
    const error = await mutateProductionMaterialRequest("job", "create", "warehouse").catch(
      (failure: unknown) => failure
    );
    expect(getProductionMaterialRequestErrorCode(error)).toBe(
      "MATERIAL_REQUEST_MATERIAL_UNAVAILABLE"
    );
  });
});
