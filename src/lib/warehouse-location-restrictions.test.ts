import { describe, expect, it } from "vitest";
import {
  getWarehouseLocationRestrictionMessage,
  getWarehouseLocationRestrictions,
} from "./warehouse-location-restrictions";

const emptyLocation = {
  ancestors: [],
  activeChildCount: 0,
  directOnHand: 0,
  directReserved: 0,
  directPendingPutaway: 0,
  subtreeOnHand: 0,
  subtreeReserved: 0,
  subtreePendingPutaway: 0,
};

describe("getWarehouseLocationRestrictions", () => {
  it("allows every structural change for an empty location", () => {
    expect(getWarehouseLocationRestrictions(emptyLocation)).toEqual({
      move: null,
      disable: null,
      enable: null,
      stopStoring: null,
      stopPicking: null,
    });
  });

  it("blocks moving and disabling a branch with stock, reservations, or pending putaway", () => {
    for (const branch of [
      { subtreeOnHand: 4 },
      { subtreeReserved: 1 },
      { subtreePendingPutaway: 1 },
    ]) {
      const restrictions = getWarehouseLocationRestrictions({ ...emptyLocation, ...branch });
      expect(restrictions.move).toBe("branchInUse");
      expect(restrictions.disable).toBe("branchInUse");
      expect(restrictions.stopStoring).toBeNull();
    }
  });

  it("asks to disable active children first", () => {
    expect(
      getWarehouseLocationRestrictions({ ...emptyLocation, activeChildCount: 2, subtreeOnHand: 5 })
        .disable
    ).toBe("activeChildren");
  });

  it("only blocks storage and picking changes for stock at this exact location", () => {
    expect(
      getWarehouseLocationRestrictions({ ...emptyLocation, directOnHand: 3, subtreeOnHand: 3 })
    ).toMatchObject({ stopStoring: "usedHere", stopPicking: null });
    expect(
      getWarehouseLocationRestrictions({ ...emptyLocation, directReserved: 1, subtreeReserved: 1 })
    ).toMatchObject({ stopStoring: "usedHere", stopPicking: "reservedHere" });
    expect(
      getWarehouseLocationRestrictions({ ...emptyLocation, directPendingPutaway: 1 }).stopStoring
    ).toBe("usedHere");
  });

  it("requires an active parent before enabling", () => {
    const parent = { id: "p", code: "A", name: null, locationPath: "A" };
    expect(
      getWarehouseLocationRestrictions({
        ...emptyLocation,
        ancestors: [{ ...parent, isActive: false }],
      }).enable
    ).toBe("parentInactive");
    expect(
      getWarehouseLocationRestrictions({
        ...emptyLocation,
        ancestors: [{ ...parent, isActive: true }],
      }).enable
    ).toBeNull();
  });
});

describe("getWarehouseLocationRestrictionMessage", () => {
  it("names the blocking parent and the active child count", () => {
    const detail = {
      ancestors: [{ id: "p", code: "ZONE-A", name: null, locationPath: "ZONE-A", isActive: false }],
      activeChildCount: 3,
    };
    expect(getWarehouseLocationRestrictionMessage("parentInactive", detail)).toEqual({
      key: "reasonParentInactive",
      values: { count: 3, code: "ZONE-A" },
    });
    expect(getWarehouseLocationRestrictionMessage("activeChildren", detail).key).toBe(
      "reasonActiveChildren"
    );
  });
});
