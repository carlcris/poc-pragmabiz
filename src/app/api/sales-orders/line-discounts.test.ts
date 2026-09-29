import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as listOrders } from "./route";
import { GET as getOrder } from "./[id]/route";

const mocks = vi.hoisted(() => ({ from: vi.fn(), projections: [] as string[] }));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/supabase/server-with-bu", () => ({
  createServerClientWithBU: async () => ({
    supabase: {
      from: mocks.from,
      auth: { getUser: async () => ({ data: { user: { id: "actor" } }, error: null }) },
    },
  }),
}));
vi.mock("./frame-details", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./frame-details")>()),
  loadSalesOrderFrameDetails: async () => ({
    configurationsByItemId: new Map(),
    componentsByItemId: new Map(),
    matLayersByConfigurationId: new Map(),
    error: null,
  }),
}));

const order = {
  id: "order",
  order_code: "SO-1",
  status: "draft",
  discount_amount: "200.00",
  total_amount: "300.67",
};
const item = {
  id: "line",
  order_id: "order",
  item_id: "item",
  quantity: "1",
  rate: "500.67",
  discount_percent: "0",
  discount_amount: "200.00",
  tax_percent: "0",
  line_total: "300.67",
  source_pricing: {
    quantity: "1",
    discount_amount: "200.00",
    tax_amount: "0",
    line_total: "300.67",
  },
};

beforeEach(() => {
  mocks.projections.length = 0;
  mocks.from.mockImplementation((table: string) => {
    const result = {
      data: table === "sales_orders" ? [order] : table === "sales_order_items" ? [item] : [],
      count: 1,
      error: null,
    };
    const query = {
      select: (projection: string) => {
        if (table === "sales_order_items") mocks.projections.push(projection);
        return query;
      },
      eq: () => query,
      is: () => query,
      order: () => query,
      range: () => query,
      in: () => query,
      neq: () => query,
      single: async () => ({ data: order, error: null }),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return query;
  });
});

describe("sales-order fixed discount response contract", () => {
  it.each(["list", "detail"] as const)(
    "includes the stored amount in the %s response even when the percentage is zero",
    async (path) => {
      const request = new NextRequest("http://localhost/api/sales-orders");
      const response =
        path === "list"
          ? await listOrders(request)
          : await getOrder(request, { params: Promise.resolve({ id: "order" }) });
      expect(response.status).toBe(200);
      const body = await response.json();
      const savedOrder = path === "list" ? body.data[0] : body;
      expect(savedOrder.lineItems[0]).toMatchObject({
        discount: 0,
        discountAmount: 200,
        lineTotal: 300.67,
        quotationPricing: {
          quantity: 1,
          discountAmount: 200,
          taxAmount: 0,
          lineTotal: 300.67,
          sizes: [],
        },
      });
      expect(mocks.projections).toHaveLength(1);
      expect(mocks.projections[0].split(",").map((column) => column.trim())).toContain(
        "discount_amount"
      );
    }
  );
});
