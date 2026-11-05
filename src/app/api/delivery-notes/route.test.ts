import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  receivingAccess: vi.fn(),
  auth: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
  or: vi.fn(),
  in: vi.fn(),
  currentBusinessUnitId: "fulfilling-bu",
  rows: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: mocks.permission }));
vi.mock("@/lib/delivery-notes/permissions", () => ({
  requireDeliveryNoteReceivingAccess: mocks.receivingAccess,
}));
vi.mock("./_lib", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./_lib")>()),
  getAuthContext: mocks.auth,
}));

const requestingBusinessUnit = { id: "requesting-bu", code: "REQ", name: "Requesting Branch" };
const fulfillingBusinessUnit = { id: "fulfilling-bu", code: "FUL", name: "Fulfilling Depot" };
const record = {
  id: "transfer",
  company_id: "company",
  business_unit_id: fulfillingBusinessUnit.id,
  requesting_business_unit_id: requestingBusinessUnit.id,
  fulfilling_business_unit_id: fulfillingBusinessUnit.id,
  requesting_warehouse_id: null,
  fulfilling_warehouse_id: "warehouse",
  requesting_business_unit: requestingBusinessUnit,
  fulfilling_business_unit: fulfillingBusinessUnit,
  dn_no: "DN-TRANSFER-001",
  status: "dispatched",
  receiving_notes: "Receiving-only notes",
  delivery_note_items: [{ sr_item_id: "request-line", allocated_qty: 1, received_qty: 1 }],
};
const get = (query = "") => GET(new NextRequest(`http://localhost/api/delivery-notes${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentBusinessUnitId = fulfillingBusinessUnit.id;
  mocks.rows = [record];
  mocks.permission.mockResolvedValue(null);
  mocks.receivingAccess.mockResolvedValue(null);
  mocks.auth.mockImplementation(async () => ({
    companyId: "company",
    currentBusinessUnitId: mocks.currentBusinessUnitId,
    userId: "single-business-unit-user",
    supabase: { from: mocks.from },
  }));
  const query = {
    select: mocks.select,
    eq: mocks.eq,
    is: mocks.is,
    order: mocks.order,
    range: mocks.range,
    or: mocks.or,
    in: mocks.in,
    then: (
      resolve: (result: { data: Record<string, unknown>[]; error: null; count: number }) => unknown
    ) => Promise.resolve({ data: mocks.rows, error: null, count: mocks.rows.length }).then(resolve),
  };
  for (const method of [
    mocks.select,
    mocks.eq,
    mocks.is,
    mocks.order,
    mocks.range,
    mocks.or,
    mocks.in,
  ]) {
    method.mockReturnValue(query);
  }
  mocks.from.mockReturnValue(query);
});

describe("delivery-note list business-unit summaries", () => {
  it.each([fulfillingBusinessUnit.id, requestingBusinessUnit.id])(
    "returns both summaries when the user's selected business unit is %s",
    async (businessUnitId) => {
      mocks.currentBusinessUnitId = businessUnitId;
      const response = await get();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data[0]).toMatchObject({
        requesting_business_unit: requestingBusinessUnit,
        fulfilling_business_unit: fulfillingBusinessUnit,
        can_view_receiving_details: businessUnitId === requestingBusinessUnit.id,
      });
      if (businessUnitId === fulfillingBusinessUnit.id) {
        expect(body.data[0]).not.toHaveProperty("receiving_notes");
        expect(body.data[0].delivery_note_items[0]).not.toHaveProperty("received_qty");
      } else {
        expect(body.data[0].receiving_notes).toBe(record.receiving_notes);
      }
      expect(mocks.eq).toHaveBeenCalledWith("company_id", "company");
      expect(mocks.is).toHaveBeenCalledWith("deleted_at", null);
      expect(mocks.or).toHaveBeenCalledWith(
        `requesting_business_unit_id.eq.${businessUnitId},fulfilling_business_unit_id.eq.${businessUnitId}`
      );
      expect(mocks.from).toHaveBeenCalledExactlyOnceWith("delivery_notes");
    }
  );

  it("joins only the related business-unit summary columns in the paginated query", async () => {
    const response = await get("?page=2&limit=5");
    const projection = String(mocks.select.mock.calls[0][0]).replace(/\s+/g, "");
    for (const side of ["requesting", "fulfilling"]) {
      expect(projection).toContain(
        `${side}_business_unit:business_units!delivery_notes_${side}_business_unit_id_fkey(id,code,name)`
      );
    }
    expect(mocks.select).toHaveBeenCalledWith(expect.any(String), { count: "exact" });
    expect(mocks.range).toHaveBeenCalledWith(5, 9);
    expect(await response.json()).toMatchObject({
      pagination: { page: 2, limit: 5, total: 1, totalPages: 1 },
    });
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it("keeps receiving-only lists restricted to the requesting business unit", async () => {
    mocks.currentBusinessUnitId = requestingBusinessUnit.id;
    const response = await get("?receivingOnly=true");
    expect(response.status).toBe(200);
    expect(mocks.receivingAccess).toHaveBeenCalledWith("view");
    expect(mocks.eq).toHaveBeenCalledWith("requesting_business_unit_id", requestingBusinessUnit.id);
    expect(mocks.or).not.toHaveBeenCalled();
    expect((await response.json()).data[0].fulfilling_business_unit).toEqual(
      fulfillingBusinessUnit
    );
  });

  it("does not load labels or documents when the module permission is denied", async () => {
    mocks.permission.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    const response = await get();
    expect(response.status).toBe(403);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
