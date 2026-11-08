import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../warehouses/[id]/locations/route";
import { PATCH } from "./[id]/route";

const state = vi.hoisted(() => ({
  context: vi.fn(),
  permission: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  insert: vi.fn(),
  error: null as null | { code?: string; message: string },
}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: state.permission }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: state.context }));
const id = "00000000-0000-4000-8000-000000000001";
function query() {
  const builder = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    insert: (payload: unknown) => {
      state.insert(payload);
      return builder;
    },
    maybeSingle: async () => ({ data: { id, is_storable: true }, error: null }),
    single: async () => ({
      data: { id, code: "R01-B01", location_path: "R01 / R01-B01" },
      error: state.error,
    }),
  };
  return builder;
}
const request = (method: string, body: unknown) =>
  new NextRequest("http://localhost/api/locations", { method, body: JSON.stringify(body) });
const params = { params: Promise.resolve({ id }) };
beforeEach(() => {
  vi.clearAllMocks();
  state.error = null;
  state.permission.mockResolvedValue(null);
  state.from.mockImplementation(query);
  state.rpc.mockImplementation(query);
  state.context.mockResolvedValue({
    companyId: "company",
    userId: "user",
    currentBusinessUnitId: "bu",
    supabase: { from: state.from, rpc: state.rpc },
  });
});
it("creates without supplying a code and returns the database-generated code", async () => {
  const response = await POST(
    request("POST", { name: "Bin 1", locationType: "bin", parentId: id }),
    params
  );
  expect(response.status).toBe(201);
  expect(state.insert).toHaveBeenCalledWith(
    expect.objectContaining({ parent_id: id, location_type: "bin" })
  );
  expect(state.insert.mock.calls[0][0]).not.toHaveProperty("code");
  expect((await response.json()).data.code).toBe("R01-B01");
});
it.each(["POST", "PATCH"])("rejects user-supplied codes through %s", async (method) => {
  const handler = method === "POST" ? POST : PATCH;
  expect((await handler(request(method, { code: "CUSTOM", name: "Bin" }), params)).status).toBe(
    400
  );
  expect(state.insert).not.toHaveBeenCalled();
  expect(state.rpc).not.toHaveBeenCalled();
});
it("moves through one transactional RPC without sending code or ownership fields", async () => {
  const response = await PATCH(request("PATCH", { parentId: id }), params);
  expect(response.status).toBe(200);
  expect(state.rpc).toHaveBeenCalledTimes(1);
  expect(state.rpc).toHaveBeenCalledWith("update_warehouse_location", {
    p_business_unit_id: "bu",
    p_location_id: id,
    p_changes: expect.objectContaining({ parent_id: id }),
  });
  expect(state.rpc.mock.calls[0][1].p_changes).not.toHaveProperty("code");
  expect(state.rpc.mock.calls[0][1].p_changes).not.toHaveProperty("company_id");
});
it("maps overlong generated codes to a safe recoverable validation error", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  state.error = { message: "LOCATION_CODE_TOO_LONG" };
  const response = await POST(request("POST", { name: "Bin", locationType: "bin" }), params);
  expect(response.status).toBe(400);
  expect((await response.json()).code).toBe("LOCATION_CODE_TOO_LONG");
  log.mockRestore();
});
