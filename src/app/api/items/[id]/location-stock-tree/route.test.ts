import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
const state = vi.hoisted(() => ({ rpc: vi.fn(), permission: vi.fn() }));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));
vi.mock("@/lib/auth", () => ({ requireAnyPermission: state.permission }));
vi.mock("@/lib/auth/requestContext", () => ({
  requireRequestContext: async () => ({
    companyId: "company",
    currentBusinessUnitId: "bu",
    supabase: { rpc: state.rpc },
  }),
}));
const item = "10000000-0000-4000-8000-000000000001";
const warehouse = "10000000-0000-4000-8000-000000000002";
const location = "10000000-0000-4000-8000-000000000003";
const request = (extra = "") =>
  GET(
    new NextRequest(
      `http://localhost/api/items/${item}/location-stock-tree?warehouseId=${warehouse}&locationId=${location}&limit=1${extra}`
    ),
    { params: Promise.resolve({ id: item }) }
  );
beforeEach(() => {
  vi.clearAllMocks();
  state.permission.mockResolvedValue(null);
  state.rpc.mockResolvedValue({
    data: {
      data: [
        { locationId: location, directOnHand: 2, subtreeOnHand: 12, hasStockedChildren: true },
      ],
    },
    error: null,
  });
});
it("forwards exact location and caller scope without reconstructing totals", async () => {
  const response = await request();
  expect(response.status).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith(
    "get_item_location_stock_tree",
    expect.objectContaining({
      p_company_id: "company",
      p_business_unit_id: "bu",
      p_item_id: item,
      p_warehouse_id: warehouse,
      p_location_id: location,
      p_limit: 1,
    })
  );
  expect(await response.json()).toMatchObject({
    data: [{ directOnHand: 2, subtreeOnHand: 12, hasStockedChildren: true }],
  });
});
it.each([`&parentId=${location}`, "&page=2"])(
  "rejects conflicting exact-selection parameters %s",
  async (extra) => {
    expect((await request(extra)).status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  }
);
it("does not fetch nodes when permission is denied", async () => {
  state.permission.mockResolvedValue(new Response(null, { status: 403 }));
  expect((await request()).status).toBe(403);
  expect(state.rpc).not.toHaveBeenCalled();
});
