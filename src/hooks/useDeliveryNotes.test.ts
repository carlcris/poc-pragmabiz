import { QueryClient, QueryObserver, type MutationObserverOptions } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DeliveryNote } from "@/types/delivery-note";
import { useVoidDeliveryNote } from "./useDeliveryNotes";

type VoidInput = { id: string; reason?: string };

const state = vi.hoisted(() => ({
  client: null as QueryClient | null,
  voidNote: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (load) => {
  const reactQuery = await load<typeof import("@tanstack/react-query")>();
  return {
    ...reactQuery,
    useQueryClient: () => state.client,
    useMutation: (options: MutationObserverOptions<DeliveryNote, Error, VoidInput>) => {
      const observer = new reactQuery.MutationObserver(state.client!, options);
      return { mutateAsync: (input: VoidInput) => observer.mutate(input) };
    },
  };
});
vi.mock("@/lib/api/delivery-notes", () => ({ deliveryNotesApi: { void: state.voidNote } }));
vi.mock("@/hooks/useInventoryRealtimeInvalidation", () => ({
  useInventoryRealtimeInvalidation: vi.fn(),
}));

beforeEach(() => {
  state.client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  state.voidNote.mockReset();
});
afterEach(() => state.client?.clear());

it("refreshes reserved and available stock after voiding a delivery note", async () => {
  const client = state.client!;
  const before = { qtyOnHand: 10, qtyReserved: 4, qtyAvailable: 6 };
  const after = { qtyOnHand: 10, qtyReserved: 0, qtyAvailable: 10 };
  const active = [
    ["item-locations", "item-a", "bu", "warehouses", 1],
    ["item-locations", "item-a", "bu", "tree", "planned-warehouse", "root", 1],
    ["item-locations", "item-a", "bu", "node", "actual-warehouse", "actual-bin"],
    ["item-locations", "item-a", "bu", "actual-bin", 1],
    ["warehouse-locations", "actual-warehouse", "detail", "parent-rack"],
  ];
  const inactive = [
    ["item-locations", "item-b", "bu", "node", "planned-warehouse", "planned-bin"],
    ["item-locations", "item-a", "bu", "search", "rack", 2],
    ["items", "item-a"],
    ["items", "inventory", "bu", {}],
    ["lookups", "stock-request-batches", "bu", "item-b", "", 1],
    ["inventory-reservations", "bu"],
    ["delivery-notes", "note"],
    ["pick-lists", "linked-list"],
    ["stock-requests", "linked-request"],
    ["warehouse-dashboard", "operations-overview", "bu"],
    ["item-location-batch-report", {}],
    [
      "stock-adjustment-batch-locations",
      "item-a",
      "actual-warehouse",
      "actual-bin",
      "",
      "existing",
    ],
  ];
  const unrelated = [
    ["item-locations", "other-item", "bu", "node", "actual-warehouse", "actual-bin"],
    ["items", "item-a", "packages"],
    ["items", "inventory", "other-bu", {}],
    ["items", { includeStock: false }],
    ["lookups", "stock-request-batches", "bu", "other-item", "", 1],
    ["warehouse-locations", "actual-warehouse", "copy-preview", "rack"],
    ["warehouse-locations", "actual-warehouse", "children", "root", 1],
    ["suppliers"],
  ];
  for (const key of [...active, ...inactive, ...unrelated]) client.setQueryData(key, before);
  const observations = active.map((queryKey) => {
    const queryFn = vi.fn().mockResolvedValue(after);
    const observer = new QueryObserver(client, { queryKey, queryFn });
    return { observer, queryFn, stop: observer.subscribe(() => {}) };
  });
  state.voidNote.mockResolvedValue({
    id: "note",
    status: "voided",
    fulfilling_business_unit_id: "bu",
    delivery_note_items: [{ item_id: "item-a" }, { item_id: "item-b" }],
  });

  try {
    await useVoidDeliveryNote().mutateAsync({ id: "note", reason: "Cancelled" });
    expect(state.voidNote).toHaveBeenCalledExactlyOnceWith("note", "Cancelled");
    for (const { observer, queryFn } of observations) {
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(observer.getCurrentResult().data).toEqual(after);
    }
    for (const key of inactive) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of unrelated) expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  } finally {
    for (const { stop } of observations) stop();
  }
});

it("keeps location caches fresh when the void is rejected", async () => {
  const client = state.client!;
  const key = ["item-locations", "item-a", "bu", "warehouses", 1];
  client.setQueryData(key, { qtyReserved: 4 });
  state.voidNote.mockRejectedValue(new Error("The delivery note could not be voided"));

  await expect(useVoidDeliveryNote().mutateAsync({ id: "note" })).rejects.toThrow(
    "The delivery note could not be voided"
  );
  expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  expect(client.getQueryData(key)).toEqual({ qtyReserved: 4 });
});
