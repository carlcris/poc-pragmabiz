import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), permission: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: mocks.permission }));
vi.mock("@/lib/supabase/server-with-bu", () => ({
  createServerClientWithBU: async () => ({
    supabase: {
      rpc: mocks.rpc,
      from: mocks.from,
      auth: { getUser: async () => ({ data: { user: { id: "actor" } } }) },
    },
  }),
}));
vi.mock("../../_shared", () => ({
  asRpcClient: (client: unknown) => client,
  fetchQuotationById: async () => ({ quotation: { id: "quotation", status: "accepted" } }),
  logQuotationError: vi.fn(),
  getClientErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

import { PATCH } from "./route";

describe("quotation status transaction", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.from.mockReset();
    mocks.permission.mockReset().mockResolvedValue(null);
  });
  const request = () =>
    new NextRequest("http://localhost/api/quotations/quotation/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "accepted",
        acceptedByName: "Customer",
        acceptedChannel: "email",
        waiverPaths: ["company/waiver.pdf"],
      }),
    });
  it("accepts through a single RPC without sequential table writes", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    const response = await PATCH(request(), { params: Promise.resolve({ id: "quotation" }) });
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("change_sales_quotation_status_transaction", {
      p_quotation_id: "quotation",
      p_status: "accepted",
      p_accepted_by_name: "Customer",
      p_accepted_channel: "email",
      p_waiver_paths: ["company/waiver.pdf"],
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not run a mutation after permission denial", async () => {
    mocks.permission.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    expect((await PATCH(request(), { params: Promise.resolve({ id: "quotation" }) })).status).toBe(
      403
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("keeps internal transaction errors out of the response", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "internal constraint details" } });
    const response = await PATCH(request(), { params: Promise.resolve({ id: "quotation" }) });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to update quotation status" });
  });
});
