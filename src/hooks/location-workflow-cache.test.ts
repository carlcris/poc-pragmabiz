import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePostStockAdjustment } from "./useStockAdjustments";
import { usePostPutawayTask } from "./usePutawayTasks";
import { useSaveWarehouseFloorMap, warehouseFloorMapQueryKey } from "./useWarehouseFloorMap";
import { ITEM_LOCATIONS_QUERY_KEY } from "./queryKeys";
import type { WarehouseFloorMapResponse } from "@/types/warehouse-floor-map";

const state = vi.hoisted(() => ({
  client: null as QueryClient | null,
  onSuccess: undefined as ((...args: unknown[]) => void) | undefined,
}));
vi.mock("@tanstack/react-query", async (load) => ({
  ...(await load<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => state.client,
  useMutation: (options: { onSuccess: (...args: unknown[]) => void }) => {
    state.onSuccess = options.onSuccess;
    return {};
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => {
  state.client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
});
afterEach(() => state.client?.clear());

it.each([
  {
    name: "posting an adjustment empties a bin",
    hook: usePostStockAdjustment,
    before: 12,
    after: 0,
    pending: 0,
  },
  {
    name: "posting putaway fills a bin and clears pending work",
    hook: usePostPutawayTask,
    before: 0,
    after: 12,
    pending: 1,
  },
])(
  "$name refreshes active detail and invalidates inactive ancestors",
  async ({ hook, before, after, pending }) => {
    const client = state.client!;
    const detail = ["warehouse-locations", "warehouse", "detail", "bin"];
    const inactiveKeys = [
      ["warehouse-locations", "warehouse", "detail", "parent"],
      ["warehouse-locations", "warehouse", "children", "root", 1],
      ["warehouse-locations", "warehouse", "children", "parent", 1],
    ];
    client.setQueryData(detail, { stock: before, pendingPutaway: pending, canMove: false });
    inactiveKeys.forEach((key) => client.setQueryData(key, { stock: before }));
    const unrelated = ["user-profile", "user"];
    client.setQueryData(unrelated, { name: "User" });
    const fetch = vi
      .fn()
      .mockResolvedValue({ stock: after, pendingPutaway: 0, canMove: after === 0 });
    const observer = new QueryObserver(client, { queryKey: detail, queryFn: fetch });
    const unsubscribe = observer.subscribe(() => {});
    expect(fetch).not.toHaveBeenCalled();
    hook();
    state.onSuccess!();
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data).toEqual({
        stock: after,
        pendingPutaway: 0,
        canMove: after === 0,
      })
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    inactiveKeys.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
    expect(client.getQueryState(unrelated)?.isInvalidated).toBe(false);
    unsubscribe();
  }
);

it("saving an existing map refreshes highlights and off-floor counts for that map only", async () => {
  const client = state.client!;
  const activeKey = [ITEM_LOCATIONS_QUERY_KEY, "item", "floor", "bu", "map"];
  const inactiveKey = [ITEM_LOCATIONS_QUERY_KEY, "other-item", "floor", "bu", "map"];
  const unaffectedKeys = [
    [ITEM_LOCATIONS_QUERY_KEY, "item", "floor", "bu", "other-map"],
    [ITEM_LOCATIONS_QUERY_KEY, "item", "floor", "other-bu", "map"],
    [ITEM_LOCATIONS_QUERY_KEY, "item", "bu", "warehouses", 1],
    ["user-profile", "user"],
  ];
  const oldStock = { data: { rackIds: [], offFloorLocationCount: 1 } };
  const newStock = { data: { rackIds: ["rack"], offFloorLocationCount: 0 } };
  [activeKey, inactiveKey, ...unaffectedKeys].forEach((key) => client.setQueryData(key, oldStock));
  const fetch = vi.fn().mockResolvedValue(newStock);
  const observer = new QueryObserver(client, { queryKey: activeKey, queryFn: fetch });
  const unsubscribe = observer.subscribe(() => {});
  const response: WarehouseFloorMapResponse = {
    data: {
      id: "map",
      warehouseId: "warehouse",
      floorNumber: 1,
      name: "Floor",
      imageUrl: "/map.png",
      imageWidth: 1000,
      imageHeight: 1000,
      version: 2,
      racks: [],
    },
  };
  useSaveWarehouseFloorMap("bu");
  state.onSuccess!(response, { warehouseId: "warehouse", floorNumber: 1 });
  await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual(newStock));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(client.getQueryData(warehouseFloorMapQueryKey("bu", "warehouse", 1))).toEqual(response);
  expect(client.getQueryState(inactiveKey)?.isInvalidated).toBe(true);
  for (const key of unaffectedKeys) {
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    expect(client.getQueryData(key)).toEqual(oldStock);
  }
  unsubscribe();
  const reopened = new QueryObserver(client, { queryKey: inactiveKey, queryFn: fetch });
  const close = reopened.subscribe(() => {});
  await vi.waitFor(() => expect(reopened.getCurrentResult().data).toEqual(newStock));
  expect(fetch).toHaveBeenCalledTimes(2);
  close();
});
