import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const state = vi.hoisted(() => ({ context: vi.fn(), capabilities: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: state.context }));
vi.mock("@/services/permissions/permissionResolver", () => ({
  getUserCapabilities: state.capabilities,
  hasCapability: (granted: Set<string>, capability: string) => granted.has(capability),
}));

const zone = "timeZone=Asia%2FManila";
const get = (query: string) =>
  GET(new NextRequest(`http://localhost/api/warehouse-dashboard/operations-overview?${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  state.capabilities.mockResolvedValue(
    new Set(["dashboard.widget.stock_value.view", "dashboard.queue.pick_list.view"])
  );
  state.rpc.mockResolvedValue({ data: { asOf: "2026-11-13", days: 14 }, error: null });
  state.context.mockResolvedValue({
    supabase: { rpc: state.rpc },
    userId: "user",
    companyId: "company",
    currentBusinessUnitId: "bu",
    defaultBusinessUnitId: "bu",
    accessibleBusinessUnitIds: ["bu", "other-bu"],
  });
});

describe("warehouse operations overview route", () => {
  it.each([
    `${zone}&days=10`,
    `${zone}&days=abc`,
    "timeZone=Not%2FAZone&days=14",
    "days=14",
    zone,
    `${zone}&days=14&asOf=2026-11-13`,
  ])("rejects an invalid request without querying: %s", async (query) => {
    const response = await get(query);
    expect(response.status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("scopes to the selected business unit and passes only granted sections", async () => {
    const response = await get(`${zone}&days=14`);
    expect(response.status).toBe(200);
    expect(state.rpc).toHaveBeenCalledTimes(1);
    const [name, args] = state.rpc.mock.calls[0];
    expect(name).toBe("get_warehouse_operations_overview");
    expect(args).toMatchObject({
      p_company_id: "company",
      p_business_unit_ids: ["bu"],
      p_time_zone: "Asia/Manila",
      p_days: 14,
    });
    expect(args.p_include_pick_lists).toBe(true);
    expect(args.p_include_inbound).toBe(false);
    expect(args.p_include_reorder).toBe(false);
  });

  it("uses every accessible business unit when none is selected", async () => {
    state.context.mockResolvedValue({
      supabase: { rpc: state.rpc },
      userId: "user",
      companyId: "company",
      currentBusinessUnitId: null,
      defaultBusinessUnitId: null,
      accessibleBusinessUnitIds: ["bu", "other-bu"],
    });
    await get(`${zone}&days=7`);
    expect(state.rpc.mock.calls[0][1].p_business_unit_ids).toEqual(["bu", "other-bu"]);
  });

  it("maps a database-rejected time zone to 400", async () => {
    state.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "22023", message: 'time zone "X" not recognized' },
    });
    const response = await get(`${zone}&days=14`);
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toContain("not recognized");
  });

  it("maps a scope refusal to 403 and hides database errors", async () => {
    state.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "secret" } });
    expect((await get(`${zone}&days=14`)).status).toBe(403);

    state.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "XX000", message: "secret detail" },
    });
    const failed = await get(`${zone}&days=14`);
    expect(failed.status).toBe(500);
    expect(JSON.stringify(await failed.json())).not.toContain("secret");
  });
});
