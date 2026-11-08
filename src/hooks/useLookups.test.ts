import { beforeEach, expect, it, vi } from "vitest";
import { useLookupWarehouses } from "./useLookups";
const mocks = vi.hoisted(() => ({
  options: {} as { enabled: boolean; queryKey: unknown[] },
  authenticated: true,
  loggingOut: false,
  hydrated: true,
  loading: false,
  businessUnitId: "unit" as string | null,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: typeof mocks.options) => {
    mocks.options = options;
    return options;
  },
}));
vi.mock("@/lib/api", () => ({ apiClient: { get: vi.fn() } }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (select: (state: unknown) => unknown) =>
    select({ isAuthenticated: mocks.authenticated, isLoggingOut: mocks.loggingOut }),
}));
vi.mock("@/stores/businessUnitStore", () => ({
  useBusinessUnitStore: (select: (state: unknown) => unknown) =>
    select({
      currentBusinessUnit: mocks.businessUnitId ? { id: mocks.businessUnitId } : null,
      hasHydrated: mocks.hydrated,
      isLoading: mocks.loading,
    }),
}));
beforeEach(() => {
  mocks.authenticated = true;
  mocks.loggingOut = false;
  mocks.hydrated = true;
  mocks.loading = false;
  mocks.businessUnitId = "unit";
});
it.each(["auth", "logout", "hydration", "loading", "unit", "disabled"])(
  "does not fetch a premature scoped lookup: %s",
  (condition) => {
    if (condition === "auth") mocks.authenticated = false;
    if (condition === "logout") mocks.loggingOut = true;
    if (condition === "hydration") mocks.hydrated = false;
    if (condition === "loading") mocks.loading = true;
    if (condition === "unit") mocks.businessUnitId = null;
    useLookupWarehouses({ scope: "current_business_unit", enabled: condition !== "disabled" });
    expect(mocks.options.enabled).toBe(false);
  }
);
it("fetches once the verified business-unit key is ready", () => {
  useLookupWarehouses({ scope: "current_business_unit" });
  expect(mocks.options.enabled).toBe(true);
  expect(mocks.options.queryKey.at(-1)).toBe("unit");
});
it("preserves accessible-unit searches without requiring a current unit", () => {
  mocks.businessUnitId = null;
  mocks.loading = true;
  useLookupWarehouses({ scope: "accessible_business_units" });
  expect(mocks.options.enabled).toBe(true);
});
