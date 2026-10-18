import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "./route";
import type { StockMovePayload } from "@/lib/validations/stock-move";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  context: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
  setActivityContextIfAvailable: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requirePermission: mocks.permission }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: mocks.context }));

const warehouseId = "10000000-0000-4000-8000-000000000001";
const destinationWarehouseId = "10000000-0000-4000-8000-000000000002";
const businessUnitId = "10000000-0000-4000-8000-000000000003";
const payload: StockMovePayload = {
  transactionType: "transfer",
  warehouseId,
  toWarehouseId: destinationWarehouseId,
  fromLocationId: "10000000-0000-4000-8000-000000000004",
  toLocationId: "10000000-0000-4000-8000-000000000005",
  transactionDate: "2026-10-05",
  items: [{ itemId: "10000000-0000-4000-8000-000000000006", quantity: 3.25 }],
};
const request = (body: unknown) =>
  new NextRequest("http://localhost/api/stock-transactions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission.mockResolvedValue(null);
  mocks.context.mockResolvedValue({
    supabase: { rpc: mocks.rpc, from: mocks.from },
    companyId: "company",
    userId: "actor",
    currentBusinessUnitId: businessUnitId,
  });
  mocks.rpc.mockResolvedValue({
    data: { id: "move", transactionCode: "ST-000000001" },
    error: null,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("transactional Move Stock API", () => {
  it.each([destinationWarehouseId, warehouseId])(
    "moves to %s through exactly one transaction",
    async (toWarehouseId) => {
      const response = await POST(request({ ...payload, toWarehouseId }));
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ id: "move", transactionCode: "ST-000000001" });
      expect(mocks.permission).toHaveBeenCalledWith("stock_transactions", "create");
      expect(mocks.permission).toHaveBeenCalledWith("transfer_between_locations", "create");
      expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("move_stock_transactionally", {
        p_business_unit_id: businessUnitId,
        p_item_id: payload.items[0].itemId,
        p_source_warehouse_id: warehouseId,
        p_destination_warehouse_id: toWarehouseId,
        p_from_location_id: payload.fromLocationId,
        p_to_location_id: payload.toLocationId,
        p_quantity: 3.25,
        p_transaction_date: payload.transactionDate,
      });
      expect(mocks.from).not.toHaveBeenCalled();
    }
  );

  it.each([
    { ...payload, items: [{ ...payload.items[0], quantity: -1 }] },
    { ...payload, items: [{ ...payload.items[0], quantity: 0.001 }] },
    { ...payload, items: [{ ...payload.items[0], quantity: 1_000_000_001 }] },
    { ...payload, items: [payload.items[0], payload.items[0]] },
    { ...payload, items: [{ ...payload.items[0], unitCost: 5 }] },
    { ...payload, fromLocationId: payload.toLocationId },
    { ...payload, transactionDate: "2026-02-30" },
    { ...payload, toWarehouseId: "invalid" },
    { ...payload, businessUnitId: "forged" },
  ])("rejects invalid or identity-bearing payloads before writing: %j", async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "STOCK_MOVE_DETAILS_INVALID" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each(["stock_transactions", "transfer_between_locations"])(
    "enforces %s create access",
    async (resource) => {
      mocks.permission.mockImplementation(async (value: string) =>
        value === resource ? NextResponse.json({ error: "Forbidden" }, { status: 403 }) : null
      );
      const response = await POST(request(payload));
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "STOCK_MOVE_FORBIDDEN" });
      expect(mocks.rpc).not.toHaveBeenCalled();
    }
  );

  it("returns a stable authentication error", async () => {
    mocks.permission.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const response = await POST(request(payload));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "STOCK_MOVE_UNAUTHORIZED" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires a business unit before moving", async () => {
    mocks.context.mockResolvedValue({ currentBusinessUnitId: null });
    const response = await POST(request(payload));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "STOCK_MOVE_CONTEXT_INVALID" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["STOCK_MOVE_INSUFFICIENT_STOCK", 409],
    ["STOCK_MOVE_BATCH_CONFLICT", 409],
    ["STOCK_MOVE_WAREHOUSE_INVALID", 400],
  ])("maps %s to safe, actionable guidance", async (code, status) => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: code, details: "private database detail" },
    });
    const response = await POST(request(payload));
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body.code).toBe(code);
    expect(body.error).not.toContain("private");
    expect(body).not.toHaveProperty("details");
  });

  it("keeps unexpected backend failures private", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "secret constraint SQL failure" },
    });
    const response = await POST(request(payload));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: "STOCK_MOVE_FAILED",
      error: "Stock could not be moved. Refresh stock levels before trying again.",
    });
  });
});
