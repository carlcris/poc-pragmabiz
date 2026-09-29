import { describe, expect, it } from "vitest";

import { frameLineDescription, frameSpecSummary } from "./description";
import type { FrameQuotationConfiguration } from "@/types/quotation";

const configuration = (
  overrides: Partial<FrameQuotationConfiguration> = {}
): FrameQuotationConfiguration => ({
  width: 20,
  height: 25,
  fixedAllowance: 0,
  serviceFeeMode: "per_frame",
  serviceFeeAmount: 0,
  totalServiceFee: 0,
  invoiceDisplayMode: "components",
  billingMode: "chop_join",
  artworkLengthIn: 21,
  artworkWidthIn: 16,
  ...overrides,
});

describe("frameLineDescription", () => {
  it("replaces the artwork-size prefix with the finished outside size", () => {
    expect(
      frameLineDescription({
        description: "21″ × 16″ — 057-02Q WHITE · Double matting",
        frameConfiguration: configuration(),
      })
    ).toBe("25″ × 20″ — 057-02Q WHITE · Double matting");
  });

  it("shows every finished outside size on a multi-size line", () => {
    expect(
      frameLineDescription({
        description: "21″ × 16″, 12″ × 10″ — Single matting",
        frameConfiguration: configuration(),
        frameSizes: [
          {
            frameConfiguration: configuration(),
            frameComponents: [],
            matLayers: [],
          },
          {
            frameConfiguration: configuration({ height: 16, width: 14 }),
            frameComponents: [],
            matLayers: [],
          },
        ],
      })
    ).toBe("25″ × 20″, 16″ × 14″ — Single matting");
  });

  it("does not change a normal quotation item", () => {
    expect(
      frameLineDescription({ description: "Standard stock item", frameConfiguration: null })
    ).toBe("Standard stock item");
  });
});

describe("frameSpecSummary — the spec without the dimensions", () => {
  it("drops the dimension prefix so a size row can carry its own spec", () => {
    expect(
      frameSpecSummary("25″ × 20″ — 057-02Q WHITE · Double matting · Clear glass · MDF · flexi 1/2")
    ).toBe("057-02Q WHITE · Double matting · Clear glass · MDF · flexi 1/2");
  });

  it("drops every dimension of a multi-size line, not just the first", () => {
    expect(frameSpecSummary("25″ × 20″, 16″ × 20″ — 057-02Q WHITE · Clear glass")).toBe(
      "057-02Q WHITE · Clear glass"
    );
  });

  it("returns nothing when the description carries no spec", () => {
    expect(frameSpecSummary("25″ × 20″")).toBe("");
    expect(frameSpecSummary("Standard stock item")).toBe("");
  });
});
