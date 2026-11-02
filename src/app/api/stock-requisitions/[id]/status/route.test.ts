import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  context: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  sendEmail: vi.fn(),
}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: mocks.permission }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: mocks.context }));
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendStockRequisitionEmail: mocks.sendEmail,
}));

const sr = { id: "requisition", sr_number: "SR-000000001", status: "submitted" };
const singleResult = (data: unknown) => {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    update: mocks.update.mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
  };
  return query;
};
const submit = () =>
  PATCH(
    new NextRequest("http://localhost/api/stock-requisitions/requisition/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "submitted" }),
    }),
    { params: Promise.resolve({ id: sr.id }) }
  );

beforeEach(() => {
  vi.resetAllMocks();
  mocks.permission.mockResolvedValue(null);
  mocks.context.mockResolvedValue({
    supabase: { from: mocks.from },
    companyId: "company",
    currentBusinessUnitId: "business-unit",
    userId: "actor",
  });
  mocks.from
    .mockReturnValueOnce(singleResult({ id: sr.id, status: "draft" }))
    .mockReturnValueOnce(singleResult(sr))
    .mockReturnValueOnce(
      singleResult({
        ...sr,
        supplier: { email: "supplier@example.com", supplier_name: "Supplier", lang: "english" },
        requisition_date: "2026-11-02",
        currency: "PHP",
        total_amount: 100,
        stock_requisition_items: [],
      })
    );
  mocks.sendEmail.mockResolvedValue({ success: true, messageId: "test-message" });
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("stock requisition submission with application email configuration", () => {
  it("submits without fetching email details or sending when email is disabled", async () => {
    vi.stubEnv("EMAIL_ENABLED", "false");

    const response = await submit();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: sr.id,
      srNumber: sr.sr_number,
      status: "submitted",
      message: "Status updated successfully",
    });
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
      status: "submitted",
      updated_by: "actor",
    });
    expect(mocks.from).toHaveBeenCalledTimes(2);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it.each(["true", undefined])("sends supplier email when EMAIL_ENABLED is %s", async (enabled) => {
    vi.stubEnv("EMAIL_ENABLED", enabled);

    const response = await submit();

    expect(response.status).toBe(200);
    expect(mocks.from).toHaveBeenCalledTimes(3);
    expect(mocks.sendEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ srNumber: sr.sr_number, supplierEmail: "supplier@example.com" })
    );
  });
});
