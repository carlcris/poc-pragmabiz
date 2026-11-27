import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "./route";
import type { InventoryBoxCountPackingUnit } from "@/types/inventory-box-count-report";

const state = vi.hoisted(() => ({
  permission: vi.fn(),
  context: vi.fn(),
  from: vi.fn(),
  queries: [] as unknown[][][],
  units: { data: [] as InventoryBoxCountPackingUnit[], error: null as unknown, count: 0 },
  defaultUnit: { data: null as InventoryBoxCountPackingUnit | null, error: null as unknown },
}));

vi.mock("@/lib/auth", () => ({ requirePermission: state.permission }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: state.context }));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));

const box = { id: "6a8496ec-5964-4540-ae7c-7d6adeefb583", code: "BOX", name: "Box" };
const crate = { id: "3c85b916-e9bd-492a-b770-b9af41c9c1f3", code: "CRATE", name: "Crate" };
const request = (query = "") =>
  GET(new NextRequest(`http://localhost/api/reports/inventory-box-count/packing-units${query}`));

function query() {
  const operations: unknown[][] = [];
  state.queries.push(operations);
  const builder = {
    select: (...args: unknown[]) => {
      operations.push(["select", ...args]);
      return builder;
    },
    eq: (...args: unknown[]) => {
      operations.push(["eq", ...args]);
      return builder;
    },
    is: (...args: unknown[]) => {
      operations.push(["is", ...args]);
      return builder;
    },
    order: (...args: unknown[]) => {
      operations.push(["order", ...args]);
      return builder;
    },
    range: (...args: unknown[]) => {
      operations.push(["range", ...args]);
      return builder;
    },
    or: (...args: unknown[]) => {
      operations.push(["or", ...args]);
      return builder;
    },
    maybeSingle: () => {
      operations.push(["maybeSingle"]);
      return Promise.resolve(state.defaultUnit);
    },
    then: (resolve: (result: typeof state.units) => unknown) =>
      Promise.resolve(state.units).then(resolve),
  };
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.queries = [];
  state.units = { data: [crate], error: null, count: 12 };
  state.defaultUnit = { data: box, error: null };
  state.permission.mockResolvedValue(null);
  state.from.mockImplementation(query);
  state.context.mockResolvedValue({
    companyId: "session-company",
    supabase: { from: state.from },
  });
});

it("requires Reports view before context or unit lookup", async () => {
  state.permission.mockResolvedValue(NextResponse.json({}, { status: 403 }));
  expect((await request()).status).toBe(403);
  expect(state.permission).toHaveBeenCalledWith("reports", "view");
  expect(state.context).not.toHaveBeenCalled();
  expect(state.from).not.toHaveBeenCalled();
});

it("returns context authentication failures before querying units", async () => {
  state.context.mockResolvedValue(NextResponse.json({}, { status: 401 }));
  expect((await request()).status).toBe(401);
  expect(state.from).not.toHaveBeenCalled();
});

it("returns five bounded units by default and resolves BOX independently of the page", async () => {
  const response = await request();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    data: [crate],
    pagination: { page: 1, limit: 5, total: 12, totalPages: 3 },
    defaultUnit: box,
  });
  expect(state.queries).toHaveLength(2);
  expect(state.queries[0]).toContainEqual(["select", "id, code, name", { count: "exact" }]);
  expect(state.queries[0]).toContainEqual(["range", 0, 4]);
  expect(state.queries[1]).toContainEqual(["select", "id, code, name"]);
  expect(state.queries[1]).toContainEqual(["eq", "code", "BOX"]);
  expect(state.queries[1]).toContainEqual(["maybeSingle"]);
  for (const operations of state.queries) {
    expect(operations).toContainEqual(["eq", "company_id", "session-company"]);
    expect(operations).toContainEqual(["eq", "is_active", true]);
    expect(operations).toContainEqual(["is", "deleted_at", null]);
  }
});

it("paginates on the server with deterministic code/name/id ordering", async () => {
  const response = await request("?page=2&limit=10");
  expect(response.status).toBe(200);
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0]).toContainEqual(["range", 10, 19]);
  expect(state.queries[0].filter(([method]) => method === "order")).toEqual([
    ["order", "code", { ascending: true }],
    ["order", "name", { ascending: true }],
    ["order", "id", { ascending: true }],
  ]);
  expect((await response.json()).defaultUnit).toBeNull();
});

it("searches unit code and name server-side without another default lookup", async () => {
  const response = await request("?search=%20Crate%20");
  expect(response.status).toBe(200);
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0]).toContainEqual(["or", 'code.ilike."%Crate%",name.ilike."%Crate%"']);
  expect((await response.json()).defaultUnit).toBeNull();
});

it("quotes filter syntax and escapes search wildcard characters", async () => {
  const search = 'Cr%_ate",code.eq.BOX';
  const response = await request(`?search=${encodeURIComponent(search)}`);
  expect(response.status).toBe(200);
  const filter = state.queries[0].find(([method]) => method === "or")?.[1];
  expect(typeof filter).toBe("string");
  expect(filter).toContain('code.ilike."%Cr');
  expect(filter).toContain("\\\\%");
  expect(filter).toContain("\\\\_");
  expect(filter).toContain('\\",code.eq.BOX%"');
});

it("returns null for the default when no active BOX is available", async () => {
  state.defaultUnit = { data: null, error: null };
  expect((await (await request()).json()).defaultUnit).toBeNull();
});

it("returns a complete empty page with its real total", async () => {
  state.units = { data: [], error: null, count: 0 };
  const response = await request("?search=missing");
  expect(await response.json()).toEqual({
    data: [],
    pagination: { page: 1, limit: 5, total: 0, totalPages: 0 },
    defaultUnit: null,
  });
});

it.each([
  "?page=0",
  "?page=1000001",
  "?page=1.5",
  "?limit=0",
  "?limit=51",
  "?limit=1.5",
  "?companyId=other-company",
  "?search=" + "a".repeat(101),
])("rejects invalid lookup filters %s", async (queryString) => {
  const response = await request(queryString);
  expect(response.status).toBe(400);
  expect(state.from).not.toHaveBeenCalled();
});

it.each(["units", "defaultUnit"] as const)("keeps %s database failures private", async (result) => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  state[result].error = { message: "private database information" };
  const response = await request();
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private database information");
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});
