import { describe, expect, it } from "vitest";
import { warehouseLocationErrorResponse } from "./warehouse-location-errors";
import { getPickAllocationErrorMessage } from "./pick-allocation-errors";

describe("location and allocation error contracts", () => {
  it.each([
    "LOCATION_PARENT_INVALID",
    "LOCATION_HIERARCHY_CYCLE",
    "LOCATION_BATCH_INVALID",
    "CAPACITY_REQUIRES_STORABLE_LOCATION",
    "LOCATION_COPY_INVALID",
    "LOCATION_COPY_TOO_LARGE",
  ])("returns a safe validation error for %s", async (message) => {
    const response = warehouseLocationErrorResponse({ message });
    expect(response?.status).toBe(400);
    expect(await response?.json()).toMatchObject({ code: message });
  });
  it.each([
    "LOCATION_HAS_CHILDREN",
    "LOCATION_IN_USE",
    "LOCATION_CODE_EXISTS",
    "LOCATION_BATCH_EMPTY",
  ])("preserves a recoverable conflict for %s", async (message) => {
    expect(warehouseLocationErrorResponse({ message })?.status).toBe(409);
  });
  it("does not expose unexpected database details", () => {
    expect(warehouseLocationErrorResponse({ message: "private database details" })).toBeNull();
  });
  it("turns a concurrency failure into retry guidance", async () => {
    const response = warehouseLocationErrorResponse({
      code: "40P01",
      message: "private lock details",
    });
    expect(response?.status).toBe(409);
    expect(await response?.json()).toEqual({
      code: "LOCATION_EDIT_CONFLICT",
      error: "The location changed during this operation. Refresh and retry.",
    });
  });
  it("uses the API code to select translated allocation guidance", () => {
    const error = new Error("Untranslated fallback", {
      cause: { code: "PICK_ALLOCATION_INSUFFICIENT_BATCH_QUANTITY" },
    });
    expect(getPickAllocationErrorMessage(error, (key) => `translated:${key}`)).toBe(
      "translated:insufficient"
    );
  });
});
