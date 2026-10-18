export type WarehouseFloorMapRack = {
  id: string;
  warehouseLocationId: string;
  locationCode: string;
  locationName: string | null;
  xBasisPoints: number;
  yBasisPoints: number;
  widthBasisPoints: number;
  heightBasisPoints: number;
};

export type WarehouseFloorMap = {
  id: string;
  warehouseId: string;
  floorNumber: number;
  name: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  version: number;
  racks: WarehouseFloorMapRack[];
};

export type WarehouseFloorSummary = Pick<WarehouseFloorMap, "id" | "floorNumber" | "name">;

export type WarehouseFloorListResponse = {
  data: WarehouseFloorSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export const WAREHOUSE_FLOOR_MAP_ERROR_CODES = [
  "UNAUTHORIZED",
  "WAREHOUSE_NOT_FOUND",
  "FLOOR_MAP_PERMISSION_DENIED",
  "INVALID_FLOOR_NUMBER",
  "INVALID_FLOOR_MAP",
  "INVALID_FLOOR_MAP_IMAGE",
  "FLOOR_MAP_IMAGE_REQUIRED",
  "FLOOR_MAP_VERSION_CONFLICT",
  "RACK_ALREADY_MAPPED_ON_ANOTHER_FLOOR",
  "RACK_MAPPING_TOO_SMALL",
  "FLOOR_MAP_UPLOAD_FAILED",
  "FLOOR_MAP_SAVE_FAILED",
  "FLOOR_MAP_RELOAD_FAILED",
] as const;

export type WarehouseFloorMapErrorCode = (typeof WAREHOUSE_FLOOR_MAP_ERROR_CODES)[number];

export type WarehouseFloorMapResponse = {
  data: WarehouseFloorMap | null;
};

export type WarehouseFloorMapRackInput = Omit<
  WarehouseFloorMapRack,
  "id" | "locationCode" | "locationName"
>;

export type PickLocationMap = {
  warehouse: {
    id: string;
    name: string;
  };
  location: {
    id: string;
    code: string;
    name: string | null;
  };
  map: {
    id: string;
    floorNumber: number;
    name: string;
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
    version: number;
  };
  racks: {
    warehouseLocationId: string;
    code: string;
    name: string | null;
    xBasisPoints: number;
    yBasisPoints: number;
    widthBasisPoints: number;
    heightBasisPoints: number;
  }[];
  highlight: {
    xBasisPoints: number;
    yBasisPoints: number;
    widthBasisPoints: number;
    heightBasisPoints: number;
  };
};
