import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "./route";
import type { InventoryBoxCountBusinessUnit } from "@/types/inventory-box-count-report";

type BusinessUnitLookupRow = InventoryBoxCountBusinessUnit & {
  access: { user_id: string }[];
};

const state = vi.hoisted(() => ({
  permission: vi.fn(),
  context: vi.fn(),
  from: vi.fn(),
  operations: [] as unknown[][],
  result: {
    data: [] as BusinessUnitLookupRow[],
    error: null as unknown,
    count: 0,
  },
}));

vi.mock("@/lib/auth", () => ({ requirePermission: state.permission }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: state.context }));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));

const unit = { id: "723a791c-c7e5-49e6-9f39-6bcdb66ae8ac", name: "Main Warehouse" };
const request = (query = "") =>
  GET(new NextRequest(`http://localhost/api/reports/inventory-box-count/business-units${query}`));

function query() {
  const builder = {
    select: (...args: unknown[]) => {
      state.operations.push(["select", ...args]);
      return builder;
    },
    eq: (...args: unknown[]) => {
      state.operations.push(["eq", ...args]);
      return builder;
    },
    order: (...args: unknown[]) => {
      state.operations.push(["order", ...args]);
      return builder;
    },
    range: (...args: unknown[]) => {
      state.operations.push(["range", ...args]);
      return builder;
    },
    or: (...args: unknown[]) => {
      state.operations.push(["or", ...args]);
      return builder;
    },
    then: (resolve: (result: typeof state.result) => unknown) =>
      Promise.resolve(state.result).then(resolve),
  };
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.operations = [];
  state.result = {
    data: [{ ...unit, access: [{ user_id: "session-actor" }] }],
    error: null,
    count: 12,
  };
  state.permission.mockResolvedValue(null);
  state.from.mockImplementation(query);
  state.context.mockResolvedValue({
    companyId: "session-company",
    userId: "session-actor",
    currentBusinessUnitId: "current-unit",
    supabase: { from: state.from },
  });
});

it.each([401, 403])(
  "requires Reports view before lookup work when access returns %s",
  async (status) => {
    state.permission.mockResolvedValue(NextResponse.json({}, { status }));
    expect((await request()).status).toBe(status);
    expect(state.permission).toHaveBeenCalledWith("reports", "view");
    expect(state.context).not.toHaveBeenCalled();
    expect(state.from).not.toHaveBeenCalled();
  }
);

it("returns context authentication failures before querying business units", async () => {
  state.context.mockResolvedValue(NextResponse.json({}, { status: 401 }));
  expect((await request()).status).toBe(401);
  expect(state.from).not.toHaveBeenCalled();
});

it("uses one bounded query for active company units with actor membership", async () => {
  const response = await request();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    data: [unit],
    pagination: { page: 1, limit: 5, total: 12, totalPages: 3 },
  });
  expect(state.from).toHaveBeenCalledExactlyOnceWith("business_units");
  expect(state.operations).toContainEqual([
    "select",
    "id, name, access:user_business_unit_access!user_business_unit_access_business_unit_id_fkey!inner(user_id)",
    { count: "exact" },
  ]);
  expect(state.operations).toContainEqual(["eq", "company_id", "session-company"]);
  expect(state.operations).toContainEqual(["eq", "is_active", true]);
  expect(state.operations).toContainEqual(["eq", "access.user_id", "session-actor"]);
  expect(state.operations).toContainEqual(["range", 0, 4]);
  expect(state.operations).not.toContainEqual(["eq", "id", "current-unit"]);
});

it("paginates server-side with deterministic name and id ordering", async () => {
  const response = await request("?page=2&limit=10");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    data: [unit],
    pagination: { page: 2, limit: 10, total: 12, totalPages: 2 },
  });
  expect(state.operations).toContainEqual(["range", 10, 19]);
  expect(state.operations.filter(([method]) => method === "order")).toEqual([
    ["order", "name", { ascending: true }],
    ["order", "id", { ascending: true }],
  ]);
});

it("searches code and name on the server after trimming the search term", async () => {
  const response = await request("?search=%20Main%20");
  expect(response.status).toBe(200);
  expect(state.operations).toContainEqual(["or", 'code.ilike."%Main%",name.ilike."%Main%"']);
  expect(state.from).toHaveBeenCalledOnce();
});

it("quotes filter syntax and escapes search wildcard characters", async () => {
  const search = 'Main%_\\",code.eq.OTHER';
  const response = await request(`?search=${encodeURIComponent(search)}`);
  expect(response.status).toBe(200);
  const filter = state.operations.find(([method]) => method === "or")?.[1];
  expect(typeof filter).toBe("string");
  expect(filter).toContain('code.ilike."%Main');
  expect(filter).toContain("\\\\%");
  expect(filter).toContain("\\\\_");
  expect(filter).toContain('\\",code.eq.OTHER%"');
});

it("returns a complete empty search result", async () => {
  state.result = { data: [], error: null, count: 0 };
  const response = await request("?search=missing");
  expect(await response.json()).toEqual({
    data: [],
    pagination: { page: 1, limit: 5, total: 0, totalPages: 0 },
  });
});

it("preserves the matched total when a later page is empty", async () => {
  state.result = { data: [], error: null, count: 12 };
  const response = await request("?page=4");
  expect(await response.json()).toEqual({
    data: [],
    pagination: { page: 4, limit: 5, total: 12, totalPages: 3 },
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
  "?userId=other-actor",
  "?search=" + "a".repeat(101),
])("rejects invalid or unsupported lookup filters %s", async (queryString) => {
  const response = await request(queryString);
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: "Invalid business unit search filters",
    code: "INVENTORY_BOX_COUNT_BUSINESS_UNITS_FILTERS_INVALID",
  });
  expect(state.context).not.toHaveBeenCalled();
  expect(state.from).not.toHaveBeenCalled();
});

it("keeps database failures private and returns a stable error code", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  state.result.error = { message: "private database information" };
  const response = await request();
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: "Failed to fetch business units",
    code: "INVENTORY_BOX_COUNT_BUSINESS_UNITS_FAILED",
  });
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});
