import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { PUT } from "./[id]/route";
import type { CreateStockRequisitionRequest } from "@/types/stock-requisition";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  context: vi.fn(),
  capabilities: vi.fn(),
  resolveOptions: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: mocks.permission }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: mocks.context }));
vi.mock("@/lib/stock-requisitions/permissions", () => ({
  resolveStockRequisitionCapabilities: mocks.capabilities,
}));
vi.mock("./line-item-unit-options", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./line-item-unit-options")>()),
  resolveStockRequisitionLineUnitOptions: mocks.resolveOptions,
}));

const supplierId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const option50 = "33333333-3333-4333-8333-333333333333";
const option144 = "44444444-4444-4444-8444-444444444444";
const uomId = "55555555-5555-4555-8555-555555555555";
const requisitionId = "66666666-6666-4666-8666-666666666666";
const lines: CreateStockRequisitionRequest["items"] = [
  { itemId, itemUnitOptionId: option50, uomId, requestedQty: 50, unitPrice: 1.08 },
  { itemId, itemUnitOptionId: option144, uomId, requestedQty: 100, unitPrice: 1.08 },
];

const save = (method: "POST" | "PUT", body: unknown) => {
  const request = new NextRequest("http://localhost/api/stock-requisitions", {
    method,
    body: JSON.stringify(body),
  });
  return method === "POST"
    ? POST(request)
    : PUT(request, { params: Promise.resolve({ id: requisitionId }) });
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.permission.mockResolvedValue(null);
  mocks.context.mockResolvedValue({
    supabase: { rpc: mocks.rpc, from: mocks.from },
    companyId: "company",
    userId: "actor",
    currentBusinessUnitId: "business-unit",
  });
  mocks.capabilities.mockResolvedValue({ canViewUnitCost: true });
  mocks.resolveOptions.mockImplementation(
    (_: unknown, __: string, items: CreateStockRequisitionRequest["items"]) =>
      Promise.resolve(
        items.map((item) => ({
          ...item,
          item_unit_option_id: item.itemUnitOptionId,
          uom_id: uomId,
          qty_per_unit: item.itemUnitOptionId === option50 ? 50 : 144,
        }))
      )
  );
  mocks.rpc.mockResolvedValue({
    data: [{ id: requisitionId, sr_number: "SR-000000001", status: "draft" }],
    error: null,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("stock requisition atomic pack saves", () => {
  it.each(["POST", "PUT"] as const)(
    "%s retains the two selected packs in one transactional call",
    async (method) => {
      const response = await save(method, { supplierId, items: lines, currency: "PHP" });

      expect(response.status).toBe(method === "POST" ? 201 : 200);
      expect(await response.json()).toEqual({
        id: requisitionId,
        srNumber: "SR-000000001",
        status: "draft",
      });
      expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("save_stock_requisition", {
        p_company_id: "company",
        p_business_unit_id: "business-unit",
        p_user_id: "actor",
        ...(method === "PUT" ? { p_requisition_id: requisitionId } : {}),
        p_header: { supplier_id: supplierId, currency: "PHP" },
        p_lines: [
          {
            item_id: itemId,
            item_unit_option_id: option50,
            uom_id: uomId,
            requested_qty: 50,
            unit_price: 1.08,
          },
          {
            item_id: itemId,
            item_unit_option_id: option144,
            uom_id: uomId,
            requested_qty: 100,
            unit_price: 1.08,
          },
        ],
      });
      expect(mocks.from).not.toHaveBeenCalled();
    }
  );

  it.each(["POST", "PUT"] as const)(
    "%s maps duplicate pack rejection to an actionable code",
    async (method) => {
      mocks.rpc.mockResolvedValue({
        data: null,
        error: { message: "Duplicate stock requisition pack option" },
      });
      const response = await save(method, { supplierId, items: [lines[0], lines[0]] });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "STOCK_REQUISITION_DUPLICATE_PACK" });
      expect(mocks.from).not.toHaveBeenCalled();
    }
  );

  it("omits hidden costs so the transaction preserves and prices the lines", async () => {
    mocks.capabilities.mockResolvedValue({ canViewUnitCost: false });
    const response = await save("PUT", {
      items: lines.map((line) => ({
        itemId: line.itemId,
        itemUnitOptionId: line.itemUnitOptionId,
        uomId: line.uomId,
        requestedQty: line.requestedQty,
      })),
    });
    expect(response.status).toBe(200);
    const args = mocks.rpc.mock.calls[0][1];
    expect(args.p_header).toEqual({});
    expect(args.p_lines).toHaveLength(2);
    for (const line of args.p_lines) expect(line).not.toHaveProperty("unit_price");
  });

  it("preserves omitted header and lines on a notes-only patch", async () => {
    const response = await save("PUT", { notes: "Keep both packs" });
    expect(response.status).toBe(200);
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_header: { notes: "Keep both packs" } });
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty("p_lines");
    expect(mocks.resolveOptions).not.toHaveBeenCalled();
  });

  it("resaves a two-pack draft with nullable persisted notes and preserves explicit clears", async () => {
    const response = await save("PUT", {
      supplierId,
      requisitionDate: "2026-11-23",
      requiredByDate: "",
      currency: "PHP",
      notes: null,
      items: lines.map((line) => ({ ...line, notes: null })),
    });

    expect(response.status).toBe(200);
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({
      p_header: { notes: null, required_by_date: null },
      p_lines: [
        { item_unit_option_id: option50, requested_qty: 50, notes: null },
        { item_unit_option_id: option144, requested_qty: 100, notes: null },
      ],
    });
  });

  it("preserves stored cost precision and fractional reorder quantities for database rounding", async () => {
    const response = await save("POST", {
      supplierId,
      items: [{ ...lines[1], requestedQty: 250 / 144, unitPrice: 1.0875 }],
    });
    expect(response.status).toBe(201);
    expect(mocks.rpc.mock.calls[0][1].p_lines[0]).toMatchObject({
      requested_qty: 250 / 144,
      unit_price: 1.0875,
      item_unit_option_id: option144,
    });
  });

  it.each(["POST", "PUT"] as const)(
    "%s rejects restricted costs and unauthorized identity fields",
    async (method) => {
      mocks.capabilities.mockResolvedValue({ canViewUnitCost: false });
      expect((await save(method, { supplierId, items: lines })).status).toBe(403);
      expect(
        (await save(method, { supplierId, items: lines, companyId: "foreign-company" })).status
      ).toBe(400);
      expect(mocks.rpc).not.toHaveBeenCalled();
    }
  );

  it("keeps unknown database details server-side", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "secret SQL detail" } });
    const response = await save("POST", { supplierId, items: lines });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to save stock requisition" });
  });

  it("rejects non-draft updates from the transaction", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Only draft requisitions can be edited" },
    });
    const response = await save("PUT", { items: lines });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "STOCK_REQUISITION_STATUS_CONFLICT" });
  });

  it("retains the route permission gate", async () => {
    mocks.permission.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    const response = await save("POST", { supplierId, items: lines });
    expect(response.status).toBe(403);
    expect(mocks.context).not.toHaveBeenCalled();
  });
});
