import { NextRequest, NextResponse } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { PUT } from "./route";

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  permission: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));
vi.mock("@/lib/auth/checkPermission", () => ({ checkPermissionForUser: mocks.permission }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: mocks.context }));

const itemId = "10000000-0000-4000-8000-000000000001";
const optionId = "10000000-0000-4000-8000-000000000002";
const context = {
  userId: "user",
  companyId: "company",
  currentBusinessUnitId: "business-unit",
  supabase: { rpc: mocks.rpc },
};

const request = (body: string, unitOptionId = optionId) =>
  PUT(
    new NextRequest(
      `http://localhost/api/items/${itemId}/unit-options/${unitOptionId}/inventory-preview`,
      { method: "PUT", body }
    ),
    { params: Promise.resolve({ id: itemId, unitOptionId }) }
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue(context);
  mocks.permission.mockResolvedValue(true);
  mocks.rpc.mockResolvedValue({ error: null });
});

it.each([true, false])("saves enabled=%s with one scoped RPC", async (enabled) => {
  const response = await request(JSON.stringify({ enabled }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true });
  expect(mocks.permission).toHaveBeenCalledExactlyOnceWith(
    { id: "user", companyId: "company", businessUnitId: "business-unit" },
    "items",
    "edit"
  );
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("set_item_inventory_preview_unit", {
    p_company_id: "company",
    p_item_id: itemId,
    p_unit_option_id: optionId,
    p_enabled: enabled,
    p_business_unit_id: "business-unit",
  });
});

it.each([
  ["{malformed", optionId],
  ['{"enabled":"true"}', optionId],
  ['{"enabled":true,"companyId":"wrong-company"}', optionId],
  ['{"enabled":true}', "not-a-uuid"],
])("rejects invalid input (%s, %s)", async (body, target) => {
  const response = await request(body, target);
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ code: "INVENTORY_PREVIEW_INVALID_REQUEST" });
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("returns 401 before checking permissions when no user is signed in", async () => {
  mocks.context.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  expect((await request('{"enabled":true}')).status).toBe(401);
  expect(mocks.permission).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it.each(["missing scope", "missing edit permission"])(
  "rejects requests with %s",
  async (reason) => {
    if (reason === "missing scope") {
      mocks.context.mockResolvedValue({ ...context, currentBusinessUnitId: null });
    } else {
      mocks.permission.mockResolvedValue(false);
    }
    const response = await request('{"enabled":true}');
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "INVENTORY_PREVIEW_FORBIDDEN" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  }
);

it.each([
  ["42501", 403, "INVENTORY_PREVIEW_FORBIDDEN"],
  ["P0002", 404, "INVENTORY_PREVIEW_NOT_FOUND"],
  ["22023", 409, "INVENTORY_PREVIEW_INELIGIBLE"],
])(
  "maps database rejection %s without exposing internal details",
  async (sqlState, status, code) => {
    mocks.rpc.mockResolvedValue({ error: { code: sqlState, message: "internal error details" } });
    const response = await request('{"enabled":true}');
    expect(response.status).toBe(status);
    const payload = await response.json();
    expect(payload).toMatchObject({ code });
    expect(JSON.stringify(payload)).not.toContain("internal error details");
  }
);

it("logs an unknown database error and sends a generic retry message", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const error = { code: "XX000", message: "internal error details" };
  mocks.rpc.mockResolvedValue({ error });
  try {
    const response = await request('{"enabled":true}');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Could not save the inventory preview unit. Try again.",
    });
    expect(log).toHaveBeenCalledWith(expect.any(String), error);
  } finally {
    log.mockRestore();
  }
});
