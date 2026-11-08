import { beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver, type UseQueryOptions } from "@tanstack/react-query";
import { useInventoryItems } from "./useInventoryItems";
import { useUpdateItem } from "./useItems";
import type { ItemInventoryResponse } from "@/types/item-inventory";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  client: null as QueryClient | null,
  businessUnitId: "unit",
}));
vi.mock("@/lib/api", () => ({ apiClient: { get: mocks.get } }));
vi.mock("@/hooks/useRealtimeDomainInvalidation", () => ({
  useRealtimeDomainInvalidation: vi.fn(),
}));
vi.mock("@/stores/businessUnitStore", () => ({
  useBusinessUnitStore: (select: (state: { currentBusinessUnit: { id: string } }) => unknown) =>
    select({ currentBusinessUnit: { id: mocks.businessUnitId } }),
}));
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<typeof import("@tanstack/react-query")>()),
  useQuery: (options: unknown) => options,
  useQueryClient: () => mocks.client,
  useMutation: (options: unknown) => options,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.businessUnitId = "unit";
});
it("keeps the inventory view inside existing mutation invalidation and retains previous rows", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  mocks.client = client;
  const options = useInventoryItems({
    page: 1,
    limit: 10,
    enabled: true,
  }) as unknown as UseQueryOptions<ItemInventoryResponse>;
  const initial = { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } };
  client.setQueryData(options.queryKey!, initial);
  const inactive = ["items", "inventory", "unit", { page: 2, limit: 10 }];
  client.setQueryData(inactive, initial);
  client.setQueryData(["unrelated"], "keep");
  mocks.get.mockResolvedValue(initial);
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => {});
  const mutation = useUpdateItem() as unknown as {
    onSuccess: (result: unknown, variables: { id: string }) => void;
  };
  mutation.onSuccess({ data: { id: "item" } }, { id: "item" });
  await vi.waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
  expect(mocks.get).toHaveBeenCalledWith("/api/items?view=inventory&page=1&limit=10");
  expect(client.getQueryState(inactive)?.isInvalidated).toBe(true);
  expect(client.getQueryState(["unrelated"])?.isInvalidated).toBe(false);
  unsubscribe();
  client.clear();
});

it("retains rows for pagination but clears them while another business unit loads", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const useInventoryOptions = (page: number) =>
    useInventoryItems({
      page,
      limit: 10,
      enabled: true,
    }) as unknown as UseQueryOptions<ItemInventoryResponse>;
  const first = useInventoryOptions(1);
  const oldData: ItemInventoryResponse = {
    data: [
      {
        id: "item",
        code: "ITEM",
        supplierCode: null,
        name: "Item",
        category: "Glass",
        onHand: 2042,
        allocated: 344,
        available: 1698,
        putawayQty: 0,
        reorderPoint: 0,
        status: "normal",
      },
    ],
    pagination: { page: 1, limit: 10, total: 20, totalPages: 2 },
  };
  client.setQueryData(first.queryKey, oldData);
  const observer = new QueryObserver(client, first);
  const unsubscribe = observer.subscribe(() => {});
  let resolvePage!: (data: ItemInventoryResponse) => void;
  mocks.get.mockImplementationOnce(
    () =>
      new Promise<ItemInventoryResponse>((resolve) => {
        resolvePage = resolve;
      })
  );
  observer.setOptions(useInventoryOptions(2));
  expect(observer.getCurrentResult().data).toBe(oldData);
  expect(observer.getCurrentResult().isPlaceholderData).toBe(true);
  resolvePage(oldData);
  await vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false));

  mocks.businessUnitId = "other-unit";
  let resolveUnit!: (data: ItemInventoryResponse) => void;
  mocks.get.mockImplementationOnce(
    () =>
      new Promise<ItemInventoryResponse>((resolve) => {
        resolveUnit = resolve;
      })
  );
  observer.setOptions(useInventoryOptions(1));
  expect(observer.getCurrentResult().data).toBeUndefined();
  expect(observer.getCurrentResult().isLoading).toBe(true);
  const newData = {
    ...oldData,
    data: [{ ...oldData.data[0], onHand: 1001, allocated: 0, available: 1001 }],
  };
  resolveUnit(newData);
  await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual(newData));
  unsubscribe();
  client.clear();
});
