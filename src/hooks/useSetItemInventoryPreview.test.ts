import { afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { useSetItemInventoryPreview } from "./useItemUnitOptions";
const state = vi.hoisted(() => ({
  client: null as QueryClient | null,
  success: undefined as undefined | (() => unknown),
}));
vi.mock("@tanstack/react-query", async (load) => ({
  ...(await load<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => state.client,
  useMutation: (options: { onSuccess: typeof state.success }) => {
    state.success = options.onSuccess;
    return {};
  },
}));
afterEach(() => state.client?.clear());

it("refreshes active unit options, inventory, and item detail queries and stales the inactive ones", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  state.client = client;
  const activeUnitOptions = ["item-unit-options", "item", undefined];
  const inactiveUnitOptions = ["item-unit-options", "item", { activeOnly: true }];
  const inactiveInventory = ["items", "inventory", "bu", { page: 2 }];
  const unrelatedItem = ["items", "other-item"];
  const unrelatedQuery = ["warehouses"];
  // The detail response carries the nominated unit the stock cards and Locations tab read,
  // while its batch children hold stock data this mutation does not touch.
  const itemBatches = ["items", "item", "batches", { warehouseId: "wh" }];
  for (const key of [
    activeUnitOptions,
    inactiveUnitOptions,
    inactiveInventory,
    unrelatedItem,
    unrelatedQuery,
    itemBatches,
  ]) {
    client.setQueryData(key, "before");
  }
  const fetchUnitOptions = vi.fn(async () => "after");
  const fetchInventory = vi.fn(async () => "after");
  const fetchItemDetail = vi.fn(async () => "after");
  const activeInventory = ["items", "inventory", "bu", { page: 1 }];
  const activeItemDetail = ["items", "item"];
  client.setQueryData(activeInventory, "before");
  client.setQueryData(activeItemDetail, "before");
  const observers = [
    new QueryObserver(client, { queryKey: activeUnitOptions, queryFn: fetchUnitOptions }),
    new QueryObserver(client, { queryKey: activeInventory, queryFn: fetchInventory }),
    new QueryObserver(client, { queryKey: activeItemDetail, queryFn: fetchItemDetail }),
  ];
  const stops = observers.map((observer) => observer.subscribe(() => {}));

  useSetItemInventoryPreview("item");
  await state.success!();

  expect(client.getQueryData(activeUnitOptions)).toBe("after");
  expect(client.getQueryData(activeInventory)).toBe("after");
  expect(client.getQueryData(activeItemDetail)).toBe("after");
  expect(fetchUnitOptions).toHaveBeenCalledTimes(1);
  expect(fetchInventory).toHaveBeenCalledTimes(1);
  expect(fetchItemDetail).toHaveBeenCalledTimes(1);
  expect(client.getQueryState(inactiveUnitOptions)?.isInvalidated).toBe(true);
  expect(client.getQueryState(inactiveInventory)?.isInvalidated).toBe(true);
  expect(client.getQueryState(unrelatedItem)?.isInvalidated).toBe(false);
  expect(client.getQueryState(unrelatedQuery)?.isInvalidated).toBe(false);
  expect(client.getQueryState(itemBatches)?.isInvalidated).toBe(false);
  stops.forEach((stop) => stop());
});

it("stales a cached item detail left behind by an unmounted page", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  state.client = client;
  const inactiveItemDetail = ["items", "item"];
  const unrelatedItem = ["items", "other-item"];
  client.setQueryData(inactiveItemDetail, "before");
  client.setQueryData(unrelatedItem, "before");

  useSetItemInventoryPreview("item");
  await state.success!();

  // Returning to the detail page must load the nominated unit instead of the stale cache.
  expect(client.getQueryState(inactiveItemDetail)?.isInvalidated).toBe(true);
  expect(client.getQueryState(unrelatedItem)?.isInvalidated).toBe(false);
});
