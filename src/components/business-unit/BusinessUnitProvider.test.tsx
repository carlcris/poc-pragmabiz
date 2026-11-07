import { beforeEach, expect, it, vi } from "vitest";
import { BusinessUnitProvider } from "./BusinessUnitProvider";

const mocks = vi.hoisted(() => ({
  setContext: vi.fn(),
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
  useRef: (value: unknown) => ({ current: value }),
}));
vi.mock("@/hooks/useBusinessUnits", () => ({
  useBusinessUnits: () => ({ data: mocks.units, isLoading: false }),
  useSetBusinessUnitContext: () => ({ mutate: mocks.setContext }),
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (select: (state: unknown) => unknown) =>
    select({ isAuthenticated: true, isLoggingOut: false, isLoading: false }),
}));
vi.mock("@/stores/businessUnitStore", () => ({
  useBusinessUnitStore: () => ({
    currentBusinessUnit: mocks.currentBusinessUnit,
    setCurrentBusinessUnit: mocks.setCurrentBusinessUnit,
    setAvailableBusinessUnits: vi.fn(),
    setLoading: vi.fn(),
  }),
}));
beforeEach(() => vi.clearAllMocks());

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
