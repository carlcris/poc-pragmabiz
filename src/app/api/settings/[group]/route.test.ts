import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT } from "./route";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  context: vi.fn(),
  from: vi.fn(),
  operations: [] as unknown[][],
  companyResult: {
    data: { document_code_digits: 9, warehouse_location_code_digits: 2 },
    error: null as unknown,
  },
}));

vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: mocks.permission }));
vi.mock("@/lib/supabase/server-with-bu", () => ({
  createServerClientWithBU: mocks.context,
}));

function query(table: string) {
  const builder = {
    select: (columns: string) => {
      mocks.operations.push([table, "select", columns]);
      return builder;
    },
    update: (values: unknown) => {
      mocks.operations.push([table, "update", values]);
      return builder;
    },
    eq: (column: string, value: unknown) => {
      mocks.operations.push([table, "eq", column, value]);
      return builder;
    },
    is: (column: string, value: unknown) => {
      mocks.operations.push([table, "is", column, value]);
      return builder;
    },
    single: () =>
      Promise.resolve(
        table === "users" ? { data: { company_id: "company" }, error: null } : mocks.companyResult
      ),
  };
  return builder;
}

const context = () => ({ params: Promise.resolve({ group: "company" }) });
const request = (body: unknown) =>
  new NextRequest("http://localhost/api/settings/company", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.operations = [];
  mocks.companyResult.error = null;
  mocks.from.mockImplementation(query);
  mocks.permission.mockResolvedValue(null);
  mocks.context.mockResolvedValue({ supabase: { from: mocks.from }, userId: "actor" });
});

describe("company generated code padding settings", () => {
  it("returns the configured widths with an explicit company-scoped projection", async () => {
    const response = await GET(new NextRequest("http://localhost/api/settings/company"), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: mocks.companyResult.data });
    expect(mocks.operations).toContainEqual(["companies", "eq", "id", "company"]);
    const projection = mocks.operations.find(
      ([table, action]) => table === "companies" && action === "select"
    )?.[2];
    expect(projection).toContain("document_code_digits");
    expect(projection).toContain("warehouse_location_code_digits");
    expect(projection).not.toContain("*");
    expect(mocks.permission).toHaveBeenCalledWith("company_settings", "view");
  });

  it.each([
    { document_code_digits: 1 },
    { document_code_digits: 18 },
    { warehouse_location_code_digits: 1 },
    { warehouse_location_code_digits: 6 },
    { document_code_digits: 5, warehouse_location_code_digits: 3 },
  ])("saves only submitted settings %j", async (body) => {
    const response = await PUT(request(body), context());

    expect(response.status).toBe(200);
    expect(mocks.operations).toContainEqual(["companies", "update", body]);
    expect(mocks.operations).toContainEqual(["companies", "eq", "id", "company"]);
    expect(mocks.operations).toContainEqual(["companies", "is", "deleted_at", null]);
    expect(mocks.permission).toHaveBeenCalledWith("company_settings", "edit");
  });

  it.each([
    { document_code_digits: 0 },
    { document_code_digits: 19 },
    { document_code_digits: 2.5 },
    { document_code_digits: "5" },
    { document_code_digits: null },
    { warehouse_location_code_digits: 0 },
    { warehouse_location_code_digits: 7 },
    { warehouse_location_code_digits: 1.5 },
    { warehouse_location_code_digits: false },
    { document_code_digits: 5, warehouse_location_code_digits: 7 },
  ])("rejects invalid widths before any write %j", async (body) => {
    const response = await PUT(request({ name: "Changed", ...body }), context());

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_GENERATED_CODE_PADDING" });
    expect(mocks.from).not.toHaveBeenCalledWith("companies");
  });

  it("omits insert-only and ownership fields from the update", async () => {
    const response = await PUT(
      request({ code: "REPLACED", id: "other", company_id: "other", name: "Company" }),
      context()
    );

    expect(response.status).toBe(200);
    expect(mocks.operations).toContainEqual(["companies", "update", { name: "Company" }]);
  });

  it.each([[], null, { name: "x".repeat(32_769) }])(
    "rejects malformed or oversized payloads",
    async (body) => {
      expect((await PUT(request(body), context())).status).toBe(400);
      expect(mocks.from).not.toHaveBeenCalledWith("companies");
    }
  );

  it("returns denied permission before loading company data", async () => {
    mocks.permission.mockResolvedValue(new Response(null, { status: 403 }));

    expect((await PUT(request({ document_code_digits: 5 }), context())).status).toBe(403);
    expect(mocks.context).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("logs database errors and returns safe response text", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.companyResult.error = { message: "private database details" };
    const response = await PUT(request({ document_code_digits: 5 }), context());

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private database details");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
