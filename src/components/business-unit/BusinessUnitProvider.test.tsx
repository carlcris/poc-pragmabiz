import { beforeEach, expect, it, vi } from "vitest";
import { BusinessUnitProvider } from "./BusinessUnitProvider";

const mocks = vi.hoisted(() => ({
  setContext: vi.fn(),
  checkAuth: vi.fn(),
  setLoading: vi.fn(),
  setAvailableBusinessUnits: vi.fn(),
  listLoading: false,
  authenticated: true,
  authLoading: false,
  loggingOut: false,
  userId: "user",
  refs: [] as Array<{ current: unknown }>,
  refIndex: 0,
  setCurrentBusinessUnit: vi.fn(),
  currentBusinessUnit: { id: "old" },
  units: [
    { id: "default", access: { is_default: true } },
    { id: "selected", access: { is_default: false } },
    { id: "old", access: { is_default: false } },
  ],
}));
vi.mock("react", () => ({
  useEffect: (effect: () => void) => effect(),
  useRef: (value: unknown) => {
    const index = mocks.refIndex++;
    mocks.refs[index] ??= { current: value };
    return mocks.refs[index];
  },
}));
vi.mock("@/hooks/useBusinessUnits", () => ({
  useBusinessUnits: () => ({
    data: mocks.listLoading ? undefined : mocks.units,
    isLoading: mocks.listLoading,
  }),
  useSetBusinessUnitContext: () => ({ mutate: mocks.setContext }),
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (select: (state: unknown) => unknown) =>
    select({
      user: { id: mocks.userId },
      isAuthenticated: mocks.authenticated,
      isLoggingOut: mocks.loggingOut,
      isLoading: mocks.authLoading,
      checkAuth: mocks.checkAuth,
    }),
}));
vi.mock("@/stores/businessUnitStore", () => ({
  useBusinessUnitStore: () => ({
    currentBusinessUnit: mocks.currentBusinessUnit,
    setCurrentBusinessUnit: mocks.setCurrentBusinessUnit,
    setAvailableBusinessUnits: mocks.setAvailableBusinessUnits,
    setLoading: mocks.setLoading,
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.listLoading = false;
  mocks.authenticated = true;
  mocks.authLoading = false;
  mocks.loggingOut = false;
  mocks.userId = "user";
  mocks.refs = [];
  mocks.refIndex = 0;
});

it("uses the server selection over stale browser state without rotating an unchanged session", () => {
  BusinessUnitProvider({
    children: null,
    initialBusinessUnitId: "selected",
    sessionBusinessUnitId: "selected",
  });
  expect(mocks.setCurrentBusinessUnit).toHaveBeenCalledWith(mocks.units[1]);
  expect(mocks.setContext).not.toHaveBeenCalled();
});
it("refreshes context when the JWT lacks the DB-resolved business unit", () => {
  BusinessUnitProvider({
    children: null,
    initialBusinessUnitId: "selected",
    sessionBusinessUnitId: null,
  });
  expect(mocks.setContext).toHaveBeenCalledExactlyOnceWith("selected");
});
it("selects the default when the server selection is no longer accessible", () => {
  BusinessUnitProvider({
    children: null,
    initialBusinessUnitId: "removed",
    sessionBusinessUnitId: "removed",
  });
  expect(mocks.setContext).toHaveBeenCalledExactlyOnceWith("default");
});
it("preserves tablet initialization without a server snapshot", () => {
  BusinessUnitProvider({ children: null });
  expect(mocks.setContext).toHaveBeenCalledExactlyOnceWith("old");
});

const selectedUnit = {
  id: "selected",
  company_id: "company",
  code: "MAIN",
  name: "Main",
  type: "primary" as const,
  is_active: true,
  created_at: "",
  created_by: null,
  updated_at: "",
  updated_by: null,
  access: { role: "staff" as const, is_default: false },
};
const serverSnapshot = {
  children: null,
  initialUserId: "user",
  initialBusinessUnit: selectedUnit,
  initialBusinessUnitId: "selected",
  sessionBusinessUnitId: "selected",
};
it("starts page data from a verified active snapshot while the BU list is still loading", () => {
  mocks.listLoading = true;
  BusinessUnitProvider(serverSnapshot);
  expect(mocks.setCurrentBusinessUnit).toHaveBeenCalledWith(selectedUnit);
  expect(mocks.setLoading).toHaveBeenCalledWith(false);
  expect(mocks.checkAuth).not.toHaveBeenCalled();
  expect(mocks.setContext).not.toHaveBeenCalled();
});
it("does not reselect the initial unit when the background list arrives", () => {
  mocks.listLoading = true;
  BusinessUnitProvider(serverSnapshot);
  mocks.refIndex = 0;
  mocks.listLoading = false;
  BusinessUnitProvider(serverSnapshot);
  expect(mocks.setCurrentBusinessUnit).toHaveBeenCalledTimes(1);
  expect(mocks.setAvailableBusinessUnits).toHaveBeenCalledWith(mocks.units);
  expect(mocks.setContext).not.toHaveBeenCalled();
});
it("waits for server auth hydration without starting a duplicate browser auth check", () => {
  mocks.authenticated = false;
  mocks.authLoading = true;
  mocks.listLoading = true;
  BusinessUnitProvider(serverSnapshot);
  expect(mocks.checkAuth).not.toHaveBeenCalled();
  expect(mocks.setLoading).toHaveBeenCalledWith(true);
  expect(mocks.setCurrentBusinessUnit).not.toHaveBeenCalled();
});
it("still checks authentication for tablet without a server snapshot", () => {
  mocks.authenticated = false;
  mocks.authLoading = true;
  BusinessUnitProvider({ children: null });
  expect(mocks.checkAuth).toHaveBeenCalledTimes(1);
});
it.each([
  { sessionBusinessUnitId: null },
  { sessionBusinessUnitId: "other" },
  { initialBusinessUnit: { ...selectedUnit, is_active: false } },
  { initialUserId: "other-user" },
])("does not unblock queries from an unverified snapshot: %j", (overrides) => {
  mocks.listLoading = true;
  BusinessUnitProvider({ ...serverSnapshot, ...overrides });
  expect(mocks.setLoading).toHaveBeenCalledWith(true);
  expect(mocks.setContext).not.toHaveBeenCalled();
});
it("continues missing-JWT recovery after the list arrives", () => {
  BusinessUnitProvider({ ...serverSnapshot, sessionBusinessUnitId: null });
  expect(mocks.setContext).toHaveBeenCalledExactlyOnceWith("selected");
});
it("does not restore a context during sign-out", () => {
  mocks.loggingOut = true;
  mocks.listLoading = true;
  BusinessUnitProvider(serverSnapshot);
  expect(mocks.setCurrentBusinessUnit).not.toHaveBeenCalled();
  expect(mocks.checkAuth).not.toHaveBeenCalled();
  expect(mocks.setContext).not.toHaveBeenCalled();
});
