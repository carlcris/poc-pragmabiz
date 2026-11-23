import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  requireLoadListOperation: vi.fn(),
  requireRequestContext: vi.fn(),
  setActivityContextIfAvailable: vi.fn(),
  fetch: vi.fn<typeof fetch>(),
}));

vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
  setActivityContextIfAvailable: mocks.setActivityContextIfAvailable,
}));
vi.mock("@/lib/auth/requestContext", () => ({
  requireRequestContext: mocks.requireRequestContext,
}));
vi.mock("@/lib/load-lists/permissions", () => ({
  LOAD_LIST_MARK_IN_TRANSIT_CAPABILITY: "load_lists.operation.mark_in_transit.edit",
  requireLoadListOperation: mocks.requireLoadListOperation,
}));

const loadListId = "00000000-0000-4000-8000-000000000001";
const updatedLoadList = { id: loadListId, ll_number: "LL-0001" };

const patch = (body: unknown, id = loadListId) =>
  PATCH(
    new NextRequest(`http://localhost/api/load-lists/${id}/transit-details`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );

beforeEach(() => {
  vi.resetAllMocks();
  const supabase = createClient("http://localhost:54321", "test-key", {
    auth: { persistSession: false },
    global: { fetch: mocks.fetch },
  });
  mocks.requireLoadListOperation.mockResolvedValue(null);
  mocks.requireRequestContext.mockResolvedValue({
    supabase,
    userId: "user",
    companyId: "company",
    currentBusinessUnitId: "source",
  });
});

describe("Load list transit details", () => {
  it("updates the submitted fields atomically within source and in-transit scope", async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json(updatedLoadList));

    const response = await patch({
      linerName: "  Shipping Line  ",
      estimatedArrivalDate: "2026-12-15",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: loadListId, llNumber: "LL-0001" });
    expect(mocks.requireLoadListOperation).toHaveBeenCalledWith(
      "load_lists.operation.mark_in_transit.edit"
    );
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = mocks.fetch.mock.calls[0];
    const query = new URL(String(url)).searchParams;
    expect(options?.method).toBe("PATCH");
    expect(query.get("id")).toBe(`eq.${loadListId}`);
    expect(query.get("company_id")).toBe("eq.company");
    expect(query.get("business_unit_id")).toBe("eq.source");
    expect(query.get("status")).toBe("eq.in_transit");
    expect(query.get("deleted_at")).toBe("is.null");
    expect(query.get("select")).toBe("id,ll_number");
    expect(JSON.parse(String(options?.body))).toEqual({
      updated_by: "user",
      liner_name: "Shipping Line",
      estimated_arrival_date: "2026-12-15",
    });
    expect(mocks.setActivityContextIfAvailable).toHaveBeenCalledWith({
      entityId: loadListId,
      entityCode: "LL-0001",
    });
  });

  it.each([
    [{ linerName: null }, { updated_by: "user", liner_name: null }],
    [{ linerName: "  " }, { updated_by: "user", liner_name: null }],
    [{ estimatedArrivalDate: null }, { updated_by: "user", estimated_arrival_date: null }],
    [
      { estimatedArrivalDate: "2028-02-29" },
      { updated_by: "user", estimated_arrival_date: "2028-02-29" },
    ],
  ])("clears explicit values and preserves omitted fields for %j", async (body, expected) => {
    mocks.fetch.mockResolvedValueOnce(Response.json(updatedLoadList));

    const response = await patch(body);

    expect(response.status).toBe(200);
    expect(JSON.parse(String(mocks.fetch.mock.calls[0][1]?.body))).toEqual(expected);
  });

  it.each([
    {},
    null,
    [],
    { linerName: 1 },
    { linerName: "x".repeat(151) },
    { estimatedArrivalDate: "2026-02-29" },
    { estimatedArrivalDate: "2026-04-31" },
    { estimatedArrivalDate: "0000-01-01" },
    { estimatedArrivalDate: "2026-12-15T00:00:00Z" },
    { estimatedArrivalDate: "" },
    { linerName: "Shipping Line", status: "arrived" },
    { linerName: "Shipping Line", destinationBusinessUnitId: "other" },
  ])("rejects invalid or forbidden payload %j before any write", async (body) => {
    const response = await patch(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_LOAD_LIST_TRANSIT_DETAILS" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects an invalid load list identifier", async () => {
    const response = await patch({ linerName: "Shipping Line" }, "invalid");

    expect(response.status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const response = await PATCH(
      new NextRequest(`http://localhost/api/load-lists/${loadListId}/transit-details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
      { params: Promise.resolve({ id: loadListId }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_LOAD_LIST_TRANSIT_DETAILS" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("maps missing operation or parent permission to the safe forbidden error", async () => {
    mocks.requireLoadListOperation.mockResolvedValueOnce(
      NextResponse.json(
        { error: "Forbidden", details: "Internal permission context" },
        { status: 403 }
      )
    );

    const response = await patch({ linerName: "Shipping Line" });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "You do not have permission to edit transit details.",
      code: "LOAD_LIST_TRANSIT_DETAILS_FORBIDDEN",
    });
    expect(mocks.requireRequestContext).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("preserves authentication failures", async () => {
    mocks.requireLoadListOperation.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const response = await patch({ linerName: "Shipping Line" });

    expect(response.status).toBe(401);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("requires a selected business unit", async () => {
    const context = await mocks.requireRequestContext();
    mocks.requireRequestContext.mockResolvedValueOnce({ ...context, currentBusinessUnitId: null });

    const response = await patch({ linerName: "Shipping Line" });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "LOAD_LIST_TRANSIT_DETAILS_SCOPE_REQUIRED",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("returns a safe conflict if source, company, deletion or current status no longer matches", async () => {
    mocks.fetch.mockResolvedValueOnce(
      Response.json(
        {
          code: "PGRST116",
          details: "The result contains 0 rows",
          message: "JSON object requested, multiple (or no) rows returned",
        },
        { status: 406 }
      )
    );

    const response = await patch({ linerName: "Shipping Line" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "LOAD_LIST_TRANSIT_DETAILS_UNAVAILABLE" });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.setActivityContextIfAvailable).not.toHaveBeenCalled();
  });

  it("logs database failures and keeps internal details out of the response", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      mocks.fetch.mockResolvedValueOnce(
        Response.json({ code: "XX000", message: "Internal database secret" }, { status: 500 })
      );

      const response = await patch({ linerName: "Shipping Line" });

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: "Could not save transit details. Try again.",
      });
      expect(consoleError).toHaveBeenCalled();
      expect(mocks.setActivityContextIfAvailable).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
