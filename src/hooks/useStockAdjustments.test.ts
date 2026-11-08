import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import {
  ITEM_LOCATIONS_QUERY_KEY,
  ITEMS_STOCK_QUERY_KEY,
  STOCK_ADJUSTMENT_BATCH_LOCATIONS_QUERY_KEY,
} from "@/hooks/queryKeys";
import {
  useCreateStockAdjustment,
  useUpdateStockAdjustment,
  usePostStockAdjustment,
} from "./useStockAdjustments";

const state = vi.hoisted(() => ({
  client: null as QueryClient | null,
  onSuccess: undefined as (() => void) | undefined,
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => state.client,
  useMutation: (options: { onSuccess?: () => void }) => {
    state.onSuccess = options.onSuccess;
    return {};
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  state.client = new QueryClient({
    defaultOptions: { queries: { staleTime: 300_000, retry: false } },
  });
  state.onSuccess = undefined;
});

describe("stock adjustment cache refresh", () => {
  it.each([useCreateStockAdjustment, useUpdateStockAdjustment])(
    "%s marks previously visited Locations stale without changing stock quantities",
    (useMutationHook) => {
      const client = state.client!;
      const locationsKey = [ITEM_LOCATIONS_QUERY_KEY, "item-1", "bu-1"];
      const stockKey = [ITEMS_STOCK_QUERY_KEY, { page: 1 }];
      client.setQueryData(locationsKey, { batches: [] });
      client.setQueryData(stockKey, { quantity: 0 });
      useMutationHook();
      state.onSuccess!();
      expect(client.getQueryState(locationsKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(stockKey)?.isInvalidated).toBe(false);
      client.clear();
    }
  );

  it("refetches mounted Locations and marks cached stock stale after posting", async () => {
    const client = state.client!;
    const locationsKey = [ITEM_LOCATIONS_QUERY_KEY, "item-1", "bu-1"];
    const stockKey = [ITEMS_STOCK_QUERY_KEY, { warehouseId: "warehouse-1" }];
    client.setQueryData(locationsKey, { quantity: 0 });
    client.setQueryData(stockKey, { quantity: 0 });
    const fetchLocations = vi.fn(async () => ({ quantity: 1 }));
    const observer = new QueryObserver(client, { queryKey: locationsKey, queryFn: fetchLocations });
    const unsubscribe = observer.subscribe(() => {});
    expect(fetchLocations).not.toHaveBeenCalled();
    usePostStockAdjustment();
    state.onSuccess!();
    await vi.waitFor(() => expect(client.getQueryData(locationsKey)).toEqual({ quantity: 1 }));
    expect(fetchLocations).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(stockKey)?.isInvalidated).toBe(true);
    unsubscribe();
    client.clear();
  });
});

it.each([useCreateStockAdjustment, useUpdateStockAdjustment, usePostStockAdjustment])(
  "%s refreshes active destination options and invalidates inactive searches",
  async (useHook) => {
    const client = state.client!;
    const active = [
      STOCK_ADJUSTMENT_BATCH_LOCATIONS_QUERY_KEY,
      "item",
      "warehouse",
      "location-b",
      "",
      "existing",
    ];
    const inactive = [
      STOCK_ADJUSTMENT_BATCH_LOCATIONS_QUERY_KEY,
      "different-item",
      "warehouse",
      "location-b",
      "OLD",
      "existing",
    ];
    const unrelated = ["unrelated-settings"];
    client.setQueryData(active, { data: [{ itemBatchLocationId: null }] });
    client.setQueryData(inactive, { data: [] });
    client.setQueryData(unrelated, {});
    const fetch = vi.fn(async () => ({ data: [{ itemBatchLocationId: "destination" }] }));
    const observer = new QueryObserver(client, { queryKey: active, queryFn: fetch });
    const unsubscribe = observer.subscribe(() => {});
    useHook();
    state.onSuccess!();
    await vi.waitFor(() =>
      expect(client.getQueryData(active)).toEqual({
        data: [{ itemBatchLocationId: "destination" }],
      })
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(inactive)?.isInvalidated).toBe(true);
    expect(client.getQueryState(unrelated)?.isInvalidated).toBe(false);
    unsubscribe();
    client.clear();
  }
);
