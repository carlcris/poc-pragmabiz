import { afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { usePostPutawayTask } from "./usePutawayTasks";
import { useDispatchDeliveryNote, useReceiveDeliveryNote } from "./useDeliveryNotes";
import { useExecuteTransformationOrder } from "./useTransformationOrders";
import { useUpdatePickListItems } from "./usePickLists";
import { useConfirmOrder } from "./useSalesOrders";
import { useConfirmGRN } from "./useGRNs";
import { useUpdateWarehouse } from "./useWarehouses";
const state = vi.hoisted(() => ({
  client: null as QueryClient | null,
  success: undefined as undefined | ((data: object, variables: { id: string }) => unknown),
}));
vi.mock("@tanstack/react-query", async (load) => ({
  ...(await load<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => state.client,
  useMutation: (options: { onSuccess: typeof state.success }) => {
    state.success = options.onSuccess;
    return {};
  },
}));
vi.mock("@/hooks/useRealtimeDomainInvalidation", () => ({
  useRealtimeDomainInvalidation: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/stores/businessUnitStore", () => ({ useBusinessUnitStore: () => "bu" }));
afterEach(() => state.client?.clear());
it.each([
  usePostPutawayTask,
  useDispatchDeliveryNote,
  useReceiveDeliveryNote,
  useExecuteTransformationOrder,
  useUpdatePickListItems,
  useConfirmOrder,
  useConfirmGRN,
  useUpdateWarehouse,
])("%s refreshes active expired batches and stales inactive report pages", async (useHook) => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  state.client = client;
  const active = ["expired-batches-report", "bu", { groupBy: "item", page: 1 }];
  const inactive = ["expired-batches-report", "bu", { groupBy: "batch", page: 2 }];
  const unrelated = ["unrelated-report"];
  for (const key of [active, inactive, unrelated]) client.setQueryData(key, "before");
  const fetch = vi.fn(async () => "after");
  const observer = new QueryObserver(client, { queryKey: active, queryFn: fetch });
  const stop = observer.subscribe(() => {});
  useHook();
  state.success!({}, { id: "id" });
  await vi.waitFor(() => expect(client.getQueryData(active)).toBe("after"));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(client.getQueryState(inactive)?.isInvalidated).toBe(true);
  expect(client.getQueryState(unrelated)?.isInvalidated).toBe(false);
  stop();
});
