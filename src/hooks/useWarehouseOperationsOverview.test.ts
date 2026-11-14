import { expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { getWarehouseOperationsOverviewQueryKey } from "./useWarehouseOperationsOverview";
import { usePostStockAdjustment } from "./useStockAdjustments";
import { useMoveStock } from "./useMoveStock";

const state = vi.hoisted(() => ({
  client: null as QueryClient | null,
  onSuccess: undefined as ((...args: unknown[]) => unknown) | undefined,
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => state.client,
  useMutation: (options: { onSuccess?: (...args: unknown[]) => unknown }) => {
    state.onSuccess = options.onSuccess;
    return {};
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/stores/authStore", () => ({ useAuthStore: vi.fn() }));
vi.mock("@/stores/businessUnitStore", () => ({ useBusinessUnitStore: vi.fn() }));

it.each([usePostStockAdjustment, useMoveStock])(
  "%s refreshes the open operations overview and stales other cached ranges",
  async (useHook) => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    state.client = client;
    const active = getWarehouseOperationsOverviewQueryKey("bu", 14, "Asia/Manila");
    const inactive = getWarehouseOperationsOverviewQueryKey("bu", 30, "Asia/Manila");
    const unrelated = ["unrelated-report"];
    for (const key of [active, inactive, unrelated]) client.setQueryData(key, "before");
    const fetch = vi.fn(async () => "after");
    const observer = new QueryObserver(client, { queryKey: active, queryFn: fetch });
    const stop = observer.subscribe(() => {});

    useHook();
    await state.onSuccess!(
      {},
      { itemId: "item", sourceLocationId: "a", destinationLocationId: "b" }
    );

    await vi.waitFor(() => expect(client.getQueryData(active)).toBe("after"));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(inactive)?.isInvalidated).toBe(true);
    expect(client.getQueryState(unrelated)?.isInvalidated).toBe(false);
    stop();
    client.clear();
  }
);
