import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { PickList } from "@/types/pick-list";
import { useRecordPickListProgress } from "./useRecordPickListProgress";

const state = vi.hoisted(() => ({
  client: null as QueryClient | null,
  onSuccess: undefined as ((updated: PickList) => Promise<void>) | undefined,
}));
vi.mock("@tanstack/react-query", async (load) => ({
  ...(await load<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => state.client,
  useMutation: (options: { onSuccess: typeof state.onSuccess }) => {
    state.onSuccess = options.onSuccess;
    return {};
  },
}));
afterEach(() => state.client?.clear());
it("refreshes active picking and reservation views, stales both location caches, and leaves unrelated data alone", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  state.client = client;
  const activeKeys = [
    ["pick-lists", "list"],
    ["delivery-notes", "dn"],
    ["inventory-reservations", "bu"],
    ["warehouse-dashboard", "operations-overview", "bu"],
    ["item-locations", "item"],
    ["warehouse-locations", "wh", "detail", "source"],
    ["warehouse-locations", "wh", "detail", "destination"],
  ];
  const observations = activeKeys.map((queryKey) => {
    client.setQueryData(queryKey, "before");
    const queryFn = vi.fn().mockResolvedValue("after");
    const observer = new QueryObserver(client, { queryKey, queryFn });
    return { observer, queryFn, unsubscribe: observer.subscribe(() => {}) };
  });
  const inactiveKeys = [
    ["warehouse-locations", "wh", "children", "root", 1],
    ["item-location-batch-report"],
    ["lookups", "stock-request-batches", "item"],
    ["expired-batches-report"],
  ];
  inactiveKeys.forEach((key) => client.setQueryData(key, "cached"));
  client.setQueryData(["suppliers"], "unchanged");
  useRecordPickListProgress("list-id");
  await state.onSuccess!({ id: "list-id" } as PickList);
  observations.forEach(({ observer, queryFn, unsubscribe }) => {
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().data).toBe("after");
    unsubscribe();
  });
  inactiveKeys.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
  expect(client.getQueryState(["suppliers"])?.isInvalidated).toBe(false);
});
