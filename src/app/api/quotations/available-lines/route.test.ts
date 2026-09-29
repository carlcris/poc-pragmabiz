import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), limits: [] as number[] }));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (fn: unknown) => fn,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/supabase/server-with-bu", () => ({
  createServerClientWithBU: async () => ({
    supabase: {
      from: mocks.from,
      rpc: mocks.rpc,
      auth: { getUser: async () => ({ data: { user: { id: "actor" } }, error: null }) },
    },
  }),
}));

beforeEach(() => {
  mocks.limits.length = 0;
  mocks.rpc.mockImplementation(async (name: string) => ({
    error: null,
    data:
      name === "get_available_sales_quotation_lines"
        ? [
            {
              quotation_id: "quote",
              quotation_code: "QT-3",
              quotation_item_id: "line",
              item_id: "item",
              quantity: 2,
              remaining_quantity: 1,
              ordered_quantity: 1,
              rate: 647.67,
              discount_percent: 0,
              tax_percent: 12,
              line_total: 1295.34,
              uom_id: "pcs",
            },
          ]
        : [],
  }));
  mocks.from.mockImplementation((table: string) => {
    const result = {
      error: null,
      data:
        table === "sales_quotation_items"
          ? [
              {
                id: "line",
                discount_amount: 200,
                tax_amount: 131.44,
                line_total: 1226.78,
              },
            ]
          : [],
    };
    const query = {
      select: () => query,
      in: () => query,
      is: () => query,
      order: () => query,
      limit: (limit: number) => {
        mocks.limits.push(limit);
        return query;
      },
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return query;
  });
});

describe("available quotation pricing", () => {
  it("returns stored fixed discounts and tax, with original quantity for partial-order pricing", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/quotations/available-lines?customerId=customer&limit=10"
      )
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data[0]).toMatchObject({
      quantity: 1,
      discountAmount: 200,
      taxAmount: 131.44,
      lineTotal: 1226.78,
      quotationPricing: {
        quantity: 2,
        discountAmount: 200,
        taxAmount: 131.44,
        lineTotal: 1226.78,
        sizes: [],
      },
    });
    expect(mocks.limits).toEqual([1]);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "get_available_sales_quotation_lines",
      expect.objectContaining({ p_limit: 10, p_offset: 0 })
    );
  });
});
