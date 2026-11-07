import { QueryClient, QueryObserver, type UseQueryOptions } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { useItemLocationStockNode } from "./useItemLocationStockNode";
import { useMoveStock } from "./useMoveStock";
import { apiClient } from "@/lib/api";

const state = vi.hoisted(() => ({
  client: null as QueryClient | null,
  options: undefined as UseQueryOptions | undefined,
  moved: undefined as undefined | (() => void),
}));
vi.mock("@tanstack/react-query", async (load) => ({
  ...(await load<typeof import("@tanstack/react-query")>()),
  useQuery: (options: UseQueryOptions) => {
    state.options = options;
    return {};
  },
  useQueryClient: () => state.client,
  useMutation: (options: { onSuccess: () => void }) => {
    state.moved = options.onSuccess;
    return {};
  },
}));
vi.mock("@/stores/businessUnitStore", () => ({ useBusinessUnitStore: () => "bu" }));
afterEach(() => {
  state.client?.clear();
  vi.restoreAllMocks();
});
it("refetches the selected node on successful stock-move invalidation", async () => {
  state.client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const get = vi
    .spyOn(apiClient, "get")
    .mockResolvedValueOnce({
      data: [{ directOnHand: 100, directReserved: 20, directAvailable: 80 }],
    })
    .mockResolvedValueOnce({
      data: [{ directOnHand: 70, directReserved: 20, directAvailable: 50 }],
    });
  useItemLocationStockNode("item", "wh", "rack");
  const observer = new QueryObserver(state.client, state.options!);
  const unsubscribe = observer.subscribe(() => {});
  await vi.waitFor(() =>
    expect(observer.getCurrentResult().data).toEqual({
      data: [{ directOnHand: 100, directReserved: 20, directAvailable: 80 }],
    })
  );
  useMoveStock();
  state.moved!();
  await vi.waitFor(() =>
    expect(observer.getCurrentResult().data).toEqual({
      data: [{ directOnHand: 70, directReserved: 20, directAvailable: 50 }],
    })
  );
  expect(get).toHaveBeenCalledTimes(2);
  expect(get).toHaveBeenLastCalledWith("/api/items/item/location-stock-tree", {
    params: { warehouseId: "wh", locationId: "rack", limit: 1 },
  });
  unsubscribe();
});
