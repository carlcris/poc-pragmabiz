import {
  InfiniteQueryObserver,
  QueryClient,
  type InfiniteData,
  type InfiniteQueryObserverOptions,
  type MutationObserverOptions,
  type QueryKey,
} from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { InventoryBoxCountBusinessUnitsResponse } from "@/types/inventory-box-count-report";
import { useInventoryBoxCountBusinessUnits } from "./useInventoryBoxCountBusinessUnits";
import { useAssignRole, useRemoveRole } from "./useUsers";

type LookupResponse = InventoryBoxCountBusinessUnitsResponse;
type LookupOptions = InfiniteQueryObserverOptions<
  LookupResponse,
  Error,
  InfiniteData<LookupResponse>,
  QueryKey,
  number
>;
type RoleVariables = { userId: string; roleId: string; businessUnitId: string };

const state = vi.hoisted(() => ({
  client: null as QueryClient | null,
  options: null as LookupOptions | null,
  get: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (load) => {
  const actual = await load<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useInfiniteQuery: (options: LookupOptions) => {
      state.options = options;
    },
    useQueryClient: () => state.client,
    useMutation: (options: MutationObserverOptions<unknown, Error, RoleVariables>) => {
      if (!state.client) throw new Error("Missing query client");
      const observer = new actual.MutationObserver(state.client, options);
      return { mutateAsync: observer.mutate.bind(observer) };
    },
  };
});
vi.mock("@/lib/api", () => ({
  apiClient: {
    get: state.get,
    post: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (select: (auth: unknown) => unknown) =>
    select({ user: { id: "actor" }, isAuthenticated: true, isLoggingOut: false }),
}));

function lookupOptions(search: string) {
  function BusinessUnitLookup() {
    useInventoryBoxCountBusinessUnits({
      companyId: "company",
      currentBusinessUnitId: "current",
      search,
      enabled: true,
    });
    return null;
  }
  renderToStaticMarkup(createElement(BusinessUnitLookup));
  if (!state.options) throw new Error("The business-unit lookup is not configured");
  return state.options;
}

const branch = { id: "branch", name: "Branch warehouse" };
const depot = { id: "depot", name: "Depot warehouse" };
const page = (data: LookupResponse["data"], number = 1, totalPages = 1): LookupResponse => ({
  data,
  pagination: { page: number, limit: 5, total: totalPages > 1 ? 6 : data.length, totalPages },
});

beforeEach(() => {
  state.client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  state.options = null;
  state.get.mockReset();
});
afterEach(() => state.client?.clear());

it("requests five initial server results and appends bounded pages for the searched term", async () => {
  const client = state.client!;
  state.get
    .mockResolvedValueOnce(page([branch]))
    .mockResolvedValueOnce(page([branch], 1, 2))
    .mockResolvedValueOnce(page([depot], 2, 2));
  const initial = new InfiniteQueryObserver(client, lookupOptions(""));
  await initial.refetch();
  const searched = new InfiniteQueryObserver(client, lookupOptions("  warehouse  "));
  await searched.refetch();
  expect(searched.getCurrentResult().hasNextPage).toBe(true);
  const result = await searched.fetchNextPage();

  expect(result.data?.pages.flatMap(({ data }) => data)).toEqual([branch, depot]);
  expect(result.hasNextPage).toBe(false);
  expect(state.get.mock.calls).toEqual(
    [
      { page: 1, limit: 5, search: undefined },
      { page: 1, limit: 5, search: "warehouse" },
      { page: 2, limit: 5, search: "warehouse" },
    ].map((params) => [
      "/api/reports/inventory-box-count/business-units",
      { params, signal: expect.any(AbortSignal) },
    ])
  );
});

it.each([
  { hook: useAssignRole, change: "assigning", before: [branch], after: [branch, depot] },
  { hook: useRemoveRole, change: "removing", before: [branch, depot], after: [branch] },
])(
  "refreshes report options after $change the current user's membership",
  async ({ hook, before, after }) => {
    const client = state.client!;
    const activeOptions = lookupOptions("");
    const inactiveKey = lookupOptions("warehouse").queryKey;
    const unrelatedKey = ["items", "report-item-options"];
    const initialData = { pages: [page(before)], pageParams: [1] };
    for (const key of [activeOptions.queryKey, inactiveKey, unrelatedKey]) {
      client.setQueryData(key, initialData);
    }
    state.get.mockResolvedValue(page(after));
    const observer = new InfiniteQueryObserver(client, { ...activeOptions, staleTime: Infinity });
    const stop = observer.subscribe(() => {});

    try {
      await hook().mutateAsync({ userId: "actor", roleId: "role", businessUnitId: depot.id });
      await vi.waitFor(() => {
        expect(observer.getCurrentResult().data?.pages[0].data).toEqual(after);
      });
      expect(state.get).toHaveBeenCalledTimes(1);
      expect(client.getQueryState(inactiveKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(unrelatedKey)?.isInvalidated).toBe(false);
    } finally {
      stop();
    }
  }
);
