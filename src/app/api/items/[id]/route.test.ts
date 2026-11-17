import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
  setActivityContext: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requirePermission: async () => null }));
vi.mock("@/lib/supabase/server-with-bu", () => ({
  createServerClientWithBU: async () => ({
    currentBusinessUnitId: "business-unit",
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "user" } } }) },
      from: mocks.from,
    },
  }),
}));
vi.mock("@/services/permissions/permissionResolver", () => ({
  getUserCapabilities: async () => ({}),
  hasCapability: () => false,
}));

const itemId = "10000000-0000-4000-8000-000000000001";
const companyId = "company";
const box = {
  id: "box",
  item_id: itemId,
  uom_id: "box-uom",
  option_label: "BOX(144)",
  qty_per_unit: 144,
  is_base: false,
  is_default: false,
  is_active: true,
  sort_order: 0,
  barcode: "123",
  units_of_measure: { code: "BOX", id: "box-uom", name: "Box", symbol: null },
};

const tableQuery = (data: unknown, error: unknown = null) => {
  const query = Object.assign(Promise.resolve({ data, error }), {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    lte: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    update: vi.fn(),
  });
  for (const method of [
    "select",
    "eq",
    "is",
    "lte",
    "or",
    "order",
    "maybeSingle",
    "single",
    "update",
  ] as const) {
    query[method].mockReturnValue(query);
  }
  return query;
};

const mockDetailQueries = (unitOptions: ReturnType<typeof tableQuery>) => {
  const tables = {
    items: tableQuery({
      id: itemId,
      company_id: companyId,
      item_name: "Test item",
      item_code: "TEST",
      unit_of_measure: { code: "PCS" },
      purchase_price: 25,
      sales_price: 50,
    }),
    item_unit_options: unitOptions,
    settings: tableQuery(null),
    item_prices: tableQuery([]),
    item_warehouse: tableQuery([
      { current_stock: 1000, reserved_stock: 200, available_stock: 800 },
    ]),
  };
  mocks.from.mockImplementation((table: keyof typeof tables) => tables[table]);
  return tables.items;
};

const request = () =>
  GET(new NextRequest(`http://localhost/api/items/${itemId}`), {
    params: Promise.resolve({ id: itemId }),
  });

beforeEach(() => vi.clearAllMocks());

it.each([true, false])("returns the inventory unit only when nominated (%s)", async (nominated) => {
  const unitOptions = tableQuery([{ ...box, is_inventory_preview: nominated }]);
  mockDetailQueries(unitOptions);

  const response = await request();

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    data: {
      inventoryPreviewUnit: nominated ? { displayLabel: "BOX(144)", qtyPerUnit: 144 } : null,
      onHand: 1000,
      allocated: 200,
      available: 800,
      purchasePrice: null,
      listPrice: null,
      unitOptions: [{ id: "box", displayLabel: "BOX(144)", qtyPerUnit: 144 }],
    },
  });
  expect(mocks.from.mock.calls.filter(([table]) => table === "item_unit_options")).toHaveLength(1);
  expect(unitOptions.select).toHaveBeenCalledWith(expect.stringContaining("is_inventory_preview"));
  expect(unitOptions.eq).toHaveBeenCalledWith("company_id", companyId);
  expect(unitOptions.eq).toHaveBeenCalledWith("item_id", itemId);
  expect(unitOptions.is).toHaveBeenCalledWith("deleted_at", null);
});

it("preserves the nomination in the item update response", async () => {
  const items = mockDetailQueries(tableQuery([{ ...box, is_inventory_preview: true }]));
  const response = await PUT(
    new NextRequest(`http://localhost/api/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify({ name: "Renamed item" }),
    }),
    { params: Promise.resolve({ id: itemId }) }
  );

  expect(response.status).toBe(200);
  expect(items.update).toHaveBeenCalledExactlyOnceWith({
    item_name: "Renamed item",
    updated_by: "user",
  });
  expect(await response.json()).toMatchObject({
    data: { inventoryPreviewUnit: { displayLabel: "BOX(144)", qtyPerUnit: 144 } },
  });
});

it("logs a failed unit option read without returning database details", async () => {
  const error = { code: "42703", message: "database implementation details" };
  mockDetailQueries(tableQuery(null, error));
  const logError = vi.spyOn(console, "error").mockImplementation(() => {});

  try {
    const response = await request();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
    expect(logError).toHaveBeenCalledWith("Failed to load item unit options", {
      companyId,
      itemId,
      error,
    });
  } finally {
    logError.mockRestore();
  }
});
