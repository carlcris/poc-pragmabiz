import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import ItemsPage from "./page";
const mocks = vi.hoisted(() => ({
  fetching: false,
  allowed: true,
  isTableLayout: false as boolean | undefined,
  effects: [] as Array<() => void | (() => void)>,
  inventoryPreviewUnit: null as { displayLabel: string; qtyPerUnit: number } | null,
  quantities: { onHand: 8, allocated: 2, putawayQty: 1, available: 6 },
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => void | (() => void)) => {
    mocks.effects.push(effect);
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => mocks.isTableLayout }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en-US",
}));
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
          ...mocks.quantities,
          inventoryPreviewUnit: mocks.inventoryPreviewUnit,
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
  AnyPermissionGuard: () => null,
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
  mocks.isTableLayout = false;
  mocks.inventoryPreviewUnit = null;
  mocks.quantities = { onHand: 8, allocated: 2, putawayQty: 1, available: 6 };
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

it("renders stacked rows and a collapsed Filters panel on phones", () => {
  const html = renderToStaticMarkup(<ItemsPage />);
  expect(html).not.toContain("<table");
  expect(html).toContain('href="/inventory/items/item"');
  expect(html).toContain("putawayQty");
  expect(html).toContain('aria-controls="inventory-item-filters"');
  expect(html).toMatch(/id="inventory-item-filters" hidden=""/);
});

it("keeps the table and inline filters from md up", () => {
  mocks.isTableLayout = true;
  const html = renderToStaticMarkup(<ItemsPage />);
  expect(html).toContain("<table");
  expect(html).not.toContain('id="inventory-item-filters"');
  expect(html).toContain("md:min-h-96");
});

it.each([true, false])(
  "shows the nominated unit equivalent below base quantities without parentheses (table layout: %s)",
  (isTableLayout) => {
    mocks.isTableLayout = isTableLayout;
    mocks.inventoryPreviewUnit = { displayLabel: "BOX (50)", qtyPerUnit: 50 };
    mocks.quantities = { onHand: 1000, allocated: 200, putawayQty: 350, available: 800 };
    const html = renderToStaticMarkup(<ItemsPage />);
    const onHandPreview = html.match(
      /<(?:td|dd)[^>]*><span>1000<\/span><span class="([^"]+)">20 BOX \(50\)<\/span>/
    );
    expect(onHandPreview?.[1].split(" ")).toContain("block");
    expect(html).toContain("4 BOX (50)");
    expect(html).toContain("7 BOX (50)");
    expect(html).toContain("16 BOX (50)");
    // The wrapping parentheses are gone; the saved label keeps its own pack size.
    expect(html).not.toContain("(20 BOX (50))");
    expect(html).toContain("1000");
    expect(html).not.toContain("1,000");
    expect(html.match(/BOX \(50\)/g)).toHaveLength(4);
  }
);

it.each([true, false])(
  "shows only the base quantity for zero stock values (table layout: %s)",
  (isTableLayout) => {
    mocks.isTableLayout = isTableLayout;
    mocks.inventoryPreviewUnit = { displayLabel: "BOX (50)", qtyPerUnit: 50 };
    mocks.quantities = { onHand: 0, allocated: 0, putawayQty: 0, available: 0 };
    const html = renderToStaticMarkup(<ItemsPage />);
    const stockValues = isTableLayout
      ? html.match(/<tbody[^>]*>(.*?)<\/tbody>/)?.[1]
      : html.match(/<dl[^>]*>(.*?)<\/dl>/)?.[1];
    expect(stockValues?.match(/>0</g)).toHaveLength(4);
    expect(html).not.toContain("BOX (50)");
  }
);

it.each([true, false])(
  "shows only whole preview units and drops the fraction (table layout: %s)",
  (isTableLayout) => {
    mocks.isTableLayout = isTableLayout;
    mocks.inventoryPreviewUnit = { displayLabel: "BOX (50)", qtyPerUnit: 50 };
    // 3478 / 50 = 69.56 must read as 69 BOX (50), never 70 and never a fraction.
    mocks.quantities = { onHand: 3478, allocated: 3478, putawayQty: 3478, available: 3478 };
    const html = renderToStaticMarkup(<ItemsPage />);
    expect(html).toContain("69 BOX (50)");
    expect(html).not.toContain("69.56");
    expect(html).not.toContain("70 BOX (50)");
  }
);

it.each([true, false])(
  "shows zero whole units when stock is under one nominated unit (table layout: %s)",
  (isTableLayout) => {
    mocks.isTableLayout = isTableLayout;
    mocks.inventoryPreviewUnit = { displayLabel: "BOX (50)", qtyPerUnit: 50 };
    mocks.quantities = { onHand: 49, allocated: 0.5, putawayQty: 49, available: 49 };
    const html = renderToStaticMarkup(<ItemsPage />);
    expect(html.match(/0 BOX \(50\)/g)).toHaveLength(4);
    expect(html).not.toContain("0.98");
    expect(html).not.toContain("0.01");
    expect(html).not.toMatch(/>0\.5</);
  }
);

it.each([true, false])(
  "renders a label saved without a space before its pack size verbatim (table layout: %s)",
  (isTableLayout) => {
    mocks.isTableLayout = isTableLayout;
    mocks.inventoryPreviewUnit = { displayLabel: "BOX(144)", qtyPerUnit: 144 };
    mocks.quantities = { onHand: 800, allocated: 800, putawayQty: 800, available: 800 };
    const html = renderToStaticMarkup(<ItemsPage />);
    expect(html).toContain("5 BOX(144)");
    expect(html).not.toContain("(5 BOX(144))");
    expect(html).not.toContain("5.55");
  }
);

it.each([true, false])(
  "keeps whole-number base quantities when no unit is nominated (table layout: %s)",
  (isTableLayout) => {
    mocks.isTableLayout = isTableLayout;
    mocks.quantities = { onHand: 1000.75, allocated: 200, putawayQty: 350, available: 800 };
    const html = renderToStaticMarkup(<ItemsPage />);
    expect(html).toContain("1000");
    expect(html).not.toContain("1000.75");
    expect(html).not.toContain("1,000");
    expect(html).not.toContain("BOX");
  }
);

it("renders breakpoint-switched skeletons before the viewport is known", () => {
  mocks.isTableLayout = undefined;
  const html = renderToStaticMarkup(<ItemsPage />);
  expect(html).not.toContain("Existing inventory row");
  expect(html).not.toContain('id="inventory-item-filters"');
  expect(html).toContain('class="md:hidden"');
  expect(html).toContain("max-md:hidden");
  expect(html).toContain("<table");
});
