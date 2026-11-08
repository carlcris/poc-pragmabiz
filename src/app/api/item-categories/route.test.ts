import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  permission: vi.fn(),
  from: vi.fn(),
  result: { data: [{ id: "category", name: "Zebra" }], error: null as unknown, count: 11 },
  operations: [] as unknown[][],
}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: mocks.context }));
vi.mock("@/lib/auth", () => ({ requireLookupDataAccess: mocks.permission }));
function query() {
  const builder = {
    select: (...args: unknown[]) => {
      mocks.operations.push(["select", ...args]);
      return builder;
    },
    eq: (...args: unknown[]) => {
      mocks.operations.push(["eq", ...args]);
      return builder;
    },
    is: (...args: unknown[]) => {
      mocks.operations.push(["is", ...args]);
      return builder;
    },
    order: (...args: unknown[]) => {
      mocks.operations.push(["order", ...args]);
      return builder;
    },
    range: (...args: unknown[]) => {
      mocks.operations.push(["range", ...args]);
      return builder;
    },
    ilike: (...args: unknown[]) => {
      mocks.operations.push(["ilike", ...args]);
      return builder;
    },
    then: (resolve: (result: typeof mocks.result) => unknown) =>
      Promise.resolve(mocks.result).then(resolve),
  };
  return builder;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.operations = [];
  mocks.result.error = null;
  mocks.from.mockImplementation(query);
  mocks.permission.mockResolvedValue(null);
  mocks.context.mockResolvedValue({
    supabase: { from: mocks.from },
    userId: "user",
    companyId: "company",
    currentBusinessUnitId: "unit",
  });
});
it("returns five initial results with company scope and deterministic pagination", async () => {
  const response = await GET(new NextRequest("http://localhost/api/item-categories"));
  expect(response.status).toBe(200);
  expect((await response.json()).pagination).toEqual({
    page: 1,
    limit: 5,
    total: 11,
    totalPages: 3,
  });
  expect(mocks.operations).toContainEqual(["range", 0, 4]);
  expect(mocks.operations).toContainEqual(["eq", "company_id", "company"]);
  expect(mocks.operations).toContainEqual(["order", "id", { ascending: true }]);
  expect(mocks.context).toHaveBeenCalledTimes(1);
  expect(mocks.permission).toHaveBeenCalledWith("item_categories", {
    id: "user",
    companyId: "company",
    businessUnitId: "unit",
  });
});
it("searches on the server and supports later pages", async () => {
  await GET(new NextRequest("http://localhost/api/item-categories?search=Zebra&page=2&limit=5"));
  expect(mocks.operations).toContainEqual(["ilike", "name", "%Zebra%"]);
  expect(mocks.operations).toContainEqual(["range", 5, 9]);
});
it.each(["limit=51", "limit=0", "page=-1", "page=1.5", "page=abc", `search=${"a".repeat(101)}`])(
  "rejects invalid bounds %s",
  async (params) => {
    expect(
      (await GET(new NextRequest(`http://localhost/api/item-categories?${params}`))).status
    ).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  }
);
it("does not query categories when lookup access is denied", async () => {
  mocks.permission.mockResolvedValue(new Response(null, { status: 403 }));
  expect((await GET(new NextRequest("http://localhost/api/item-categories"))).status).toBe(403);
  expect(mocks.from).not.toHaveBeenCalled();
});
it("does not expose database errors", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.result.error = { message: "private database details" };
  const response = await GET(new NextRequest("http://localhost/api/item-categories"));
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private");
  log.mockRestore();
});
