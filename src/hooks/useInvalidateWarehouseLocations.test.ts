import { QueryClient, QueryObserver, type QueryKey } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useInvalidateWarehouseLocations } from "./useInvalidateWarehouseLocations";
import {
  ITEM_LOCATIONS_QUERY_KEY,
  ITEM_LOCATION_BATCH_REPORT_QUERY_KEY,
  STOCK_AGING_REPORT_QUERY_KEY,
} from "./queryKeys";

const state = vi.hoisted(() => ({ client: null as QueryClient | null }));
vi.mock("@tanstack/react-query", async (load) => ({
  ...(await load<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => state.client,
}));
beforeEach(() => {
  state.client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
});
afterEach(() => state.client?.clear());

const affectedKeys: QueryKey[] = [
  ["business-unit", "bu", "warehouse-floor-map", "warehouse", 1],
  ["stock-adjustments", "adjustment"],
  ["stock-adjustments", { warehouseId: "warehouse" }],
  ["warehouse-locations", "warehouse", "detail", "rack"],
  ["warehouse-locations", "warehouse", "tree", "rack"],
  ["lookups", "warehouse_locations", "warehouse", "Rack"],
  ["purchasing-dashboard", "warehouseCapacity"],
  [ITEM_LOCATIONS_QUERY_KEY, "item", "bu", "tree", "warehouse", "rack", 1],
  [ITEM_LOCATIONS_QUERY_KEY, "item", "bu", "node", "warehouse", "bin"],
  [ITEM_LOCATIONS_QUERY_KEY, "item", "bu", "warehouses", 1],
  [ITEM_LOCATIONS_QUERY_KEY, "item", "bu", "search", "Rack", 1],
  [ITEM_LOCATION_BATCH_REPORT_QUERY_KEY, { warehouseId: "warehouse", search: "Rack" }],
  [ITEM_LOCATION_BATCH_REPORT_QUERY_KEY, { page: 2 }],
  [STOCK_AGING_REPORT_QUERY_KEY, { search: "Rack" }],
];
it("marks inactive location views and location-bearing reports stale without fetching them", async () => {
  const client = state.client!;
  for (const key of affectedKeys) client.setQueryData(key, { name: "Old Rack" });
  const fetch = vi.fn();
  // Inactive cached data must remain available, but stale even with infinite staleTime.
  client.setQueryDefaults([ITEM_LOCATIONS_QUERY_KEY], { queryFn: fetch });
  await useInvalidateWarehouseLocations("warehouse")();
  for (const key of affectedKeys) {
    expect(client.getQueryState(key)?.isInvalidated, JSON.stringify(key)).toBe(true);
    expect(client.getQueryData(key)).toEqual({ name: "Old Rack" });
  }
  expect(fetch).not.toHaveBeenCalled();
});
it("refreshes active tree, selected detail, preferred name, and report observers after a rename", async () => {
  const client = state.client!;
  const observers = affectedKeys.map((key) => {
    client.setQueryData(key, { name: "Old Rack", path: "Old Rack / Bin" });
    const queryFn = vi.fn().mockResolvedValue({ name: "New Rack", path: "New Rack / Bin" });
    const observer = new QueryObserver(client, { queryKey: key, queryFn, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    return { observer, queryFn, unsubscribe };
  });
  await useInvalidateWarehouseLocations("warehouse")();
  for (const { observer, queryFn, unsubscribe } of observers) {
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().data).toEqual({ name: "New Rack", path: "New Rack / Bin" });
    unsubscribe();
  }
});
it("refetches an inactive summary when returning to it instead of reusing its fresh old name", async () => {
  const client = state.client!;
  const key = [ITEM_LOCATIONS_QUERY_KEY, "item", "bu", "warehouses", 1];
  client.setQueryData(key, { defaultLocationName: "Old Rack" });
  await useInvalidateWarehouseLocations("warehouse")();
  const queryFn = vi.fn().mockResolvedValue({ defaultLocationName: "New Rack" });
  const observer = new QueryObserver(client, { queryKey: key, queryFn, staleTime: Infinity });
  const unsubscribe = observer.subscribe(() => {});
  await vi.waitFor(() =>
    expect(observer.getCurrentResult().data).toEqual({ defaultLocationName: "New Rack" })
  );
  expect(queryFn).toHaveBeenCalledTimes(1);
  unsubscribe();
});
it("leaves other warehouses and unrelated query families fresh without refetching", async () => {
  const client = state.client!;
  const keys: QueryKey[] = [
    ["business-unit", "bu", "warehouse-floor-map", "other", 1],
    ["stock-adjustments", { warehouseId: "other" }],
    ["warehouse-locations", "other", "detail", "rack"],
    ["lookups", "warehouse_locations", "other"],
    [ITEM_LOCATION_BATCH_REPORT_QUERY_KEY, { warehouseId: "other" }],
    ["purchasing-dashboard", "orders"],
    [ITEM_LOCATIONS_QUERY_KEY, "item", "bu", "tree", "other", "rack", 1],
    [ITEM_LOCATIONS_QUERY_KEY, "item", "bu", "node", "other", "bin"],
    ["lookups", "items"],
    ["items", "item"],
    ["inventory-report", {}],
  ];
  const queryFn = vi.fn();
  const subscriptions = keys.map((key) => {
    client.setQueryData(key, "unchanged");
    return new QueryObserver(client, { queryKey: key, queryFn, staleTime: Infinity }).subscribe(
      () => {}
    );
  });
  await useInvalidateWarehouseLocations("warehouse")();
  for (const key of keys) {
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    expect(client.getQueryData(key)).toBe("unchanged");
  }
  expect(queryFn).not.toHaveBeenCalled();
  subscriptions.forEach((unsubscribe) => unsubscribe());
});
