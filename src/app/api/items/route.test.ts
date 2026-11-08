import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  capabilities: vi.fn(),
  allowed: false,
}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: vi.fn() }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: mocks.context }));
vi.mock("@/services/permissions/permissionResolver", () => ({
  getUserCapabilities: mocks.capabilities,
  hasCapability: () => mocks.allowed,
}));
const row = {
  id: "item",
  item_code: "ITEM",
  supplier_code: null,
  item_name: "Item",
  item_name_cn: null,
  category_name: "Category",
  on_hand: 8,
  allocated: 2,
  available: 6,
  putaway_qty: 1,
  reorder_point: 3,
  status: "normal",
  total_count: 81,
  purchase_price: 99,
  custom_fields: { large: "unused" },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.allowed = false;
  mocks.context.mockResolvedValue({
    supabase: { rpc: mocks.rpc, from: mocks.from },
    companyId: "company",
    currentBusinessUnitId: "unit",
    userId: "user",
  });
  mocks.capabilities.mockResolvedValue({});
  mocks.rpc.mockResolvedValue({ data: [row], error: null });
  mocks.from.mockImplementation(() => {
    throw new Error("Unexpected enrichment read");
  });
});
it("returns bounded stock rows without pricing, barcode, or capability reads", async () => {
  const response = await GET(
    new NextRequest("http://localhost/api/items?view=inventory&page=2&limit=10")
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.data[0]).toMatchObject({
    id: "item",
    onHand: 8,
    allocated: 2,
    available: 6,
    putawayQty: 1,
  });
  expect(body.data[0]).not.toHaveProperty("purchasePrice");
  expect(body.data[0]).not.toHaveProperty("customFields");
  expect(body.pagination).toEqual({ page: 2, limit: 10, total: 81, totalPages: 9 });
  expect(mocks.rpc).toHaveBeenCalledWith(
    "get_items_enhanced_page",
    expect.objectContaining({ p_business_unit_id: "unit", p_page: 2, p_limit: 10 })
  );
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.capabilities).not.toHaveBeenCalled();
});
it.each([false, true])(
  "stats skips settings and redacts total value when allowed=%s",
  async (allowed) => {
    mocks.allowed = allowed;
    mocks.rpc.mockResolvedValue({
      data: [
        { total_available_value: 123, low_stock_count: 2, out_of_stock_count: 1, total_count: 81 },
      ],
      error: null,
    });
    const response = await GET(
      new NextRequest("http://localhost/api/items?statsOnly=true&includeStats=true")
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.statistics.totalAvailableValue).toBe(allowed ? 123 : null);
    expect(body.capabilities.canViewTotalAvailableValue).toBe(allowed);
    expect(mocks.from).not.toHaveBeenCalled();
  }
);
it.each(["includeStock=false", "includeStats=true", "statsOnly=true", "exportMode=csv"])(
  "rejects mixed inventory contract %s",
  async (param) => {
    expect(
      (await GET(new NextRequest(`http://localhost/api/items?view=inventory&${param}`))).status
    ).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  }
);
it("preserves authentication failure", async () => {
  mocks.context.mockResolvedValue(new Response(null, { status: 401 }));
  expect((await GET(new NextRequest("http://localhost/api/items?view=inventory"))).status).toBe(
    401
  );
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it.each(["", "&exportMode=csv"])(
  "keeps pricing enrichment for the full contract %s",
  async (suffix) => {
    mocks.rpc.mockResolvedValue({ data: [{ ...row, sales_price: 10 }], error: null });
    mocks.from.mockImplementation((table: string) => {
      let setting = "";
      const builder = {
        select: () => builder,
        eq: (column: string, value: string) => {
          if (column === "setting_key") setting = value;
          return builder;
        },
        in: () => builder,
        is: () => builder,
        lte: () => builder,
        or: () => builder,
        order: () => builder,
        maybeSingle: async () => ({
          data: { value: setting === "timezone" ? "Asia/Manila" : "standard" },
          error: null,
        }),
        then: (resolve: (result: unknown) => unknown) =>
          Promise.resolve({
            data:
              table === "item_prices"
                ? [
                    {
                      id: "price",
                      item_id: "item",
                      price_tier: "standard",
                      price_tier_name: "Standard",
                      price: 25,
                      currency_code: "PHP",
                      effective_from: "2026-01-01",
                      effective_to: null,
                      is_active: true,
                    },
                  ]
                : [],
            error: null,
          }).then(resolve),
      };
      return builder;
    });
    const response = await GET(
      new NextRequest(`http://localhost/api/items?includeStock=true${suffix}`)
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data[0]).toMatchObject({
      purchasePrice: 99,
      listPrice: 25,
      customFields: { large: "unused" },
    });
    expect(body.data[0].priceTiers).toHaveLength(1);
    expect(mocks.from).toHaveBeenCalledWith("item_unit_options");
  }
);
