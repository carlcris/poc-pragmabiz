import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("API read cancellation", () => {
  it("forwards cancellation without changing cookies, parameters or JSON response wrapping", async () => {
    const payload = { data: [{ id: "business-unit" }] };
    const fetch = vi.fn().mockResolvedValue(Response.json(payload));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();

    await expect(
      new ApiClient("").get("/api/business-units", {
        params: { limit: 8, offset: 0, search: undefined },
        signal: controller.signal,
      })
    ).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/business-units?limit=8&offset=0", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal: controller.signal,
    });
  });
});
