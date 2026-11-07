import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { useLoadPermissions } from "./usePermissions";
import type { UserPermissions } from "@/types/rbac";

const mocks = vi.hoisted(() => ({
  options: {} as Record<string, unknown>,
  units: [] as { id: string }[],
  currentId: "stale-browser-unit",
  userId: "user",
  get: vi.fn(),
}));
vi.mock("react", () => ({ useEffect: vi.fn() }));
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<typeof import("@tanstack/react-query")>()),
  useQuery: (options: Record<string, unknown>) => {
    mocks.options = options;
    return {};
  },
}));
vi.mock("@/lib/api", () => ({ apiClient: { get: mocks.get } }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (select: (state: unknown) => unknown) =>
    select({ user: { id: mocks.userId }, isAuthenticated: true, isLoggingOut: false }),
}));
vi.mock("@/stores/businessUnitStore", () => ({
  useBusinessUnitStore: (select: (state: unknown) => unknown) =>
    select({
      currentBusinessUnit: { id: mocks.currentId },
      availableBusinessUnits: mocks.units,
      isLoading: false,
    }),
}));
vi.mock("@/stores/permissionStore", () => ({ usePermissionStore: () => ({}) }));
const permissions = {} as UserPermissions;
const snapshot = { userId: "user", businessUnitId: "selected", permissions };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.units = [];
  mocks.userId = "user";
  mocks.currentId = "stale-browser-unit";
});

it("seeds the exact server scope and avoids an immediate permission request", async () => {
  useLoadPermissions(snapshot);
  expect(mocks.options.queryKey).toEqual(["permissions", "user", "selected"]);
  const client = new QueryClient();
  const observer = new QueryObserver(client, {
    queryKey: mocks.options.queryKey as string[],
    queryFn: mocks.get,
    initialData: mocks.options.initialData,
    staleTime: 60_000,
  });
  const unsubscribe = observer.subscribe(() => {});
  expect(observer.getCurrentResult().data).toBe(permissions);
  expect(mocks.get).not.toHaveBeenCalled();
  unsubscribe();
  client.clear();
});
it("does not reuse initial permissions after switching business units", () => {
  mocks.units = [{ id: "other" }];
  mocks.currentId = "other";
  useLoadPermissions(snapshot);
  expect(mocks.options.queryKey).toEqual(["permissions", "user", "other"]);
  expect(mocks.options.initialData).toBeUndefined();
});
it("does not seed another user's cache", () => {
  mocks.userId = "another-user";
  useLoadPermissions(snapshot);
  expect(mocks.options.initialData).toBeUndefined();
});

it("does not resurrect the initial snapshot after a later cache reset", () => {
  mocks.units = [{ id: "selected" }];
  mocks.currentId = "selected";
  useLoadPermissions(snapshot);
  expect(mocks.options.initialData).toBeUndefined();
});
it("supports consumers without a server snapshot", () => {
  useLoadPermissions();
  expect(mocks.options.initialData).toBeUndefined();
});
