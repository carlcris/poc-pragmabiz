import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BusinessUnitSwitcher } from "./BusinessUnitSwitcher";
const mocks = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  get: vi.fn(),
  error: null as Error | null,
  fetching: true,
  query: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/lib/api", () => ({ apiClient: { get: mocks.get } }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/hooks/useBusinessUnits", () => ({
  useBusinessUnits: () => {
    mocks.query();
    return {
      data: undefined,
      isLoading: mocks.fetching,
      isFetching: mocks.fetching,
      error: mocks.error,
      refetch: mocks.refetch,
    };
  },
  useSetBusinessUnitContext: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/stores/businessUnitStore", () => ({
  useBusinessUnitStore: () => ({
    currentBusinessUnit: { id: "unit", name: "Verified unit" },
    availableBusinessUnits: [],
    hasHydrated: true,
    isLoading: false,
    setAvailableBusinessUnits: vi.fn(),
  }),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => void | (() => void)) => {
    mocks.effects.push(effect);
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.effects = [];
  mocks.fetching = true;
  mocks.error = null;
});
it("uses only the shared query while options load", () => {
  expect(renderToStaticMarkup(<BusinessUnitSwitcher />)).toContain("Verified unit");
  mocks.effects.forEach((effect) => effect());
  expect(mocks.query).toHaveBeenCalledTimes(1);
  expect(mocks.get).not.toHaveBeenCalled();
});
it("keeps the selector interactive after query failure so Retry is reachable", () => {
  mocks.fetching = false;
  mocks.error = new Error("Internal server detail");
  const html = renderToStaticMarkup(<BusinessUnitSwitcher />);
  expect(html).toContain('role="combobox"');
  expect(html).not.toContain("Internal server detail");
  expect(mocks.get).not.toHaveBeenCalled();
});
