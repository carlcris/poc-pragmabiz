import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";
import { formatPricingDate, getCurrentPricingDate } from "./pricing-date";

const now = new Date("2026-09-23T19:32:17Z");

function clientFor(value: unknown, status = 200) {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () => new Response(JSON.stringify(value), { status })
  );
  const client = createClient<Database>("http://localhost:54321", "test-key", {
    global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { client, fetch };
}

describe("pricing business dates", () => {
  it("includes September 24 prices while UTC is still September 23", () => {
    expect(formatPricingDate(now)).toBe("2026-09-24");
  });

  it("switches dates exactly at Manila midnight", () => {
    expect(formatPricingDate(new Date("2026-09-23T15:59:59Z"))).toBe("2026-09-23");
    expect(formatPricingDate(new Date("2026-09-23T16:00:00Z"))).toBe("2026-09-24");
  });

  it("handles year rollover and negative UTC offsets", () => {
    expect(formatPricingDate(new Date("2026-12-31T16:00:00Z"))).toBe("2027-01-01");
    expect(formatPricingDate(new Date("2026-09-24T02:00:00Z"), "America/New_York")).toBe(
      "2026-09-23"
    );
  });

  it("uses the configured timezone with one company/BU-scoped lookup", async () => {
    const { client, fetch } = clientFor({ value: "America/New_York" });
    expect(await getCurrentPricingDate(client, "company-1", "bu-1", now)).toBe("2026-09-23");
    expect(fetch).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.searchParams.get("select")).toBe("value");
    expect(url.searchParams.get("company_id")).toBe("eq.company-1");
    expect(url.searchParams.get("business_unit_id")).toBe("eq.bu-1");
    expect(url.searchParams.get("group_key")).toBe("eq.business_unit");
    expect(url.searchParams.get("setting_key")).toBe("eq.timezone");
  });

  it.each([null, { value: "" }])(
    "defaults to Manila for missing/empty settings: %j",
    async (data) => {
      const { client } = clientFor(data);
      expect(await getCurrentPricingDate(client, "company-1", "bu-1", now)).toBe("2026-09-24");
    }
  );

  it("does not query settings without a BU context", async () => {
    const { client, fetch } = clientFor(null);
    expect(await getCurrentPricingDate(client, "company-1", null, now)).toBe("2026-09-24");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([{ value: "invalid/timezone" }, { value: 42 }])(
    "rejects invalid configuration: %j",
    async (data) => {
      const { client } = clientFor(data);
      await expect(getCurrentPricingDate(client, "company-1", "bu-1", now)).rejects.toThrow();
    }
  );

  it("propagates settings errors instead of silently choosing another date", async () => {
    const { client } = clientFor({ message: "lookup failed", code: "42501" }, 403);
    await expect(getCurrentPricingDate(client, "company-1", "bu-1", now)).rejects.toMatchObject({
      code: "42501",
    });
  });
});
