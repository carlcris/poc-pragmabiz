import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchStockAgingLocationPaths } from "./stock-aging-location-paths";

it("preserves full hierarchy names, deduplicates ancestors, and handles capped responses", async () => {
  const calls: unknown[][] = [];
  const ancestors = [
    { id: "rack", name: "Rack - A" },
    { id: "shelf", name: "Shelf / Upper" },
  ];
  const query = {
    select: (columns: string) => {
      calls.push(["select", columns]);
      return query;
    },
    eq: (column: string, value: string) => {
      calls.push([column, value]);
      return query;
    },
    in: (column: string, ids: string[]) => {
      calls.push([column, ids]);
      return query;
    },
    order: () => query,
    range: async (start: number) => ({ data: ancestors.slice(start, start + 1), error: null }),
  };
  const supabase = { from: () => query } as unknown as SupabaseClient;
  const result = await fetchStockAgingLocationPaths(supabase, "company", [
    { id: "bin1", name: "Bin 1", path_ids: ["rack", "shelf", "bin1"] },
    { id: "bin2", name: "Bin 2", path_ids: ["rack", "shelf", "bin2"] },
  ]);
  expect(result.get("bin1")).toBe("Rack - A / Shelf / Upper / Bin 1");
  expect(result.get("bin2")).toBe("Rack - A / Shelf / Upper / Bin 2");
  expect(calls.filter((call) => call[0] === "id")).toEqual([
    ["id", ["rack", "shelf"]],
    ["id", ["rack", "shelf"]],
  ]);
  expect(calls).toContainEqual(["company_id", "company"]);
});
it("reuses already-loaded ancestors without an additional query", async () => {
  const from = vi.fn();
  const result = await fetchStockAgingLocationPaths(
    { from } as unknown as SupabaseClient,
    "company",
    [
      { id: "rack", name: "Rack A", path_ids: ["rack"] },
      { id: "bin", name: "Bin 1", path_ids: ["rack", "bin"] },
    ]
  );
  expect(result.get("bin")).toBe("Rack A / Bin 1");
  expect(from).not.toHaveBeenCalled();
});
it("refuses a partial path when an ancestor is unavailable", async () => {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    range: async () => ({ data: [], error: null }),
  };
  await expect(
    fetchStockAgingLocationPaths({ from: () => query } as unknown as SupabaseClient, "company", [
      { id: "bin", name: "Bin", path_ids: ["missing", "bin"] },
    ])
  ).rejects.toThrow("ancestors are unavailable");
});
