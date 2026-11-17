import { NextRequest, NextResponse } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { DELETE, PUT } from "./route";

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  permission: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  single: vi.fn(),
}));

vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));
vi.mock("@/lib/auth/checkPermission", () => ({ checkPermissionForUser: mocks.permission }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: mocks.context }));

const itemId = "10000000-0000-4000-8000-000000000001";
const unitOptionId = "10000000-0000-4000-8000-000000000002";
const uomId = "10000000-0000-4000-8000-000000000003";
const context = {
  userId: "user",
  companyId: "company",
  currentBusinessUnitId: "business-unit",
  supabase: { from: mocks.from, rpc: mocks.rpc },
};

const request = (method: "PUT" | "DELETE", body = JSON.stringify({ qtyPerUnit: 25 })) =>
  (method === "PUT" ? PUT : DELETE)(
    new NextRequest(`http://localhost/api/items/${itemId}/unit-options/${unitOptionId}`, {
      method,
      body: method === "PUT" ? body : undefined,
    }),
    { params: Promise.resolve({ id: itemId, unitOptionId }) }
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue(context);
  mocks.permission.mockResolvedValue(false);
  mocks.rpc.mockReturnValue({ single: mocks.single });
});

it.each(["PUT", "DELETE"] as const)("requires Items edit permission for %s", async (method) => {
  const response = await request(method);
  expect(response.status).toBe(403);
  expect(mocks.permission).toHaveBeenCalledExactlyOnceWith(
    { id: "user", companyId: "company", businessUnitId: "business-unit" },
    "items",
    "edit"
  );
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it.each(["PUT", "DELETE"] as const)("preserves unauthenticated %s rejection", async (method) => {
  mocks.context.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  expect((await request(method)).status).toBe(401);
  expect(mocks.permission).not.toHaveBeenCalled();
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("delegates a combined unit edit and default replacement to one scoped RPC", async () => {
  mocks.permission.mockResolvedValue(true);
  mocks.single.mockResolvedValue({
    data: {
      id: unitOptionId,
      item_id: itemId,
      uom_id: uomId,
      option_label: null,
      qty_per_unit: 25,
      barcode: "1234567890",
      is_base: false,
      is_default: true,
      is_active: true,
      sort_order: 2,
      uom_code: "BOX",
      uom_name: "Box",
      uom_symbol: "bx",
      base_uom_code: "PC",
    },
    error: null,
  });

  const response = await request(
    "PUT",
    JSON.stringify({ qtyPerUnit: 25, optionLabel: "  ", isDefault: true })
  );

  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("update_item_unit_option", {
    p_company_id: "company",
    p_item_id: itemId,
    p_unit_option_id: unitOptionId,
    p_business_unit_id: "business-unit",
    p_qty_per_unit: 25,
    p_option_label: "",
    p_is_default: true,
  });
  expect(mocks.from).not.toHaveBeenCalled();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    data: {
      id: unitOptionId,
      itemId,
      uomId,
      uomCode: "BOX",
      uomName: "Box",
      uomSymbol: "bx",
      displayLabel: "BOX (25 PC)",
      qtyPerUnit: 25,
      barcode: "1234567890",
      isBase: false,
      isDefault: true,
      isActive: true,
      sortOrder: 2,
    },
  });
});

it("returns forbidden when the database rejects a stale business unit claim without direct writes", async () => {
  mocks.context.mockResolvedValue({ ...context, currentBusinessUnitId: "stale-business-unit" });
  mocks.permission.mockResolvedValue(true);
  mocks.single.mockResolvedValue({
    data: null,
    error: { code: "42501", message: "ITEM_UNIT_OPTION_UPDATE_FORBIDDEN" },
  });

  const response = await request("PUT", JSON.stringify({ qtyPerUnit: 25, isDefault: true }));

  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("update_item_unit_option", {
    p_company_id: "company",
    p_item_id: itemId,
    p_unit_option_id: unitOptionId,
    p_business_unit_id: "stale-business-unit",
    p_qty_per_unit: 25,
    p_is_default: true,
  });
  expect(mocks.from).not.toHaveBeenCalled();
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: "Forbidden" });
});

it("rejects fields outside the update contract before calling the RPC", async () => {
  mocks.permission.mockResolvedValue(true);
  const response = await request("PUT", JSON.stringify({ qtyPerUnit: 25, itemId: "another-item" }));

  expect(response.status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
