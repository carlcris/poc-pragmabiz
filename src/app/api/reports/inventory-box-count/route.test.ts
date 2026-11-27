import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "./route";
import type { InventoryBoxCountReportResponse } from "@/types/inventory-box-count-report";

const state = vi.hoisted(() => ({ permission: vi.fn(), context: vi.fn(), rpc: vi.fn() }));

vi.mock("@/lib/auth", () => ({ requirePermission: state.permission }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: state.context }));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));

const categoryId = "a0cb8f17-34c7-433b-969e-a3474bcd1ade";
const businessUnitId = "d69c52d5-6755-4e28-87e3-24c680a5897b";
const packingUnitId = "6a8496ec-5964-4540-ae7c-7d6adeefb583";
const report: InventoryBoxCountReportResponse = {
  data: [
    {
      itemId: "33529a32-aebe-415d-b380-08c629490af2",
      itemCode: "MLD-001",
      itemName: "Black Moulding",
      baseUnit: "PCS",
      onHand: 125,
      qtyPerPackingUnit: 50,
      fullPackingUnits: 2,
      looseUnits: 25,
    },
  ],
  summary: { totalItems: 1, totalFullPackingUnits: 2, itemsWithoutPackingUnitSize: 0 },
  pagination: { page: 1, limit: 25, totalPages: 1 },
  category: { id: categoryId, name: "Moldings" },
  businessUnit: null,
  packingUnit: { id: packingUnitId, code: "BOX", name: "Box" },
};

const request = (query = "") =>
  GET(
    new NextRequest(
      `http://localhost/api/reports/inventory-box-count?categoryId=${categoryId}&packingUnitId=${packingUnitId}${query}`
    )
  );

beforeEach(() => {
  vi.clearAllMocks();
  state.permission.mockResolvedValue(null);
  state.context.mockResolvedValue({
    companyId: "company-from-session",
    currentBusinessUnitId: "current-unit",
    supabase: { rpc: state.rpc },
  });
  state.rpc.mockResolvedValue({ data: report, error: null });
});

it("checks Reports view permission before context or report work", async () => {
  state.permission.mockResolvedValue(NextResponse.json({}, { status: 403 }));
  expect((await request()).status).toBe(403);
  expect(state.permission).toHaveBeenCalledWith("reports", "view");
  expect(state.context).not.toHaveBeenCalled();
  expect(state.rpc).not.toHaveBeenCalled();
});

it("returns authentication/context failures before RPC work", async () => {
  state.context.mockResolvedValue(NextResponse.json({}, { status: 401 }));
  expect((await request()).status).toBe(401);
  expect(state.rpc).not.toHaveBeenCalled();
});

it("passes session company and explicit business unit to the scoped RPC", async () => {
  const response = await request(`&businessUnitId=${businessUnitId}&page=2&limit=10`);
  expect(response.status).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith("get_inventory_box_count_report", {
    p_company_id: "company-from-session",
    p_category_id: categoryId,
    p_packing_unit_id: packingUnitId,
    p_business_unit_id: businessUnitId,
    p_page: 2,
    p_limit: 10,
  });
});

it("uses all report-authorized business units when no unit is selected", async () => {
  expect((await request()).status).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith(
    "get_inventory_box_count_report",
    expect.objectContaining({ p_business_unit_id: null, p_page: 1, p_limit: 25 })
  );
});

it.each([
  "&categoryId=invalid",
  "&packingUnitId=invalid",
  "&businessUnitId=invalid",
  "&page=0",
  "&page=1000001",
  "&page=1.5",
  "&limit=0",
  "&limit=51",
  "&limit=2.5",
  "&exportMode=csv",
  "&companyId=another-company",
  "&warehouseId=" + businessUnitId,
])("rejects invalid or unsupported filters %s", async (query) => {
  const response = await request(query);
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ code: "INVENTORY_BOX_COUNT_FILTERS_INVALID" });
  expect(state.rpc).not.toHaveBeenCalled();
});

it("requires a category", async () => {
  const response = await GET(
    new NextRequest(
      `http://localhost/api/reports/inventory-box-count?packingUnitId=${packingUnitId}`
    )
  );
  expect(response.status).toBe(400);
  expect(state.rpc).not.toHaveBeenCalled();
});

it("requires a calculation unit", async () => {
  const response = await GET(
    new NextRequest(`http://localhost/api/reports/inventory-box-count?categoryId=${categoryId}`)
  );
  expect(response.status).toBe(400);
  expect(state.rpc).not.toHaveBeenCalled();
});

