export type InventoryBoxCountReportRow = {
  itemId: string;
  itemCode: string;
  itemName: string;
  baseUnit: string | null;
  onHand: number;
  qtyPerPackingUnit: number;
  fullPackingUnits: number;
  looseUnits: number;
};

export type InventoryBoxCountReportResponse = {
  data: InventoryBoxCountReportRow[];
  summary: {
    /** Items with an active size for the selected calculation unit. */
    totalItems: number;
    totalFullPackingUnits: number;
    /** Category items excluded because they lack an active size for the selected unit. */
    itemsWithoutPackingUnitSize: number;
  };
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
  category: { id: string; name: string };
  businessUnit: { id: string; name: string } | null;
  packingUnit: InventoryBoxCountPackingUnit;
};

export type InventoryBoxCountPackingUnit = {
  id: string;
  code: string;
  name: string;
};

export type InventoryBoxCountPackingUnitsResponse = {
  data: InventoryBoxCountPackingUnit[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  defaultUnit: InventoryBoxCountPackingUnit | null;
};

export type InventoryBoxCountBusinessUnit = {
  id: string;
  name: string;
};

export type InventoryBoxCountBusinessUnitsResponse = {
  data: InventoryBoxCountBusinessUnit[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type InventoryBoxCountReportErrorCode =
  | "INVENTORY_BOX_COUNT_FILTERS_INVALID"
  | "INVENTORY_BOX_COUNT_PACKING_UNIT_NOT_FOUND"
  | "INVENTORY_BOX_COUNT_FORBIDDEN"
  | "INVENTORY_BOX_COUNT_CATEGORY_NOT_FOUND"
  | "INVENTORY_BOX_COUNT_TOO_LARGE"
  | "INVENTORY_BOX_COUNT_FAILED"
  | "INVENTORY_BOX_COUNT_PACKING_UNITS_FILTERS_INVALID"
  | "INVENTORY_BOX_COUNT_PACKING_UNITS_FAILED"
  | "INVENTORY_BOX_COUNT_BUSINESS_UNITS_FILTERS_INVALID"
  | "INVENTORY_BOX_COUNT_BUSINESS_UNITS_FAILED";

export type InventoryBoxCountReportErrorResponse = {
  error: string;
  code: InventoryBoxCountReportErrorCode;
};
