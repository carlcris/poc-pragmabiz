import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { ItemLocationStockNode } from "@/types/inventory-location";
import { translations } from "@/lib/i18n/translations";
import { LocationsTab } from "./LocationsTab";

const state = vi.hoisted(() => ({
  values: [] as unknown[],
  index: 0,
  node: undefined as ItemLocationStockNode | undefined,
  select: undefined as undefined | ((node: ItemLocationStockNode) => void),
  searchClick: undefined as undefined | (() => void),
  nodeQuery: vi.fn(),
  mutationError: undefined as undefined | ((error: Error) => void),
  toastError: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: state.toastError } }));
vi.mock("react", async (load) => ({
  ...(await load<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = state.index++;
    if (!(index in state.values)) state.values[index] = initial;
    return [
      state.values[index],
      (next: unknown) => {
        state.values[index] = typeof next === "function" ? next(state.values[index]) : next;
      },
    ];
  },
}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace: keyof typeof translations.en) => (key: string) =>
    (translations.en[namespace] as Record<string, string>)[key] ?? key,
  useFormatter: () => ({ number: String, dateTime: () => "2026-01-01" }),
}));
vi.mock("@/stores/businessUnitStore", () => ({ useBusinessUnitStore: () => "bu" }));
vi.mock("@/hooks/usePermissions", () => ({ useCanCreate: () => true, useCanView: () => true }));
vi.mock("@/hooks/useGranularCapabilities", () => ({
  useGranularCapabilities: () => ({ data: {} }),
}));
vi.mock("@/hooks/useItems", () => ({
  useItem: () => ({ data: { data: { id: "item", uom: "pc", unitOptions: [] } } }),
}));
vi.mock("@/hooks/useDebouncedValue", () => ({ useDebouncedValue: (value: unknown) => value }));
vi.mock("@/hooks/useItemWarehouseStock", () => ({
  useItemWarehouseStock: () => ({
    data: {
      data: [
        {
          warehouseId: "wh",
          warehouseName: "Warehouse",
          warehouseCode: "WH",
          qtyOnHand: 12,
          qtyReserved: 0,
          qtyAvailable: 12,
          locationCount: 2,
        },
      ],
      pagination: { totalPages: 1 },
    },
  }),
}));
vi.mock("@/hooks/useItemLocationStockNode", () => ({
  useItemLocationStockNode: (...args: unknown[]) => {
    state.nodeQuery(...args);
    return { data: { data: state.node ? [state.node] : [] } };
  },
}));
vi.mock("@/hooks/useItemLocationStockTree", () => ({
  useItemLocationStockTree: () => ({
    data: {
      data: [{ locationId: "bin", name: "Child bin", code: "BIN", subtreeOnHand: 10 }],
      pagination: { total: 1 },
    },
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: (options: { onError?: (error: Error) => void }) => {
    if (!state.mutationError) state.mutationError = options.onError;
    return { isPending: false };
  },
  useQuery: () => ({
    data: {
      data: [
        {
          id: "rack",
          locationId: "rack",
          warehouseId: "wh",
          warehouseName: "Warehouse",
          locationName: "Rack",
          locationCode: "R",
          locationNamePath: "Rack",
          qtyOnHand: 2,
          qtyAvailable: 2,
          qtyReserved: 0,
          batchCount: 1,
        },
      ],
      pagination: { totalPages: 1 },
    },
  }),
}));
vi.mock("@/components/items/locations/ItemLocationStockTree", () => ({
  ItemLocationStockTree: ({ onSelect }: { onSelect: (node: ItemLocationStockNode) => void }) => {
    state.select = onSelect;
    return <p>Tree</p>;
  },
}));
vi.mock("@/components/items/locations/ItemLocationBatches", () => ({
  ItemLocationBatches: () => <p>Batches</p>,
}));
vi.mock("@/components/items/locations/ItemLocationMapDialog", () => ({
  ItemLocationMapDialog: () => null,
}));
vi.mock("@/components/items/locations/MoveStockDialog", () => ({ MoveStockDialog: () => null }));
vi.mock("@/components/warehouses/WarehouseLocationSelect", () => ({
  WarehouseLocationSelect: () => null,
}));

const node: ItemLocationStockNode = {
  locationId: "rack",
  warehouseId: "wh",
  code: "R",
  name: "Rack",
  locationType: "rack",
  isStorable: true,
  namePath: "Rack",
  isDefault: false,
  subtreeOnHand: 12,
  subtreeReserved: 0,
  subtreeAvailable: 12,
  directOnHand: 2,
  directReserved: 0,
  directAvailable: 2,
  directBatchCount: 1,
  hasStockedChildren: true,
};
function captureSearchAction(children: ReactNode): void {
  if (Array.isArray(children)) {
    children.forEach(captureSearchAction);
    return;
  }
  if (!isValidElement<{ onClick?: () => void; children?: ReactNode }>(children)) return;
  if (children.type === "button" && children.props.onClick)
    state.searchClick = children.props.onClick;
  captureSearchAction(children.props.children);
}
function Harness() {
  const element = LocationsTab({ itemId: "item" });
  captureSearchAction(element);
  return element;
}
const render = () => {
  state.index = 0;
  return renderToStaticMarkup(<Harness />);
};
beforeEach(() => {
  state.mutationError = undefined;
  state.toastError.mockClear();
  state.values = [];
  state.node = node;
  state.nodeQuery.mockClear();
  state.searchClick = undefined;
});
it("re-renders the selected panel from refreshed query quantities and removes an empty source action", () => {
  render();
  state.select!(node);
  expect(render()).toContain(translations.en.itemLocationsTab.moveFromHere);
  state.node = {
    ...node,
    subtreeOnHand: 0,
    subtreeAvailable: 0,
    directOnHand: 0,
    directAvailable: 0,
    hasStockedChildren: false,
  };
  const html = render();
  expect(html).not.toContain(translations.en.itemLocationsTab.moveFromHere);
  expect(html).not.toContain(translations.en.itemLocationsTab.includingSublocations);
  expect(state.nodeQuery).toHaveBeenLastCalledWith("item", "wh", "rack");
  expect(html.match(/<dd[^>]*>0<\/dd>/g)).toHaveLength(3);
});
it("opens a direct-stock search hit with authoritative subtree totals and Inside navigation", () => {
  state.values[2] = "Rack";
  render();
  expect(state.searchClick).toBeDefined();
  state.searchClick!();
  const html = render();
  expect(state.nodeQuery).toHaveBeenLastCalledWith("item", "wh", "rack");
  expect(html).toContain(translations.en.itemLocationsTab.includingSublocations);
  expect(html).toContain("Child bin");
  expect(html).toMatch(/<dd[^>]*>12<\/dd>/);
  expect(html).toMatch(/<dd[^>]*>2<\/dd>/);
});

it.each([true, false])("only offers Set as Preferred for storable nodes (%s)", (isStorable) => {
  state.node = { ...node, isStorable };
  render();
  state.select!(state.node);
  const html = render();
  expect(html.includes(translations.en.itemLocationsTab.setAsPreferred)).toBe(isStorable);
});
it("shows translated recovery guidance when the API rejects a stale preferred selection", () => {
  render();
  state.mutationError!(
    new Error("Safe API fallback", { cause: { code: "LOCATION_STORAGE_UNAVAILABLE" } })
  );
  expect(state.toastError).toHaveBeenCalledWith(
    translations.en.itemLocationsTab.preferredLocationUnavailable
  );
});
