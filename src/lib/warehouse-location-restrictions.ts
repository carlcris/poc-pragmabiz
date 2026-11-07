import type { WarehouseLocationDetail } from "@/types/inventory-location";

type RestrictionInput = Pick<
  WarehouseLocationDetail,
  | "ancestors"
  | "activeChildCount"
  | "directOnHand"
  | "directReserved"
  | "directPendingPutaway"
  | "subtreeOnHand"
  | "subtreeReserved"
  | "subtreePendingPutaway"
>;

export type WarehouseLocationRestrictionReason =
  | "branchInUse"
  | "activeChildren"
  | "parentInactive"
  | "usedHere"
  | "reservedHere";

export type WarehouseLocationRestrictions = {
  move: WarehouseLocationRestrictionReason | null;
  disable: WarehouseLocationRestrictionReason | null;
  enable: WarehouseLocationRestrictionReason | null;
  stopStoring: WarehouseLocationRestrictionReason | null;
  stopPicking: WarehouseLocationRestrictionReason | null;
};

// Explains validate_warehouse_location_hierarchy before the user acts; the trigger stays authoritative.
export const getWarehouseLocationRestrictions = (
  detail: RestrictionInput
): WarehouseLocationRestrictions => {
  const branchInUse =
    detail.subtreeOnHand > 0 || detail.subtreeReserved > 0 || detail.subtreePendingPutaway > 0;
  const parent = detail.ancestors.at(-1);
  return {
    move: branchInUse ? "branchInUse" : null,
    disable: detail.activeChildCount > 0 ? "activeChildren" : branchInUse ? "branchInUse" : null,
    enable: parent && !parent.isActive ? "parentInactive" : null,
    stopStoring:
      detail.directOnHand > 0 || detail.directReserved > 0 || detail.directPendingPutaway > 0
        ? "usedHere"
        : null,
    stopPicking: detail.directReserved > 0 ? "reservedHere" : null,
  };
};

const restrictionMessageKeys = {
  branchInUse: "reasonBranchInUse",
  activeChildren: "reasonActiveChildren",
  parentInactive: "reasonParentInactive",
  usedHere: "reasonUsedHere",
  reservedHere: "reasonReservedHere",
} as const satisfies Record<WarehouseLocationRestrictionReason, string>;

export const getWarehouseLocationRestrictionMessage = (
  reason: WarehouseLocationRestrictionReason,
  detail: Pick<WarehouseLocationDetail, "ancestors" | "activeChildCount">
) => ({
  key: restrictionMessageKeys[reason],
  values: { count: detail.activeChildCount, code: detail.ancestors.at(-1)?.code ?? "" },
});
