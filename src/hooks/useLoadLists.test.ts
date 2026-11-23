import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import {
  ITEMS_QUERY_KEY,
  LOAD_LISTS_QUERY_KEY,
  STOCK_IN_TRANSIT_QUERY_KEY,
  WAREHOUSE_DASHBOARD_QUERY_KEY,
} from "./queryKeys";
import { useUpdateLoadListTransitDetails } from "./useLoadLists";
import type { UpdateLoadListTransitDetailsRequest } from "@/types/load-list";

const state = vi.hoisted(() => ({
  queryClient: null as QueryClient | null,
  onSuccess: undefined as
    | ((
        result: unknown,
        variables: { id: string; data: UpdateLoadListTransitDetailsRequest }
      ) => Promise<void>)
    | undefined,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => state.queryClient,
  useMutation: ({ onSuccess }: { onSuccess: typeof state.onSuccess }) => {
    state.onSuccess = onSuccess;
    return {};
  },
}));

vi.mock("@/hooks/useRealtimeDomainInvalidation", () => ({
  useRealtimeDomainInvalidation: vi.fn(),
}));

it.each([
  { changes: { linerName: "New Liner" }, changesEta: false },
  { changes: { estimatedArrivalDate: null }, changesEta: true },
])(
  "refreshes affected cached views after updating transit details ($changes)",
  async ({ changes, changesEta }) => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    state.queryClient = client;
    const id = "edited-load-list";
    const detail = [LOAD_LISTS_QUERY_KEY, id];
    const arrivals = [STOCK_IN_TRANSIT_QUERY_KEY, "company", "arrivals", "item", 25];
    const inactiveAffected = [
      [LOAD_LISTS_QUERY_KEY, { status: "in_transit" }],
      ["shipments-report", { shipmentStage: "in_transit" }],
    ];
    const etaViews = [
      [STOCK_IN_TRANSIT_QUERY_KEY, "company", "items", undefined, 25],
      [WAREHOUSE_DASHBOARD_QUERY_KEY, "destination-unit"],
      [WAREHOUSE_DASHBOARD_QUERY_KEY, "operations-overview", "destination-unit", 14],
      ["purchasing-dashboard", "expectedArrivalsThisWeek", { businessUnitId: "destination-unit" }],
      ["purchasing-dashboard", "delayedShipments"],
      ["purchasing-dashboard", "incomingDeliveriesWithSRs"],
      ["purchasing-dashboard", "activeContainers"],
      ["purchasing-dashboard", undefined],
    ];
    const unaffected = [
      [ITEMS_QUERY_KEY, { page: 1 }],
      [LOAD_LISTS_QUERY_KEY, "other-load-list"],
      [LOAD_LISTS_QUERY_KEY, id, "sr-links"],
      ["purchasing-dashboard", "activeRequisitions"],
    ];
    for (const key of [detail, arrivals, ...inactiveAffected, ...etaViews, ...unaffected]) {
      client.setQueryData(key, "before");
    }
    const fetchDetail = vi.fn(async () => "after");
    const fetchArrivals = vi.fn(async () => "after");
    const stopDetail = new QueryObserver(client, {
      queryKey: detail,
      queryFn: fetchDetail,
    }).subscribe(() => {});
    const stopArrivals = new QueryObserver(client, {
      queryKey: arrivals,
      queryFn: fetchArrivals,
    }).subscribe(() => {});

    try {
      useUpdateLoadListTransitDetails();
      await state.onSuccess?.({}, { id, data: changes });

      expect(client.getQueryData(detail)).toBe("after");
      expect(client.getQueryData(arrivals)).toBe("after");
      expect(fetchDetail).toHaveBeenCalledTimes(1);
      expect(fetchArrivals).toHaveBeenCalledTimes(1);
      for (const key of inactiveAffected)
        expect(client.getQueryState(key)?.isInvalidated).toBe(true);
      for (const key of etaViews) expect(client.getQueryState(key)?.isInvalidated).toBe(changesEta);
      for (const key of unaffected) expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    } finally {
      stopDetail();
      stopArrivals();
      client.clear();
    }
  }
);
