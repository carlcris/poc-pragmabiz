import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendStockRequisitionEmail, sendTestEmail } from "./email";
import type { StockRequisitionEmailData } from "./email";

const mocks = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: mocks.sendMail }) },
}));

const requisition: StockRequisitionEmailData = {
  srNumber: "SR-000000001",
  supplierName: "Supplier",
  supplierEmail: "supplier@example.com",
  requisitionDate: "November 2, 2026",
  totalAmount: "PHP 100.00",
  items: [],
  createdBy: "Requester",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sendMail.mockResolvedValue({ messageId: "test-message" });
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe.each([
  ["stock requisition", () => sendStockRequisitionEmail(requisition)],
  ["test", () => sendTestEmail("recipient@example.com")],
] as const)("%s email delivery", (_name, send) => {
  it("skips SMTP delivery when application email is disabled", async () => {
    vi.stubEnv("EMAIL_ENABLED", "false");

    await expect(send()).resolves.toEqual({ success: false, skipped: true });
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
  });

  it.each(["true", undefined])("delivers when EMAIL_ENABLED is %s", async (enabled) => {
    vi.stubEnv("EMAIL_ENABLED", enabled);

    await expect(send()).resolves.toEqual({ success: true, messageId: "test-message" });
    expect(mocks.sendMail).toHaveBeenCalledOnce();
  });
});
