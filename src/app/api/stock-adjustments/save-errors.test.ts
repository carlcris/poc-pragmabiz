import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ApiClient } from "@/lib/api";
import { getStockAdjustmentSaveErrorMessage } from "@/lib/stock-adjustments/save-error-message";
import { translations } from "@/lib/i18n/translations";
import { POST } from "./route";
import { PATCH } from "./[id]/route";

const state = vi.hoisted(() => ({ rpc: vi.fn(), context: vi.fn() }));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: state.context }));

const body = {
  warehouseId: "warehouse",
  adjustmentType: "increase",
  adjustmentDate: "2026-11-05",
  reason: "Opening inventory",
  items: [{ itemId: "item", itemBatchLocationId: "batch-location" }],
};
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "warehouse" }, error: null }),
  };
  state.context.mockResolvedValue({
    companyId: "company",
    currentBusinessUnitId: "bu",
    userId: "user",
    supabase: { from: vi.fn().mockReturnValue(query), rpc: state.rpc },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const save = (method: "POST" | "PATCH", payload = body) => {
  const request = new NextRequest("http://localhost/api/stock-adjustments", {
    method,
    body: JSON.stringify(method === "PATCH" ? { ...payload, warehouseId: undefined } : payload),
  });
  return method === "POST"
    ? POST(request)
    : PATCH(request, { params: Promise.resolve({ id: "adjustment" }) });
};

describe.each(["POST", "PATCH"] as const)("%s stock adjustment save failures", (method) => {
  it.each([
    ["Only draft adjustments can be updated", "STOCK_ADJUSTMENT_NOT_DRAFT", 409, "saveNotDraft"],
    [
      "Selected batch location is not valid for the adjustment",
      "STOCK_ADJUSTMENT_BATCH_LOCATION_INVALID",
      400,
      "saveBatchLocationInvalid",
    ],
    [
      "Stock adjustment item does not exist",
      "STOCK_ADJUSTMENT_ITEM_MISSING",
      400,
      "saveItemMissing",
    ],
    [
      "Stock adjustment unit of measure does not exist",
      "STOCK_ADJUSTMENT_UOM_INVALID",
      400,
      "saveUomInvalid",
    ],
    [
      "Location is required for a new batch",
      "STOCK_ADJUSTMENT_LOCATION_REQUIRED",
      400,
      "saveLocationRequired",
    ],
    ["Stock adjustment not found", "STOCK_ADJUSTMENT_NOT_FOUND", 404, "saveNotFound"],
    [
      "User does not have access to the business unit",
      "STOCK_ADJUSTMENT_FORBIDDEN",
      403,
      "saveForbidden",
    ],
  ] as const)(
    "preserves %s through API, client, and translated presentation",
    async (reason, code, status, key) => {
      state.rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: reason } });
      const response = await save(method);
      expect(response.status).toBe(status);
      expect(await response.clone().json()).toMatchObject({
        code,
        error: translations.en.stockAdjustmentLineItemValidation[key],
      });
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      const client = new ApiClient();
      const failure = await (
        method === "POST" ? client.post("/save", body) : client.patch("/save", body)
      ).catch((error: unknown) => error);
      for (const locale of ["en", "zh"] as const) {
        const messages = translations[locale].stockAdjustmentLineItemValidation;
        expect(getStockAdjustmentSaveErrorMessage(failure, (name) => messages[name])).toBe(
          messages[key]
        );
      }
    }
  );

  it("keeps unknown internal errors generic", async () => {
    state.rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "secret SQL details" },
    });
    const response = await save(method);
    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(JSON.stringify(payload)).not.toContain("secret");
    expect(
      getStockAdjustmentSaveErrorMessage(
        new Error("secret", { cause: payload }),
        (key) => translations.en.stockAdjustmentLineItemValidation[key]
      )
    ).toBe(translations.en.stockAdjustmentLineItemValidation.saveFailed);
  });

  it("gives batch preflight the same code as the RPC", async () => {
    const response = await save(method, {
      ...body,
      items: [{ itemId: "item", itemBatchLocationId: "" }],
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "STOCK_ADJUSTMENT_BATCH_REQUIRED" });
  });

  it.each([
    ["SA001", 400, "STOCK_ADJUSTMENT_RECEIVED_DATE_INVALID"],
    ["SA002", 409, "STOCK_ADJUSTMENT_RECEIVED_DATE_CONFLICT"],
  ] as const)("retains received-date code %s", async (code, status, publicCode) => {
    state.rpc.mockResolvedValue({ data: null, error: { code, message: "internal detail" } });
    const response = await save(method);
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ code: publicCode });
  });
});
