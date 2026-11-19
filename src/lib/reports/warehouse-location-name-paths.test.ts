import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchWarehouseLocationNamePaths } from "./warehouse-location-name-paths";

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
  const result = await fetchWarehouseLocationNamePaths(supabase, "company", [
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
  const result = await fetchWarehouseLocationNamePaths(
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
    fetchWarehouseLocationNamePaths({ from: () => query } as unknown as SupabaseClient, "company", [
      { id: "bin", name: "Bin", path_ids: ["missing", "bin"] },
    ])
  ).rejects.toThrow("ancestors are unavailable");
});

it("bounds ancestor queries to 200 deduplicated IDs and reuses loaded leaf names", async () => {
  const batches: string[][] = [];
  let selectedIds: string[] = [];
  const range = vi.fn(async (start: number, end: number) => ({
    data: selectedIds.slice(start, end + 1).map((id) => ({ id, name: `Name ${id}` })),
    error: null,
  }));
  const query = {
    select: () => query,
    eq: () => query,
    in: (_column: string, ids: string[]) => {
      selectedIds = ids;
      batches.push(ids);
      return query;
    },
    order: () => query,
    range,
  };
  const ancestorIds = Array.from({ length: 401 }, (_, index) => `ancestor-${index}`);
  const result = await fetchWarehouseLocationNamePaths(
    { from: () => query } as unknown as SupabaseClient,
    "company",
    [
      { id: "bin1", name: "Bin 1", path_ids: [...ancestorIds, "bin1"] },
      { id: "bin2", name: "Bin 2", path_ids: [...ancestorIds, "bin2"] },
    ]
  );
  expect(batches.map((ids) => ids.length)).toEqual([200, 200, 1]);
  expect(batches.flat()).toEqual(ancestorIds);
  expect(range.mock.calls).toEqual([
    [0, 199],
    [0, 199],
    [0, 0],
  ]);
  expect(result.get("bin1")).toBe([...ancestorIds.map((id) => `Name ${id}`), "Bin 1"].join(" / "));
});

it("keeps placeholders for blank names and does not query an empty dataset", async () => {
  const from = vi.fn();
  const supabase = { from } as unknown as SupabaseClient;
  expect(await fetchWarehouseLocationNamePaths(supabase, "company", [])).toEqual(new Map());
  const result = await fetchWarehouseLocationNamePaths(supabase, "company", [
    { id: "zone", name: null, path_ids: ["zone"] },
    { id: "rack", name: " ", path_ids: ["zone", "rack"] },
    { id: "bin", name: "Bin 1", path_ids: ["zone", "rack", "bin"] },
  ]);
  expect(result.get("bin")).toBe("-- / -- / Bin 1");
  expect(from).not.toHaveBeenCalled();
});

it("refuses repeated ancestor rows instead of returning a partial path", async () => {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    range: async () => ({ data: [{ id: "zone", name: "Zone" }], error: null }),
  };
  await expect(
    fetchWarehouseLocationNamePaths({ from: () => query } as unknown as SupabaseClient, "company", [
      { id: "bin", name: "Bin", path_ids: ["zone", "rack", "bin"] },
    ])
  ).rejects.toThrow("results are incomplete");
});

it("propagates ancestor query failures for the route to log and sanitize", async () => {
  const failure = { message: "private database failure" };
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    range: async () => ({ data: null, error: failure }),
  };
  await expect(
    fetchWarehouseLocationNamePaths({ from: () => query } as unknown as SupabaseClient, "company", [
      { id: "bin", name: "Bin", path_ids: ["zone", "bin"] },
    ])
  ).rejects.toBe(failure);
});
