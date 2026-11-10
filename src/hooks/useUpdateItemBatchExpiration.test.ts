import { beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { ITEM_LOCATIONS_QUERY_KEY } from "@/hooks/queryKeys";
import { useUpdateItemBatchExpiration } from "./useUpdateItemBatchExpiration";
const state = vi.hoisted(() => ({
  client: null as QueryClient | null,
  success: undefined as undefined | (() => Promise<void>),
}));
vi.mock("@tanstack/react-query", async (load) => ({
  ...(await load<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => state.client,
  useMutation: (options: { onSuccess: () => Promise<void> }) => {
    state.success = options.onSuccess;
    return {};
  },
}));
beforeEach(() => {
  state.client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
});
it("refetches active batch views, stales other locations and adjustments, and preserves unrelated caches", async () => {
  const client = state.client!;
  const active = [ITEM_LOCATIONS_QUERY_KEY, "item", "bu", "location-a", 1];
  const inactive = [ITEM_LOCATIONS_QUERY_KEY, "item", "bu", "location-b", 2];
  const adjustment = ["stock-adjustments", "draft"];
  const unrelated = [ITEM_LOCATIONS_QUERY_KEY, "other-item"];
  for (const key of [active, inactive, adjustment, unrelated]) client.setQueryData(key, "old");
  const fetch = vi.fn(async () => "new");
  const observer = new QueryObserver(client, { queryKey: active, queryFn: fetch });
  const stop = observer.subscribe(() => {});
  useUpdateItemBatchExpiration("item");
  await state.success!();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(client.getQueryData(active)).toBe("new");
  expect(client.getQueryState(inactive)?.isInvalidated).toBe(true);
  expect(client.getQueryState(adjustment)?.isInvalidated).toBe(true);
  expect(client.getQueryState(unrelated)?.isInvalidated).toBe(false);
  stop();
  client.clear();
});
