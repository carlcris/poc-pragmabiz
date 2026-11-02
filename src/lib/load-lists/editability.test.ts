import { describe, expect, it } from "vitest";
import { canEditLoadList } from "./editability";
import type { LoadListStatus } from "@/types/load-list";

const buildLoadList = (
  status: LoadListStatus,
  overrides: { source?: boolean; price?: boolean }
) => ({
  status,
  isSourceBusinessUnit: overrides.source ?? true,
  capabilities: {
    canViewTotalAmount: true,
    canViewUnitPrice: overrides.price ?? true,
    canLinkStockRequisitions: false,
    canMarkInTransit: false,
    canMarkArrived: false,
  },
});

describe("canEditLoadList", () => {
  it.each(["draft", "confirmed"] as const)(
    "allows the source business unit to edit %s",
    (status) => {
      expect(canEditLoadList(buildLoadList(status, {}), true)).toBe(true);
    }
  );

  it.each([
    "in_transit",
    "arrived",
    "receiving",
    "pending_approval",
    "received",
    "cancelled",
  ] as const)("blocks editing once the load list is %s", (status) => {
    expect(canEditLoadList(buildLoadList(status, {}), true)).toBe(false);
  });

  it("requires edit permission, source business unit, and unit price visibility", () => {
    expect(canEditLoadList(buildLoadList("draft", {}), false)).toBe(false);
    expect(canEditLoadList(buildLoadList("draft", { source: false }), true)).toBe(false);
    expect(canEditLoadList(buildLoadList("draft", { price: false }), true)).toBe(false);
  });
});
