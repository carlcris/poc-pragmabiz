import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import {
  GRNS_QUERY_KEY,
  LOAD_LISTS_QUERY_KEY,
  PURCHASE_ON_ORDER_QUERY_KEY,
  STOCK_REQUISITIONS_QUERY_KEY,
} from "./queryKeys";
import { useConfirmGRN } from "./useGRNs";
import { useLinkSRsToLoadList, useRemoveLoadListSRLink } from "./useLoadLists";
import { useUpdateStockRequisitionStatus } from "./useStockRequisitions";

const state = vi.hoisted(() => ({
  client: null as QueryClient | null,
  onSuccess: undefined as ((result: unknown, variables: unknown) => Promise<unknown>) | undefined,
}));

vi.mock("@tanstack/react-query", async (load) => ({
  ...(await load<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => state.client,
  useMutation: (options: { onSuccess: typeof state.onSuccess }) => {
    state.onSuccess = options.onSuccess;
    return {};
  },
}));

vi.mock("@/hooks/useRealtimeDomainInvalidation", () => ({
  useRealtimeDomainInvalidation: vi.fn(),
}));

beforeEach(() => {
  state.onSuccess = undefined;
});

const loadListId = "load-list";
const linkedLoadList = [LOAD_LISTS_QUERY_KEY, loadListId];
const savedLinks = [LOAD_LISTS_QUERY_KEY, loadListId, "sr-links"];
const otherLoadList = [LOAD_LISTS_QUERY_KEY, "other-list"];
const eligiblePack = [
  LOAD_LISTS_QUERY_KEY,
  loadListId,
  "eligible-requisition-items",
  {
    loadListItemId: "box-144-shipment",
    page: 2,
  },
];
const eligibleBrowse = [
  LOAD_LISTS_QUERY_KEY,
  "other-list",
  "eligible-requisition-items",
  { page: 1 },
];
const waitingConfirmation = [GRNS_QUERY_KEY, { status: "pending_approval" }];
const pendingApprovals = ["purchasing-dashboard", "pendingApprovals"];

it.each([
  {
    label: "adding links",
    hook: useLinkSRsToLoadList,
    variables: { id: loadListId, data: { links: [] } },
    affected: [linkedLoadList, savedLinks],
    unaffected: [otherLoadList, waitingConfirmation, pendingApprovals],
  },
  {
    label: "removing a link",
    hook: useRemoveLoadListSRLink,
    variables: { id: loadListId, linkId: "link" },
    affected: [linkedLoadList, savedLinks],
    unaffected: [otherLoadList, waitingConfirmation, pendingApprovals],
  },
  {
    label: "confirming receipt",
    hook: useConfirmGRN,
    variables: { id: "grn" },
    affected: [linkedLoadList, savedLinks, otherLoadList, waitingConfirmation, pendingApprovals],
    unaffected: [],
  },
  {
    label: "sending a requisition",
    hook: useUpdateStockRequisitionStatus,
    variables: { id: "requisition", status: "submitted" },
    affected: [],
    unaffected: [linkedLoadList, savedLinks, otherLoadList, waitingConfirmation, pendingApprovals],
  },
])(
  "$label refreshes active fulfillment views and marks inactive affected queries stale",
  async ({ hook, variables, affected, unaffected }) => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    state.client = client;
    const onOrder = [PURCHASE_ON_ORDER_QUERY_KEY, "source-unit", { supplierId: "supplier" }];
    const requisition = [STOCK_REQUISITIONS_QUERY_KEY, "requisition"];
    const inactiveAffected = [
      ...affected,
      eligiblePack,
      eligibleBrowse,
      [STOCK_REQUISITIONS_QUERY_KEY, { status: "submitted" }],
      ["purchasing-dashboard", "outstandingRequisitions"],
      ["purchasing-dashboard", "activeRequisitions"],
      ["purchasing-dashboard", "incomingDeliveriesWithSRs"],
      ["purchasing-dashboard", { widgets: ["activeRequisitions", "warehouseCapacity"] }],
    ];
    const unrelated = [
      ...unaffected,
      ["purchasing-dashboard", "warehouseCapacity"],
      ["purchasing-dashboard", { widgets: ["warehouseCapacity"] }],
      ["purchasing-dashboard", "capabilities"],
      ["user-profile", "user"],
    ];
    for (const key of [onOrder, requisition, ...inactiveAffected, ...unrelated]) {
      client.setQueryData(key, "before");
    }
    const fetchOnOrder = vi.fn(async () => "after");
    const fetchRequisition = vi.fn(async () => "after");
    const stopOnOrder = new QueryObserver(client, {
      queryKey: onOrder,
      queryFn: fetchOnOrder,
    }).subscribe(() => {});
    const stopRequisition = new QueryObserver(client, {
      queryKey: requisition,
      queryFn: fetchRequisition,
    }).subscribe(() => {});

    try {
      hook();
      await state.onSuccess?.({}, variables);

      expect(client.getQueryData(onOrder)).toBe("after");
      expect(client.getQueryData(requisition)).toBe("after");
      expect(fetchOnOrder).toHaveBeenCalledTimes(1);
      expect(fetchRequisition).toHaveBeenCalledTimes(1);
      for (const key of inactiveAffected) {
        expect(client.getQueryState(key)?.isInvalidated, JSON.stringify(key)).toBe(true);
      }
      for (const key of unrelated) {
        expect(client.getQueryState(key)?.isInvalidated, JSON.stringify(key)).toBe(false);
      }
    } finally {
      stopOnOrder();
      stopRequisition();
      client.clear();
    }
  }
);
