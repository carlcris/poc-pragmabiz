import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";
import { GET } from "./route";

const state = vi.hoisted(() => ({
  permission: vi.fn(),
  context: vi.fn(),
  fetch: vi.fn<typeof fetch>(),
}));
vi.mock("@/lib/auth/checkPermission", () => ({ checkPermissionForUser: state.permission }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: state.context }));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));

const request = (params: Record<string, string> = {}) =>
  GET(new NextRequest("http://localhost/api/reports/item-options?" + new URLSearchParams(params)));

const lookupQuery = () => {
  const input = state.fetch.mock.calls[0][0];
  return new URL(input instanceof Request ? input.url : input);
};

beforeEach(() => {
  vi.resetAllMocks();
  state.permission.mockResolvedValue(true);
  state.context.mockResolvedValue({
    userId: "user",
    companyId: "company",
    currentBusinessUnitId: "business-unit",
    supabase: createClient<Database>("http://localhost", "test-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: state.fetch },
    }),
  });
});

it.each([401, 400])(
  "returns 401 when verified request scope is unavailable (%s)",
  async (status) => {
    state.context.mockResolvedValue(NextResponse.json({}, { status }));

    expect((await request()).status).toBe(401);
    expect(state.context).toHaveBeenCalledTimes(1);
    expect(state.permission).not.toHaveBeenCalled();
    expect(state.fetch).not.toHaveBeenCalled();
  }
);

it("checks Reports view using the verified company and business unit before reading items", async () => {
  state.permission.mockResolvedValue(false);

  const response = await request({ page: "0" });
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({
    error: "Forbidden",
    details: "You do not have permission to view reports",
    resource: "reports",
    action: "view",
  });
  expect(state.context).toHaveBeenCalledTimes(1);
  expect(state.permission).toHaveBeenCalledExactlyOnceWith(
    { id: "user", companyId: "company", businessUnitId: "business-unit" },
    "reports",
    "view"
  );
  expect(state.fetch).not.toHaveBeenCalled();
});

it("returns six company item labels and uses one extra row to indicate another page", async () => {
  const items = Array.from({ length: 7 }, (_, id) => ({
    id: String(id),
    item_code: "CODE-" + id,
    item_name: "Item " + id,
  }));
  state.fetch.mockResolvedValue(Response.json(items));

  const response = await request();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    data: items.slice(0, 6).map(({ id, item_code, item_name }) => ({
      id,
      code: item_code,
      name: item_name,
    })),
    hasMore: true,
  });
  expect(state.context).toHaveBeenCalledTimes(1);
  expect(state.permission.mock.invocationCallOrder[0]).toBeLessThan(
    state.fetch.mock.invocationCallOrder[0]
  );
  expect(state.fetch).toHaveBeenCalledTimes(1);
  const query = lookupQuery();
  expect(query.pathname).toBe("/rest/v1/items");
  expect(Object.fromEntries(query.searchParams)).toEqual({
    select: "id,item_code,item_name",
    company_id: "eq.company",
    deleted_at: "is.null",
    order: "item_name.asc,id.asc",
    offset: "0",
    limit: "7",
  });
});

it("passes a literal name or code search and a bounded second page to PostgREST", async () => {
  state.fetch.mockResolvedValue(Response.json([]));

  const response = await request({ page: "2", limit: "6", search: '  A*(1,2) "_%"  ' });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: [], hasMore: false });
  const params = lookupQuery().searchParams;
  expect(params.get("offset")).toBe("6");
  expect(params.get("limit")).toBe("7");
  expect(params.get("or")).toBe(
    String.raw`(item_code.imatch."A\\*\\(1,2\\) \"_%\"",item_name.imatch."A\\*\\(1,2\\) \"_%\"")`
  );
});

it.each<Record<string, string>>([
  { page: "0" },
  { page: "2.5" },
  { limit: "51" },
  { search: "x".repeat(101) },
  { companyId: "other" },
])("rejects invalid lookup arguments %o before reading items", async (params) => {
  expect((await request(params)).status).toBe(400);
  expect(state.context).toHaveBeenCalledTimes(1);
  expect(state.fetch).not.toHaveBeenCalled();
});

it("keeps PostgREST error details out of the response", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  state.fetch.mockResolvedValue(
    Response.json({ message: "private database details" }, { status: 500 })
  );

  const response = await request();
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Failed to load report item options" });
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});
