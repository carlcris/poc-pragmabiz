import { beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver, type QueryObserverOptions } from "@tanstack/react-query";
import {
  getWarehouseOperationsOverviewQueryKey,
  useWarehouseOperationsOverview,
} from "./useWarehouseOperationsOverview";
import { usePostStockAdjustment } from "./useStockAdjustments";
import { useMoveStock } from "./useMoveStock";
import { useStartGRNReceiving, useSubmitGRN } from "./useGRNs";
import { useDeleteLoadList, useUpdateLoadListStatus } from "./useLoadLists";
import { useCreatePickList } from "./usePickLists";
import {
  ITEMS_QUERY_KEY,
  PUTAWAY_TASKS_QUERY_KEY,
  STOCK_IN_TRANSIT_QUERY_KEY,
  STOCK_MOVEMENT_REPORT_QUERY_KEY,
  STOCK_TRANSACTIONS_QUERY_KEY,
} from "./queryKeys";
import type { WarehouseOperationsOverview } from "@/types/warehouse-operations-overview";

const state = vi.hoisted(() => ({
  client: null as QueryClient | null,
  onSuccess: undefined as ((...args: unknown[]) => unknown) | undefined,
  overviewOptions: undefined as QueryObserverOptions<WarehouseOperationsOverview> | undefined,
  unit: { currentBusinessUnit: { id: "unit-a" }, isLoading: false, isSwitching: false },
  auth: { isAuthenticated: true, isLoggingOut: false, user: { id: "user" } },
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: (options: QueryObserverOptions<WarehouseOperationsOverview>) => {
    state.overviewOptions = options;
  },
  useQueryClient: () => state.client,
  useMutation: (options: { onSuccess?: (...args: unknown[]) => unknown }) => {
    state.onSuccess = options.onSuccess;
    return {};
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useRealtimeDomainInvalidation", () => ({
  useRealtimeDomainInvalidation: vi.fn(),
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (value: typeof state.auth) => unknown) => selector(state.auth),
}));
vi.mock("@/stores/businessUnitStore", () => ({
  useBusinessUnitStore: (selector: (value: typeof state.unit) => unknown) => selector(state.unit),
}));

beforeEach(() => {
  state.unit = { currentBusinessUnit: { id: "unit-a" }, isLoading: false, isSwitching: false };
});

it("refreshes the active item summary and stales item arrivals after a load-list status change", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  state.client = client;
  const itemSummary = [STOCK_IN_TRANSIT_QUERY_KEY, "company-a", "items", undefined, 25];
  const itemArrivals = [STOCK_IN_TRANSIT_QUERY_KEY, "company-a", "arrivals", "item-a", 25];
  const unrelated = [ITEMS_QUERY_KEY, { page: 1 }];
  for (const key of [itemSummary, itemArrivals, unrelated]) client.setQueryData(key, "before");
  const fetchSummary = vi.fn(async () => "after");
  const observer = new QueryObserver(client, { queryKey: itemSummary, queryFn: fetchSummary });
  const stop = observer.subscribe(() => {});

  try {
    useUpdateLoadListStatus();
    await state.onSuccess!({}, { id: "load-list" });
    await vi.waitFor(() => expect(client.getQueryData(itemSummary)).toBe("after"));
    expect(fetchSummary).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(itemArrivals)?.isInvalidated).toBe(true);
    expect(client.getQueryState(unrelated)?.isInvalidated).toBe(false);
  } finally {
    stop();
    client.clear();
  }
});

