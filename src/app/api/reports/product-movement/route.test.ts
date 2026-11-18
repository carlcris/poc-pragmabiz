import { NextRequest, NextResponse } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const state = vi.hoisted(() => ({
  permission: vi.fn(),
  context: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requirePermission: state.permission }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: state.context }));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));

const itemId = "5c9fe57e-ecad-461a-8f29-b719596ca84d";
const categoryId = "7a2b5efe-363f-463b-81da-e65329971153";
const request = (params: Record<string, string> = {}) =>
  GET(
    new NextRequest("http://localhost/api/reports/product-movement?" + new URLSearchParams(params))
  );

beforeEach(() => {
  vi.resetAllMocks();
  state.permission.mockResolvedValue(null);
  state.context.mockResolvedValue({
    companyId: "company",
    currentBusinessUnitId: "business-unit",
    supabase: { rpc: state.rpc },
  });
  state.rpc.mockResolvedValue({ data: [], error: null });
});

it.each(["fast", "slow"])(
  "passes the exact item and existing scope to %s movement",
  async (type) => {
    state.rpc.mockResolvedValue({
      data: [{ item_id: itemId, item_code: "GLS", item_name: "Glass", total_count: 1 }],
      error: null,
    });

    const response = await request({
      itemId,
      categoryId,
      movementType: type,
      search: " glass ",
      dateFrom: "2026-11-01",
      dateTo: "2026-11-18",
      limit: "999",
    });

    expect(response.status).toBe(200);
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith("get_product_movement_report", {
      p_company_id: "company",
      p_business_unit_id: "business-unit",
      p_movement_type: type,
      p_date_from: "2026-11-01",
      p_date_to: "2026-11-18",
      p_category_id: categoryId,
      p_search: "glass",
      p_page: 1,
      p_limit: 50,
      p_item_id: itemId,
    });
    expect(await response.json()).toMatchObject({
      data: [{ itemId, itemCode: "GLS", itemName: "Glass" }],
      filters: {
        itemId,
        movementType: type,
        categoryId,
        search: "glass",
        currentBusinessUnitId: "business-unit",
      },
      pagination: { page: 1, total: 1, limit: 50 },
    });
  }
);

it("omits the RPC item argument when All Items is selected", async () => {
  const response = await request({ search: "glass" });

  expect(response.status).toBe(200);
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith("get_product_movement_report", {
    p_company_id: "company",
    p_business_unit_id: "business-unit",
    p_movement_type: "fast",
    p_date_from: null,
    p_date_to: null,
    p_category_id: null,
    p_search: "glass",
    p_page: 1,
    p_limit: 25,
  });
  expect(await response.json()).toMatchObject({ filters: { itemId: null, search: "glass" } });
});

it.each(["bad", ""])(
  "rejects an invalid item ID (%s) before calling the report RPC",
  async (id) => {
    const response = await request({ itemId: id });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid product movement item filter" });
    expect(state.rpc).not.toHaveBeenCalled();
  }
);

it("requires Reports view permission before reading report scope", async () => {
  state.permission.mockResolvedValue(NextResponse.json({}, { status: 403 }));

  expect((await request({ itemId: "bad" })).status).toBe(403);
  expect(state.permission).toHaveBeenCalledExactlyOnceWith("reports", "view");
  expect(state.context).not.toHaveBeenCalled();
  expect(state.rpc).not.toHaveBeenCalled();
});
