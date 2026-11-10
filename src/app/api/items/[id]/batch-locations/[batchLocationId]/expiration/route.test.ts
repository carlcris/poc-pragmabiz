import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { PATCH } from "./route";
const state = vi.hoisted(() => ({
  permission: vi.fn(),
  from: vi.fn(),
  source: vi.fn(),
  updateResult: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  inside: vi.fn(),
}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: state.permission }));
vi.mock("@/lib/auth/requestContext", () => ({
  requireRequestContext: async () => ({
    companyId: "company",
    userId: "actor",
    currentBusinessUnitId: "bu",
    accessibleBusinessUnitIds: ["bu"],
    supabase: { from: state.from },
  }),
}));
const item = "10000000-0000-4000-8000-000000000001";
const location = "10000000-0000-4000-8000-000000000002";
const request = (body: unknown) =>
  PATCH(
    new NextRequest("http://localhost/api/items/expiration", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: item, batchLocationId: location }) }
  );
beforeEach(() => {
  vi.clearAllMocks();
  state.permission.mockResolvedValue(null);
  state.source.mockResolvedValue({
    data: { item_batch_id: "batch", warehouse_id: "warehouse" },
    error: null,
  });
  state.updateResult.mockResolvedValue({
    data: { id: "batch", expiration_date: null },
    error: null,
  });
  state.from.mockImplementation((table: string) => {
    const query = {
      select: vi.fn(),
      eq: state.eq,
      in: state.inside,
      is: vi.fn(),
      update: state.update,
      maybeSingle: table === "item_batches" ? state.updateResult : state.source,
    };
    for (const method of [query.select, query.eq, query.in, query.is, query.update])
      method.mockReturnValue(query);
    return query;
  });
});
it.each(["2027-02-28", null])(
  "saves expiration %s with scoped, update-only fields",
  async (expirationDate) => {
    const response = await request({ expirationDate });
    expect(response.status).toBe(200);
    expect(state.update).toHaveBeenCalledWith({
      expiration_date: expirationDate,
      updated_by: "actor",
    });
    expect(state.eq).toHaveBeenCalledWith("company_id", "company");
    expect(state.eq).toHaveBeenCalledWith("item_id", item);
    expect(state.eq).toHaveBeenCalledWith("warehouse.business_unit_id", "bu");
    expect(state.inside).toHaveBeenCalledWith("warehouse.business_unit_id", ["bu"]);
  }
);
it.each([
  {},
  { expirationDate: "2027-02-29" },
  { expirationDate: "" },
  { expirationDate: null, item_id: "different" },
])("rejects invalid or extra fields %j", async (body) => {
  expect((await request(body)).status).toBe(400);
  expect(state.from).not.toHaveBeenCalled();
});
it("enforces edit permission before reading stock", async () => {
  state.permission.mockResolvedValue(NextResponse.json({}, { status: 403 }));
  expect((await request({ expirationDate: null })).status).toBe(403);
  expect(state.from).not.toHaveBeenCalled();
});
it("does not update an inaccessible or deleted batch location", async () => {
  state.source.mockResolvedValue({ data: null, error: null });
  expect((await request({ expirationDate: null })).status).toBe(404);
  expect(state.update).not.toHaveBeenCalled();
});
it("keeps unknown database errors server-side", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  state.updateResult.mockResolvedValue({
    data: null,
    error: { message: "private database details" },
  });
  const response = await request({ expirationDate: null });
  expect(response.status).toBe(500);
  expect(JSON.stringify(await response.json())).not.toContain("private database details");
  log.mockRestore();
});
