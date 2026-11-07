export const WAREHOUSE_LOCATION_TYPES = ["zone", "aisle", "rack", "shelf", "bin", "crate"] as const;
export type WarehouseLocationType = (typeof WAREHOUSE_LOCATION_TYPES)[number];

export const WAREHOUSE_LOCATION_USES = ["storeAndPick", "storeOnly", "organizeOnly"] as const;
export type WarehouseLocationUse = (typeof WAREHOUSE_LOCATION_USES)[number];

export const warehouseLocationTypeLabelKeys = {
  zone: "typeZone",
  aisle: "typeAisle",
  rack: "typeRack",
  shelf: "typeShelf",
  bin: "typeBin",
  crate: "typeCrate",
} as const satisfies Record<WarehouseLocationType, string>;

export const warehouseLocationUseLabelKeys = {
  storeAndPick: "useStoreAndPick",
  storeOnly: "useStoreOnly",
  organizeOnly: "useOrganizeOnly",
} as const satisfies Record<WarehouseLocationUse, string>;

export const warehouseLocationUseHelpKeys = {
  storeAndPick: "useStoreAndPickHelp",
  storeOnly: "useStoreOnlyHelp",
  organizeOnly: "useOrganizeOnlyHelp",
} as const satisfies Record<WarehouseLocationUse, string>;

export const warehouseLocationMutationErrorCodes = [
  "LOCATION_EDIT_CONFLICT",
  "LOCATION_PARENT_INVALID",
  "LOCATION_HIERARCHY_CYCLE",
  "LOCATION_HAS_CHILDREN",
  "LOCATION_IN_USE",
  "LOCATION_TYPE_INVALID",
  "LOCATION_WAREHOUSE_INVALID",
  "LOCATION_OWNERSHIP_IMMUTABLE",
  "INVALID_LOCATION",
  "LOCATION_CODE_EXISTS",
  "CAPACITY_REQUIRES_STORABLE_LOCATION",
  "WAREHOUSE_LOCATION_NOT_FOUND",
  "WAREHOUSE_NOT_FOUND",
  "LOCATION_BATCH_INVALID",
  "LOCATION_BATCH_EMPTY",
  "LOCATION_COPY_INVALID",
  "LOCATION_COPY_TOO_LARGE",
] as const;
export type WarehouseLocationMutationErrorCode =
  (typeof warehouseLocationMutationErrorCodes)[number];

export type WarehouseLocationErrorMessageKey =
  | "editConflict"
  | "parentInvalid"
  | "hierarchyCycle"
  | "hasChildren"
  | "locationInUse"
  | "invalidLocation"
  | "locationNotFound"
  | "ownershipImmutable"
  | "codeExists"
  | "capacityRequiresStorable"
  | "batchInvalid"
  | "batchEmpty"
  | "copyInvalid"
  | "copyTooLarge";

export type WarehouseLocationFormField = "code" | "parent" | "maxCapacity";

const errorMessageKeys: Record<
  WarehouseLocationMutationErrorCode,
  WarehouseLocationErrorMessageKey
> = {
  LOCATION_EDIT_CONFLICT: "editConflict",
  LOCATION_PARENT_INVALID: "parentInvalid",
  LOCATION_HIERARCHY_CYCLE: "hierarchyCycle",
  LOCATION_HAS_CHILDREN: "hasChildren",
  LOCATION_IN_USE: "locationInUse",
  LOCATION_TYPE_INVALID: "invalidLocation",
  LOCATION_WAREHOUSE_INVALID: "locationNotFound",
  LOCATION_OWNERSHIP_IMMUTABLE: "ownershipImmutable",
  INVALID_LOCATION: "invalidLocation",
  LOCATION_CODE_EXISTS: "codeExists",
  CAPACITY_REQUIRES_STORABLE_LOCATION: "capacityRequiresStorable",
  WAREHOUSE_LOCATION_NOT_FOUND: "locationNotFound",
  WAREHOUSE_NOT_FOUND: "locationNotFound",
  LOCATION_BATCH_INVALID: "batchInvalid",
  LOCATION_BATCH_EMPTY: "batchEmpty",
  LOCATION_COPY_INVALID: "copyInvalid",
  LOCATION_COPY_TOO_LARGE: "copyTooLarge",
};

const errorFields: Partial<Record<WarehouseLocationMutationErrorCode, WarehouseLocationFormField>> =
  {
    LOCATION_CODE_EXISTS: "code",
    LOCATION_PARENT_INVALID: "parent",
    LOCATION_HIERARCHY_CYCLE: "parent",
    CAPACITY_REQUIRES_STORABLE_LOCATION: "maxCapacity",
  };

export const getWarehouseLocationErrorMessageKey = (code: WarehouseLocationMutationErrorCode) =>
  errorMessageKeys[code];

export const getWarehouseLocationErrorField = (code: WarehouseLocationMutationErrorCode) =>
  errorFields[code] ?? null;

export const getWarehouseLocationUse = ({
  isStorable,
  isPickable,
}: {
  isStorable: boolean;
  isPickable: boolean;
}): WarehouseLocationUse => {
  if (!isStorable) return "organizeOnly";
  return isPickable ? "storeAndPick" : "storeOnly";
};

// Picking requires stored stock, so a non-storable location is never sent as pickable.
export const getWarehouseLocationUseFlags = (use: WarehouseLocationUse) => ({
  isStorable: use !== "organizeOnly",
  isPickable: use === "storeAndPick",
});

export const getDefaultWarehouseLocationUse = (
  locationType: WarehouseLocationType
): WarehouseLocationUse =>
  locationType === "zone" || locationType === "aisle" ? "organizeOnly" : "storeAndPick";

export const isWarehouseLocationType = (value: string): value is WarehouseLocationType =>
  WAREHOUSE_LOCATION_TYPES.some((locationType) => locationType === value);

export const suggestSiblingLocationType = (
  siblings: ReadonlyArray<{ locationType: string }>
): WarehouseLocationType | null => {
  const counts = new Map<WarehouseLocationType, number>();
  let suggestion: WarehouseLocationType | null = null;
  for (const { locationType } of siblings) {
    if (!isWarehouseLocationType(locationType)) continue;
    const count = (counts.get(locationType) ?? 0) + 1;
    counts.set(locationType, count);
    if (!suggestion || count > (counts.get(suggestion) ?? 0)) suggestion = locationType;
  }
  return suggestion;
};

// Mirrors validate_warehouse_location_hierarchy: concat_ws(' - ', code, name) joined by ' / '.
export const formatWarehouseLocationAddress = (
  parentAddress: string | null,
  code: string,
  name: string
) => {
  const trimmedCode = code.trim();
  const trimmedName = name.trim();
  const segment = trimmedName ? `${trimmedCode} - ${trimmedName}` : trimmedCode;
  return parentAddress ? `${parentAddress} / ${segment}` : segment;
};

export const incrementTrailingNumber = (value: string) => {
  const match = /^(.*?)(\d+)(\D*)$/.exec(value);
  if (!match) return value;
  const [, prefix, digits, suffix] = match;
  const next = (BigInt(digits) + BigInt(1)).toString().padStart(digits.length, "0");
  return `${prefix}${next}${suffix}`;
};

// Locations are shown by name; the code stands in only when a location has no name.
export const getWarehouseLocationDisplayName = (location: { code: string; name?: string | null }) =>
  location.name?.trim() || location.code;

export const formatWarehouseLocationNamePath = (
  ancestors: ReadonlyArray<{ code: string; name?: string | null }>,
  location: { code: string; name?: string | null }
) => [...ancestors, location].map(getWarehouseLocationDisplayName).join(" / ");
