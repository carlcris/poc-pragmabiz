import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import ItemsPage from "./page";
const mocks = vi.hoisted(() => ({
  fetching: false,
  allowed: true,
  effects: [] as Array<() => void | (() => void)>,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => void | (() => void)) => {
    mocks.effects.push(effect);
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/hooks/useCurrency", () => ({
  useCurrency: () => ({ formatCurrency: (value: number) => `PHP ${value}` }),
}));
vi.mock("@/stores/businessUnitStore", () => ({
  useBusinessUnitStore: (select: (state: unknown) => unknown) =>
    select({ currentBusinessUnit: { id: "unit" }, hasHydrated: true, isLoading: false }),
}));
vi.mock("@/hooks/useInventoryItems", () => ({
  useInventoryItems: () => ({
    data: {
      data: [
        {
          id: "item",
          code: "ITEM123",
          name: "Existing inventory row",
          category: "Category",
          onHand: 8,
          allocated: 2,
          available: 6,
          putawayQty: 1,
          reorderPoint: 3,
          status: "normal",
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    },
    isLoading: false,
    isFetching: mocks.fetching,
  }),
}));
vi.mock("@/hooks/useItems", () => ({
  useDeleteItem: () => ({}),
  useItemsStats: () => ({
    data: {
      statistics: {
        totalAvailableValue: mocks.allowed ? 123 : null,
        lowStockCount: 0,
        outOfStockCount: 0,
        totalCount: 1,
      },
      capabilities: { canViewTotalAvailableValue: mocks.allowed },
    },
    isLoading: false,
  }),
}));
vi.mock("@/components/permissions/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/permissions/PermissionGuard", () => ({
  EditGuard: () => null,
  DeleteGuard: () => null,
}));
vi.mock("@/components/warehouses/WarehouseSelect", () => ({ WarehouseSelect: () => null }));
vi.mock("@/components/items/ItemCategorySelect", () => ({ ItemCategorySelect: () => null }));
vi.mock("@/components/items/ItemImage", () => ({ ItemImage: () => null }));
beforeEach(() => {
  mocks.effects = [];
  mocks.fetching = false;
  mocks.allowed = true;
});
it("keeps existing rows visible during background refresh", () => {
  mocks.fetching = true;
  const html = renderToStaticMarkup(<ItemsPage />);
  expect(html).toContain("Existing inventory row");
  expect(html).toContain("refreshing");
  expect(html).not.toContain("animate-pulse");
});
it.each([true, false])("uses the statistics response capability: %s", (allowed) => {
  mocks.allowed = allowed;
  const html = renderToStaticMarkup(<ItemsPage />);
  expect(html.includes("totalAvailableValue")).toBe(allowed);
  expect(html.includes("PHP 123")).toBe(allowed);
});

it("does not schedule an initial search reset that can undo quick pagination", () => {
  const setTimeout = vi.fn();
  vi.stubGlobal("window", { setTimeout });
  try {
    renderToStaticMarkup(<ItemsPage />);
    mocks.effects[0]();
    expect(setTimeout).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
