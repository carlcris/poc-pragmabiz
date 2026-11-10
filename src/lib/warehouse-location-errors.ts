import { NextResponse } from "next/server";

export const warehouseLocationErrorCodes = [
  "LOCATION_CODE_TOO_LONG",
  "LOCATION_CODE_READ_ONLY",
  "LOCATION_EDIT_CONFLICT",
  "LOCATION_PARENT_INVALID",
  "LOCATION_HIERARCHY_CYCLE",
  "LOCATION_HAS_CHILDREN",
  "LOCATION_IN_USE",
  "LOCATION_IS_PREFERRED",
  "LOCATION_TYPE_INVALID",
  "LOCATION_WAREHOUSE_INVALID",
  "LOCATION_OWNERSHIP_IMMUTABLE",
  "LOCATION_BATCH_INVALID",
  "LOCATION_CODE_EXISTS",
  "CAPACITY_REQUIRES_STORABLE_LOCATION",
  "LOCATION_COPY_INVALID",
  "LOCATION_COPY_TOO_LARGE",
] as const;
export type WarehouseLocationErrorCode = (typeof warehouseLocationErrorCodes)[number];

export function warehouseLocationErrorResponse(error: { message: string; code?: string }) {
  if (error.code === "40P01" || error.code === "40001") {
    return NextResponse.json(
      {
        error: "The location changed during this operation. Refresh and retry.",
        code: "LOCATION_EDIT_CONFLICT",
      },
      { status: 409 }
    );
  }
  const code = warehouseLocationErrorCodes.find((candidate) => candidate === error.message);
  if (!code) return null;
  const messages: Record<WarehouseLocationErrorCode, string> = {
    LOCATION_CODE_TOO_LONG: "Choose a shallower parent: generated code exceeds 100 characters.",
    LOCATION_CODE_READ_ONLY: "Location codes are generated automatically.",
    LOCATION_EDIT_CONFLICT: "The location changed during this operation. Refresh and retry.",
    LOCATION_PARENT_INVALID: "Select an active parent in the same warehouse.",
    LOCATION_HIERARCHY_CYCLE: "A location cannot be its own ancestor. Choose another parent.",
    LOCATION_HAS_CHILDREN: "Manage child locations before disabling or deleting this location.",
    LOCATION_IS_PREFERRED:
      "This location is still preferred by an item. Reassign or clear its preferred location before deleting.",
    LOCATION_IN_USE: "Move stock and finish or cancel open work before changing this location.",
    LOCATION_TYPE_INVALID: "Select a supported location type.",
    LOCATION_WAREHOUSE_INVALID: "Select an available warehouse.",
    LOCATION_OWNERSHIP_IMMUTABLE: "A location cannot be moved to another warehouse.",
    LOCATION_BATCH_INVALID: "Enter up to 100 numbers with codes of 100 characters or fewer.",
    LOCATION_CODE_EXISTS: "Location code already exists for this warehouse",
    CAPACITY_REQUIRES_STORABLE_LOCATION: "Capacity can only be configured for storable locations",
    LOCATION_COPY_INVALID:
      "Check the copied names and destination: codes must fit within 100 characters and names within 200.",
    LOCATION_COPY_TOO_LARGE: "Copy at most 200 locations at a time.",
  };
  return NextResponse.json(
    { error: messages[code], code },
    {
      status: [
        "LOCATION_HAS_CHILDREN",
        "LOCATION_IN_USE",
        "LOCATION_IS_PREFERRED",
        "LOCATION_CODE_EXISTS",
      ].includes(code)
        ? 409
        : 400,
    }
  );
}
