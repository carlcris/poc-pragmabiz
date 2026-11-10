import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "./route";
const state = vi.hoisted(() => ({ permission: vi.fn(), context: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requirePermission: state.permission }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: state.context }));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));
const request = (query = "") =>
  GET(new NextRequest(`http://localhost/api/reports/expired-batches?asOf=2026-11-10${query}`));
beforeEach(() => {
  vi.clearAllMocks();
  state.permission.mockResolvedValue(null);
  state.context.mockResolvedValue({
    companyId: "company",
    currentBusinessUnitId: "bu",
    supabase: { rpc: state.rpc },
  });
  state.rpc.mockResolvedValue({
    data: {
      data: [],
      pageRows: 0,
      totalRows: 0,
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    },
    error: null,
  });
});
it("checks Reports permission before context or report work", async () => {
  state.permission.mockResolvedValue(NextResponse.json({}, { status: 403 }));
  expect((await request()).status).toBe(403);
  expect(state.context).not.toHaveBeenCalled();
  expect(state.rpc).not.toHaveBeenCalled();
});
it.each(["item", "batch"])("passes server scope and %s grouping", async (groupBy) => {
  expect((await request(`&groupBy=${groupBy}&page=2&limit=5&search=JIS`)).status).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith(
    "get_expired_batches_report",
    expect.objectContaining({
      p_company_id: "company",
      p_business_unit_id: "bu",
      p_group_by: groupBy,
      p_page: 2,
      p_limit: 5,
      p_search: "JIS",
      p_as_of: "2026-11-10",
    })
  );
});
it.each([
  "&groupBy=invalid",
  "&limit=51",
  "&page=0",
  "&warehouseId=bad",
  "&inStockOnly=false",
  "&search=" + "a".repeat(101),
])("rejects invalid filters %s", async (query) => {
  expect((await request(query)).status).toBe(400);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("exports a full bounded report from page one", async () => {
  expect((await request("&exportMode=pdf&page=3")).status).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith(
    "get_expired_batches_report",
    expect.objectContaining({ p_page: 1, p_limit: 501 })
  );
});
it.each([
  [501, 501, ""],
  [501, 1, "&exportMode=pdf"],
])("rejects oversized responses without partial export", async (totalRows, pageRows, query) => {
  state.rpc.mockResolvedValue({ data: { data: [], totalRows, pageRows }, error: null });
  const response = await request(String(query));
  expect(response.status).toBe(413);
  expect(await response.json()).toMatchObject({ code: "EXPIRED_BATCHES_TOO_LARGE" });
});
it("does not leak database errors", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  state.rpc.mockResolvedValue({ data: null, error: { message: "private error" } });
  const response = await request();
  expect(response.status).toBe(500);
  expect(JSON.stringify(await response.json())).not.toContain("private error");
  log.mockRestore();
});
