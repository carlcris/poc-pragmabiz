import { expect, it, vi } from "vitest";
import { useLookupWarehouseLocations } from "./useLookups";
import { apiClient } from "@/lib/api";
const state = vi.hoisted(() => ({
  query: undefined as undefined | { queryKey: unknown[]; queryFn: () => unknown },
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: NonNullable<typeof state.query>) => {
    state.query = options;
    return {};
  },
}));
vi.mock("@/lib/api", () => ({ apiClient: { get: vi.fn() } }));
vi.mock("@/stores/authStore", () => ({ useAuthStore: vi.fn() }));
vi.mock("@/stores/businessUnitStore", () => ({ useBusinessUnitStore: vi.fn() }));
it("uses distinct cache entries for pages and forwards the page and search to the server", () => {
  useLookupWarehouseLocations("warehouse", { search: "Bin 10", page: 1 });
  const firstKey = state.query?.queryKey;
  useLookupWarehouseLocations("warehouse", { search: "Bin 10", page: 2 });
  expect(state.query?.queryKey).not.toEqual(firstKey);
  state.query?.queryFn();
  expect(apiClient.get).toHaveBeenLastCalledWith("/api/lookups/warehouses/warehouse/locations", {
    params: expect.objectContaining({ page: 2, limit: 5, search: "Bin 10" }),
  });
});
