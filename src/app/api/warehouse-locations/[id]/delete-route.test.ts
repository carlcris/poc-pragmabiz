import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { DELETE } from "./route";
const state = vi.hoisted(() => ({ permission: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: state.permission }));
vi.mock("@/lib/auth/requestContext", () => ({
  requireRequestContext: async () => ({
    currentBusinessUnitId: "bu",
    supabase: { rpc: state.rpc },
  }),
}));
const id = "10000000-0000-4000-8000-000000000001";
const request = (locationId = id) =>
  DELETE(
    new NextRequest(`http://localhost/api/warehouse-locations/${locationId}`, { method: "DELETE" }),
    { params: Promise.resolve({ id: locationId }) }
  );
beforeEach(() => {
  vi.clearAllMocks();
  state.permission.mockResolvedValue(null);
  state.rpc.mockResolvedValue({ error: null });
});
it("uses one scoped transactional delete", async () => {
  const response = await request();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true });
  expect(state.permission).toHaveBeenCalledWith("manage_locations", "delete");
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith("delete_warehouse_location", {
    p_business_unit_id: "bu",
    p_location_id: id,
  });
});
it("rejects permission failures before writing", async () => {
  state.permission.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  expect((await request()).status).toBe(403);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("rejects malformed IDs", async () => {
  expect((await request("bad")).status).toBe(400);
  expect(state.rpc).not.toHaveBeenCalled();
});
it.each([
  ["LOCATION_IN_USE", 409, "LOCATION_IN_USE"],
  ["LOCATION_IS_PREFERRED", 409, "LOCATION_IS_PREFERRED"],
  ["LOCATION_HAS_CHILDREN", 409, "LOCATION_HAS_CHILDREN"],
  ["WAREHOUSE_LOCATION_NOT_FOUND", 404, "WAREHOUSE_LOCATION_NOT_FOUND"],
  ["LOCATION_WAREHOUSE_INVALID", 404, "WAREHOUSE_LOCATION_NOT_FOUND"],
  ["LOCATION_DELETE_FORBIDDEN", 403, "LOCATION_DELETE_FORBIDDEN"],
  ["private internal SQL details", 500, "WAREHOUSE_LOCATION_DELETE_FAILED"],
])("maps %s safely", async (message, status, code) => {
  state.rpc.mockResolvedValue({ error: { message } });
  const response = await request();
  expect(response.status).toBe(status);
  const body = await response.json();
  expect(body.code).toBe(code);
  expect(body.error).not.toContain(message);
});
