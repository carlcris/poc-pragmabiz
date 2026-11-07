import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
const state = vi.hoisted(() => ({ rpc: vi.fn(), permission: vi.fn(), anyPermission: vi.fn() }));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));
vi.mock("@/lib/auth", () => ({
  requirePermission: state.permission,
  requireAnyPermission: state.anyPermission,
}));
vi.mock("@/lib/auth/requestContext", () => ({
  requireRequestContext: async () => ({
    companyId: "company",
    currentBusinessUnitId: "bu",
    supabase: { rpc: state.rpc },
  }),
}));
const warehouse = "10000000-0000-4000-8000-000000000001";
const item = "10000000-0000-4000-8000-000000000002";
const request = (query = "") =>
  GET(new NextRequest(`http://localhost/api/warehouses/${warehouse}/location-tree?${query}`), {
    params: Promise.resolve({ id: warehouse }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  state.permission.mockResolvedValue(null);
  state.anyPermission.mockResolvedValue(null);
  state.rpc.mockResolvedValue({ data: { data: [], pagination: { total: 0 } }, error: null });
});
it("uses caller scope and bounded pages for a full warehouse hierarchy", async () => {
  expect((await request("page=2&limit=500")).status).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith(
    "get_warehouse_location_tree_page",
    expect.objectContaining({
      p_company_id: "company",
      p_business_unit_id: "bu",
      p_warehouse_id: warehouse,
      p_page: 2,
      p_limit: 500,
    })
  );
  expect(state.permission).toHaveBeenCalled();
  expect(state.anyPermission).not.toHaveBeenCalled();
});
it("uses the existing item-stock permission branch when an item is specified", async () => {
  expect((await request(`itemId=${item}`)).status).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith(
    "get_warehouse_location_tree_page",
    expect.objectContaining({ p_item_id: item })
  );
  expect(state.anyPermission).toHaveBeenCalled();
  expect(state.permission).not.toHaveBeenCalled();
});
it.each(["page=0", "limit=501", "itemId=invalid", "page=1.5"])(
  "rejects invalid bounds %s",
  async (query) => {
    expect((await request(query)).status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  }
);
it("enforces permission denial before loading", async () => {
  state.permission.mockResolvedValue(new Response(null, { status: 403 }));
  expect((await request()).status).toBe(403);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("returns safe errors", async () => {
  state.rpc.mockResolvedValue({ data: null, error: { message: "private internal details" } });
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const response = await request();
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Failed to load locations" });
  log.mockRestore();
});
