import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { useMoveStock } from "./useMoveStock";

const state = vi.hoisted(() => ({
  client: null as QueryClient | null,
  onSuccess: undefined as (() => void) | undefined,
}));

vi.mock("@tanstack/react-query", async (load) => ({
  ...(await load<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => state.client,
  useMutation: (options: { onSuccess: () => void }) => {
    state.onSuccess = options.onSuccess;
    return {};
  },
}));

afterEach(() => {
  state.client?.clear();
});

it("refreshes loaded warehouse location quantities and marks inactive locations stale after a move", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  state.client = client;
  const before = { bin1: 500, bin2: 0 };
  const after = { bin1: 0, bin2: 500 };
  const keys = [
    ["warehouse-locations", "wh", 1, 50, null, "", undefined],
    ["warehouse-locations", "wh", "children", "root", 1],
    ["warehouse-locations", "wh", "detail", "bin1"],
    ["warehouse-locations", "wh", "detail", "bin2"],
  ];
  const observers = keys.map((queryKey) => {
    client.setQueryData(queryKey, before);
    const queryFn = vi.fn().mockResolvedValue(after);
    const observer = new QueryObserver(client, { queryKey, queryFn });
    const unsubscribe = observer.subscribe(() => {});
    return { observer, queryFn, unsubscribe };
  });
  const inactiveKey = ["warehouse-locations", "destination-wh", "children", "root", 1];
  client.setQueryData(inactiveKey, before);
  client.setQueryData(["unrelated"], "unchanged");

  useMoveStock();
  state.onSuccess!();

  await vi.waitFor(() => {
    for (const { observer, queryFn } of observers) {
      expect(observer.getCurrentResult().data).toEqual(after);
      expect(queryFn).toHaveBeenCalledTimes(1);
    }
  });
  expect(client.getQueryState(inactiveKey)?.isInvalidated).toBe(true);
  expect(client.getQueryState(["unrelated"])?.isInvalidated).toBe(false);
  observers.forEach(({ unsubscribe }) => unsubscribe());
});
