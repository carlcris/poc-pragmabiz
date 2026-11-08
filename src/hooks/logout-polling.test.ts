import { beforeEach, expect, it, vi } from "vitest";
import * as purchasing from "./usePurchasingDashboard";
import { useDashboardWidgets } from "./useAnalytics";
import { useVanSalesStats } from "./useVanWarehouse";

const mocks = vi.hoisted(() => ({
  loggingOut: false,
  options: {} as { enabled?: boolean | ((query: unknown) => boolean) },
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: typeof mocks.options) => {
    mocks.options = options;
    return options;
  },
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
  keepPreviousData: vi.fn(),
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (select: (state: { isLoggingOut: boolean }) => unknown) =>
    select({ isLoggingOut: mocks.loggingOut }),
}));
vi.mock("@/stores/businessUnitStore", () => ({
  useBusinessUnitStore: (select: (state: { currentBusinessUnit: null }) => unknown) =>
    select({ currentBusinessUnit: null }),
}));
vi.mock("@/lib/api", () => ({ apiClient: { get: vi.fn() } }));

beforeEach(() => {
  mocks.loggingOut = false;
});

it.each(Object.entries(purchasing))("pauses %s even when callers enable it", (_name, hook) => {
  mocks.loggingOut = true;
  hook(undefined, { enabled: true });
  expect(mocks.options.enabled).toBe(false);
});

it("preserves caller enabled callbacks outside logout", () => {
  const enabled = vi.fn(() => false);
  purchasing.usePurchasingDashboard(undefined, { enabled });
  expect(mocks.options.enabled).toBe(enabled);
});

it.each([useDashboardWidgets, useVanSalesStats])("pauses %s polling during logout", (hook) => {
  hook();
  expect(mocks.options.enabled).toBe(true);
  mocks.loggingOut = true;
  hook();
  expect(mocks.options.enabled).toBe(false);
});
