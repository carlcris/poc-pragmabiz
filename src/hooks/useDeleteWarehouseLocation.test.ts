import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { useDeleteWarehouseLocation } from "./useDeleteWarehouseLocation";
const state = vi.hoisted(() => ({ client: null as QueryClient | null, remove: vi.fn() }));
vi.mock("@tanstack/react-query", async (load) => ({
  ...(await load<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => state.client,
  useMutation: (options: unknown) => options,
}));
vi.mock("@/lib/api", () => ({ apiClient: { delete: state.remove } }));
it("deletes once and refreshes active location views while marking inactive selectors stale", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  state.client = client;
  const active = ["warehouse-locations", "warehouse", "tree"];
  const inactive = ["lookups", "warehouse_locations", "warehouse"];
  const unrelated = ["warehouse-locations", "other"];
  for (const key of [active, inactive, unrelated]) client.setQueryData(key, ["deleted-location"]);
  const queryFn = vi.fn().mockResolvedValue([]);
  const observer = new QueryObserver(client, { queryKey: active, queryFn });
  const unsubscribe = observer.subscribe(() => {});
  const mutation = useDeleteWarehouseLocation("warehouse") as unknown as {
    mutationFn: (id: string) => Promise<unknown>;
    onSuccess: () => Promise<void>;
  };
  state.remove.mockResolvedValue({ success: true });
  await mutation.mutationFn("location");
  await mutation.onSuccess();
  expect(state.remove).toHaveBeenCalledExactlyOnceWith("/api/warehouse-locations/location");
  expect(queryFn).toHaveBeenCalledTimes(1);
  expect(observer.getCurrentResult().data).toEqual([]);
  expect(client.getQueryState(inactive)?.isInvalidated).toBe(true);
  expect(client.getQueryState(unrelated)?.isInvalidated).toBe(false);
  unsubscribe();
  client.clear();
});
