import { describe, expect, it } from "vitest";
import {
  canEditStockRequest,
  isFulfillingBusinessUnit,
  isRequestingBusinessUnit,
} from "./stock-request-access";
import type { StockRequestStatus } from "@/types/stock-request";

const buildRequest = (status: StockRequestStatus = "draft") => ({
  status,
  business_unit_id: "requesting",
  fulfilling_business_unit_id: "fulfilling",
});

describe("stock request business unit scope", () => {
  it("matches the requesting and fulfilling units", () => {
    expect(isRequestingBusinessUnit(buildRequest(), "requesting")).toBe(true);
    expect(isRequestingBusinessUnit(buildRequest(), "fulfilling")).toBe(false);
    expect(isFulfillingBusinessUnit(buildRequest(), "fulfilling")).toBe(true);
    expect(isFulfillingBusinessUnit(buildRequest(), null)).toBe(false);
  });
});

describe("canEditStockRequest", () => {
  it("allows the requesting unit to edit a draft with edit permission", () => {
    expect(canEditStockRequest(buildRequest(), "requesting", true)).toBe(true);
  });

  it.each(["submitted", "approved", "dispatched", "cancelled"] as const)(
    "blocks editing once the transfer is %s",
    (status) => {
      expect(canEditStockRequest(buildRequest(status), "requesting", true)).toBe(false);
    }
  );

  it("requires edit permission and the requesting business unit", () => {
    expect(canEditStockRequest(buildRequest(), "requesting", false)).toBe(false);
    expect(canEditStockRequest(buildRequest(), "fulfilling", true)).toBe(false);
  });
});
