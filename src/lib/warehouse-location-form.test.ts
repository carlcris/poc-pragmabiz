import { describe, expect, it } from "vitest";
import {
  formatWarehouseLocationAddress,
  formatWarehouseLocationNamePath,
  getWarehouseLocationDisplayName,
  getDefaultWarehouseLocationUse,
  getWarehouseLocationErrorField,
  getWarehouseLocationErrorMessageKey,
  getWarehouseLocationUse,
  getWarehouseLocationUseFlags,
  incrementTrailingNumber,
  suggestSiblingLocationType,
} from "./warehouse-location-form";

describe("warehouse location use", () => {
  it("maps storage and picking flags to a single use", () => {
    expect(getWarehouseLocationUse({ isStorable: true, isPickable: true })).toBe("storeAndPick");
    expect(getWarehouseLocationUse({ isStorable: true, isPickable: false })).toBe("storeOnly");
    expect(getWarehouseLocationUse({ isStorable: false, isPickable: false })).toBe("organizeOnly");
    expect(getWarehouseLocationUse({ isStorable: false, isPickable: true })).toBe("organizeOnly");
  });

  it("never produces a pickable location that cannot store stock", () => {
    expect(getWarehouseLocationUseFlags("storeAndPick")).toEqual({
      isStorable: true,
      isPickable: true,
    });
    expect(getWarehouseLocationUseFlags("storeOnly")).toEqual({
      isStorable: true,
      isPickable: false,
    });
    expect(getWarehouseLocationUseFlags("organizeOnly")).toEqual({
      isStorable: false,
      isPickable: false,
    });
  });

  it("defaults grouping types to organize only", () => {
    expect(getDefaultWarehouseLocationUse("zone")).toBe("organizeOnly");
    expect(getDefaultWarehouseLocationUse("aisle")).toBe("organizeOnly");
    expect(getDefaultWarehouseLocationUse("rack")).toBe("storeAndPick");
    expect(getDefaultWarehouseLocationUse("bin")).toBe("storeAndPick");
  });
});

describe("suggestSiblingLocationType", () => {
  it("returns the most common sibling type", () => {
    expect(
      suggestSiblingLocationType([
        { locationType: "shelf" },
        { locationType: "bin" },
        { locationType: "bin" },
      ])
    ).toBe("bin");
  });

  it("keeps the first type on ties and ignores unknown types", () => {
    expect(
      suggestSiblingLocationType([
        { locationType: "pallet" },
        { locationType: "crate" },
        { locationType: "bin" },
      ])
    ).toBe("crate");
  });

  it("returns null without siblings", () => {
    expect(suggestSiblingLocationType([])).toBeNull();
  });
});

describe("formatWarehouseLocationAddress", () => {
  it("matches the database address format", () => {
    expect(formatWarehouseLocationAddress("A - Zone A", " A1-B21 ", " Bin 21 ")).toBe(
      "A - Zone A / A1-B21 - Bin 21"
    );
    expect(formatWarehouseLocationAddress(null, "A", "")).toBe("A");
  });
});

describe("incrementTrailingNumber", () => {
  it("increments the last number and keeps zero padding", () => {
    expect(incrementTrailingNumber("A1-B21")).toBe("A1-B22");
    expect(incrementTrailingNumber("A1-B09")).toBe("A1-B10");
    expect(incrementTrailingNumber("B99")).toBe("B100");
    expect(incrementTrailingNumber("Shelf 2 (Top)")).toBe("Shelf 3 (Top)");
  });

  it("leaves values without a number unchanged", () => {
    expect(incrementTrailingNumber("Overflow")).toBe("Overflow");
    expect(incrementTrailingNumber("")).toBe("");
  });
});

describe("warehouse location error mapping", () => {
  it("routes field errors to the field they concern", () => {
    expect(getWarehouseLocationErrorField("LOCATION_CODE_EXISTS")).toBe("code");
    expect(getWarehouseLocationErrorField("LOCATION_PARENT_INVALID")).toBe("parent");
    expect(getWarehouseLocationErrorField("LOCATION_HIERARCHY_CYCLE")).toBe("parent");
    expect(getWarehouseLocationErrorField("CAPACITY_REQUIRES_STORABLE_LOCATION")).toBe(
      "maxCapacity"
    );
    expect(getWarehouseLocationErrorField("LOCATION_IN_USE")).toBeNull();
  });

  it("maps every code to a translated message key", () => {
    expect(getWarehouseLocationErrorMessageKey("LOCATION_IN_USE")).toBe("locationInUse");
    expect(getWarehouseLocationErrorMessageKey("WAREHOUSE_NOT_FOUND")).toBe("locationNotFound");
  });
});

describe("warehouse location display names", () => {
  it("shows names and falls back to codes for unnamed locations", () => {
    expect(getWarehouseLocationDisplayName({ code: "AS01R1", name: "Rack 01" })).toBe("Rack 01");
    expect(getWarehouseLocationDisplayName({ code: "R1B1", name: "  " })).toBe("R1B1");
    expect(
      formatWarehouseLocationNamePath(
        [
          { code: "Z1", name: "Zone 1" },
          { code: "AS01R1", name: null },
        ],
        { code: "R1B1", name: "B01" }
      )
    ).toBe("Zone 1 / AS01R1 / B01");
  });
});