it.each([
  usePostStockAdjustment,
  useMoveStock,
  useUpdateLoadListStatus,
  useDeleteLoadList,
  useStartGRNReceiving,
  useSubmitGRN,
  useCreatePickList,
])("%s refreshes the open operations overview and stales other cached ranges", async (useHook) => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  state.client = client;
  const active = getWarehouseOperationsOverviewQueryKey("bu", 14, "Asia/Manila", "user");
  const inactive = getWarehouseOperationsOverviewQueryKey("bu", 30, "Asia/Manila", "user");
  const unrelated = ["unrelated-report"];
  for (const key of [active, inactive, unrelated]) client.setQueryData(key, "before");
  const fetch = vi.fn(async () => "after");
  const observer = new QueryObserver(client, { queryKey: active, queryFn: fetch });
  const stop = observer.subscribe(() => {});

  useHook();
  await state.onSuccess!(
    {},
    { id: "receipt", itemId: "item", sourceLocationId: "a", destinationLocationId: "b" }
  );

  await vi.waitFor(() => expect(client.getQueryData(active)).toBe("after"));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(client.getQueryState(inactive)?.isInvalidated).toBe(true);
  expect(client.getQueryState(unrelated)?.isInvalidated).toBe(false);
  stop();
  client.clear();
});

it.each([
  [PUTAWAY_TASKS_QUERY_KEY, [{ page: 1 }], [{ page: 2 }]],
  [STOCK_TRANSACTIONS_QUERY_KEY, ["unit-a", { page: 1 }], ["unit-a", { page: 2 }]],
  [STOCK_MOVEMENT_REPORT_QUERY_KEY, [{ itemId: "item" }], [{ itemId: "other-item" }]],
  [ITEMS_QUERY_KEY, [{ includeStock: true, page: 1 }], [{ includeStock: true, page: 2 }]],
] as const)("refreshes %s when a GRN is submitted", async (prefix, activeParts, inactiveParts) => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  state.client = client;
  const active = [prefix, ...activeParts];
  const inactive = [prefix, ...inactiveParts];
  const unrelated = [ITEMS_QUERY_KEY, { includeStock: false, page: 1 }];
  for (const key of [active, inactive, unrelated]) client.setQueryData(key, "before");
  const fetch = vi.fn(async () => "after");
  const observer = new QueryObserver(client, { queryKey: active, queryFn: fetch });
  const stop = observer.subscribe(() => {});

  try {
    useSubmitGRN();
    await state.onSuccess!();
    await vi.waitFor(() => expect(client.getQueryData(active)).toBe("after"));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(inactive)?.isInvalidated).toBe(true);
    expect(client.getQueryState(unrelated)?.isInvalidated).toBe(false);
  } finally {
    stop();
    client.clear();
  }
});

it("keeps the old range as placeholder within a BU and drops it after a BU switch", () => {
  const client = new QueryClient();
  const previous: WarehouseOperationsOverview = {
    asOf: "2026-11-15",
    days: 14,
    stockMovements: [{ date: "2026-11-15", in: 8, out: 3 }],
    stockHealth: null,
    inbound: null,
    openWorkAge: { pickLists: null, stockRequests: null, incoming: null },
    expiringBatches: null,
    slowMoving: null,
  };
  useWarehouseOperationsOverview(14);
  client.setQueryData(state.overviewOptions!.queryKey, previous);
  const observer = new QueryObserver(client, state.overviewOptions!);

  useWarehouseOperationsOverview(7);
  observer.setOptions(state.overviewOptions!);
  expect(observer.getCurrentResult()).toMatchObject({ data: previous, isPlaceholderData: true });

  state.unit.isSwitching = true;
  useWarehouseOperationsOverview(7);
  expect(state.overviewOptions!.enabled).toBe(false);
  observer.setOptions(state.overviewOptions!);

  client.clear();
  state.unit = { currentBusinessUnit: { id: "unit-b" }, isLoading: false, isSwitching: false };
  useWarehouseOperationsOverview(7);
  observer.setOptions(state.overviewOptions!);
  expect(observer.getCurrentResult()).toMatchObject({
    data: undefined,
    isPending: true,
    isPlaceholderData: false,
  });
  observer.destroy();
  client.clear();
});

it("waits for verified business-unit hydration before fetching after a reload", () => {
  state.unit.isLoading = true;
  useWarehouseOperationsOverview(14);
  expect(state.overviewOptions?.enabled).toBe(false);

  state.unit = { currentBusinessUnit: { id: "unit-b" }, isLoading: false, isSwitching: false };
  useWarehouseOperationsOverview(14);
  expect(state.overviewOptions?.enabled).toBe(true);
  expect(state.overviewOptions?.queryKey[2]).toBe("unit-b");
});
