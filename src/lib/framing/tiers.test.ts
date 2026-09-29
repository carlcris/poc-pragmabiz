import { describe, expect, it } from "vitest";
import {
  isMouldingRateMissing,
  resolveMouldingRate,
  supportsFramingWork,
  priceTierForBillingMode,
} from "@/lib/framing/tiers";
import type { ItemPriceTier } from "@/types/item";

const tier = (code: string, price: number): ItemPriceTier => ({
  id: code,
  priceTier: code,
  priceTierName: code,
  price,
  currencyCode: "PHP",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  isActive: true,
});

// real values from item 1574-36B-BLK
const mouldingTiers = [
  tier("framing", 13.76),
  tier("chop_join", 6.19),
  tier("srp", 351),
  tier("ws", 158),
];

describe("tier resolution (drives the dialog's moulding rate)", () => {
  it("blocks a newly selected moulding with no tiers in either billing mode", () => {
    expect(isMouldingRateMissing([], "chop_join")).toBe(true);
    expect(isMouldingRateMissing([], "framing")).toBe(true);
    expect(isMouldingRateMissing([tier("framing", 13.76)], "chop_join")).toBe(true);
  });
  it("preserves restored snapshot prices and allows loaded service-mode prices", () => {
    expect(isMouldingRateMissing(undefined, "chop_join")).toBe(false);
    expect(isMouldingRateMissing(mouldingTiers, "chop_join")).toBe(false);
  });
  it("reads the framing tier in framing mode", () => {
    expect(resolveMouldingRate(mouldingTiers, "framing")).toBe(13.76);
  });
  it("reads the chop_join tier in chop & join mode", () => {
    expect(resolveMouldingRate(mouldingTiers, "chop_join")).toBe(6.19);
  });
  it("never falls back to a customer-segment tier", () => {
    const noServiceTiers = [tier("srp", 351), tier("ws", 158)];
    expect(resolveMouldingRate(noServiceTiers, "framing")).toBeNull();
    expect(resolveMouldingRate(noServiceTiers, "chop_join")).toBeNull();
  });
  it("ignores inactive tiers", () => {
    const inactive = [{ ...tier("framing", 13.76), isActive: false }];
    expect(resolveMouldingRate(inactive, "framing")).toBeNull();
  });
  it("detects whether an item can be framed at all", () => {
    expect(supportsFramingWork(mouldingTiers)).toBe(true);
    expect(supportsFramingWork([tier("srp", 351)])).toBe(false);
    expect(supportsFramingWork(undefined)).toBe(false);
  });
  it("maps each billing mode to its tier code", () => {
    expect(priceTierForBillingMode("framing")).toBe("framing");
    expect(priceTierForBillingMode("chop_join")).toBe("chop_join");
  });
});

describe("resolveMouldingRate — what the picker flags", () => {
  const tiers = (...codes: string[]) =>
    codes.map((priceTier, index) => ({
      id: `t${index}`,
      priceTier,
      priceTierName: priceTier,
      price: 1.98 + index,
      currencyCode: "PHP",
      isActive: true,
      effectiveFrom: "2026-06-23",
      effectiveTo: null,
    }));

  it("prices a moulding that carries the mode's tier", () => {
    // 057-10 has both tiers and must never be flagged.
    expect(resolveMouldingRate(tiers("chop_join", "framing", "default"), "chop_join")).toBe(1.98);
    expect(resolveMouldingRate(tiers("chop_join", "framing", "default"), "framing")).toBe(2.98);
  });

  it("returns null for a moulding priced only on customer-segment tiers", () => {
    // The six 6123-* mouldings in the catalogue look like this.
    expect(resolveMouldingRate(tiers("default", "srp", "ws"), "chop_join")).toBeNull();
  });

  it("returns null when tiers are unknown, which callers must not treat as unpriced", () => {
    // A line reopened for editing has no tiers on its restored moulding.
    expect(resolveMouldingRate(undefined, "chop_join")).toBeNull();
    expect(resolveMouldingRate([], "chop_join")).toBeNull();
  });
});