it("maps an unavailable calculation unit to a safe actionable response", async () => {
  state.rpc.mockResolvedValue({
    data: null,
    error: { code: "22023", message: "INVENTORY_BOX_COUNT_PACKING_UNIT_NOT_FOUND" },
  });
  const response = await request();
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: "Selected calculation unit is unavailable. Select another unit.",
    code: "INVENTORY_BOX_COUNT_PACKING_UNIT_NOT_FOUND",
  });
});

it("keeps unexpected database validation failures private", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  state.rpc.mockResolvedValue({
    data: null,
    error: { code: "22023", message: "private function validation failure" },
  });
  const response = await request();
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private function validation failure");
  log.mockRestore();
});

it("keeps the full dataset summary when a later item page is requested", async () => {
  const paginatedReport = {
    ...report,
    summary: { totalItems: 30, totalFullPackingUnits: 105, itemsWithoutPackingUnitSize: 4 },
    pagination: { page: 2, limit: 25, totalPages: 2 },
  };
  state.rpc.mockResolvedValue({ data: paginatedReport, error: null });
  const response = await request("&page=2");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(paginatedReport);
});

it.each(["", "&exportMode=pdf"])(
  "returns an empty eligible dataset while retaining the excluded category count %s",
  async (query) => {
    const emptyReport: InventoryBoxCountReportResponse = {
      ...report,
      data: [],
      summary: { totalItems: 0, totalFullPackingUnits: 0, itemsWithoutPackingUnitSize: 12 },
      pagination: { page: 1, limit: query ? 5000 : 25, totalPages: 0 },
    };
    state.rpc.mockResolvedValue({ data: emptyReport, error: null });

    const response = await request(query);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(emptyReport);
  }
);

it.each(["qtyPerPackingUnit", "fullPackingUnits", "looseUnits"] as const)(
  "rejects a returned row with a null %s field",
  async (field) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    state.rpc.mockResolvedValue({
      data: { ...report, data: [{ ...report.data[0], [field]: null }] },
      error: null,
    });

    const response = await request();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to fetch inventory box count report",
      code: "INVENTORY_BOX_COUNT_FAILED",
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  }
);

it("requests the complete bounded PDF dataset from page one", async () => {
  expect((await request("&exportMode=pdf&page=3")).status).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith(
    "get_inventory_box_count_report",
    expect.objectContaining({ p_page: 1, p_limit: 5000 })
  );
});

it("applies the PDF cap to eligible items while allowing many excluded category items", async () => {
  const eligibleReport: InventoryBoxCountReportResponse = {
    ...report,
    summary: { ...report.summary, itemsWithoutPackingUnitSize: 6000 },
  };
  state.rpc.mockResolvedValue({ data: eligibleReport, error: null });

  const response = await request("&exportMode=pdf");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(eligibleReport);
});

it("rejects PDF exports above the cap without returning partial item data", async () => {
  state.rpc.mockResolvedValue({
    data: { ...report, summary: { ...report.summary, totalItems: 5001 } },
    error: null,
  });
  const response = await request("&exportMode=pdf");
  expect(response.status).toBe(413);
  expect(await response.json()).toEqual({
    error: "Report exceeds 5,000 items. Select a smaller category before exporting.",
    code: "INVENTORY_BOX_COUNT_TOO_LARGE",
  });
});

it("fails safely when a PDF response is incomplete", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  state.rpc.mockResolvedValue({
    data: { ...report, summary: { ...report.summary, totalItems: 2 } },
    error: null,
  });
  const response = await request("&exportMode=pdf");
  expect(response.status).toBe(500);
  expect(await response.json()).toMatchObject({ code: "INVENTORY_BOX_COUNT_FAILED" });
  log.mockRestore();
});

it("returns a safe forbidden response when the database rejects business unit access", async () => {
  state.rpc.mockResolvedValue({
    data: null,
    error: { code: "42501", message: "private access details" },
  });
  const response = await request(`&businessUnitId=${businessUnitId}`);
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({
    error: "Report access denied",
    code: "INVENTORY_BOX_COUNT_FORBIDDEN",
  });
});

it("returns 404 for an unavailable category", async () => {
  state.rpc.mockResolvedValue({ data: null, error: null });
  const response = await request();
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ code: "INVENTORY_BOX_COUNT_CATEGORY_NOT_FOUND" });
});

it("does not leak database exception details", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  state.rpc.mockResolvedValue({ data: null, error: { message: "private database error" } });
  const response = await request();
  expect(response.status).toBe(500);
  expect(JSON.stringify(await response.json())).not.toContain("private database error");
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});
