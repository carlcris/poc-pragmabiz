import type { WarehouseFloorMapErrorCode } from "@/types/warehouse-floor-map";

export const mapFloorMapSaveError = (
  reason: string
): { code: WarehouseFloorMapErrorCode; error: string; status: number } => {
  switch (reason) {
    case "UNAUTHORIZED":
      return { code: "UNAUTHORIZED", error: "Sign in again before saving", status: 401 };
    case "ACTOR_COMPANY_MISMATCH":
    case "WAREHOUSE_ACCESS_DENIED":
    case "FLOOR_MAP_PERMISSION_DENIED":
      return {
        code: "FLOOR_MAP_PERMISSION_DENIED",
        error: "You do not have permission to change this floor map",
        status: 403,
      };
    case "WAREHOUSE_NOT_FOUND":
      return { code: "WAREHOUSE_NOT_FOUND", error: "Warehouse not found", status: 404 };
    case "INVALID_FLOOR_NUMBER":
      return {
        code: "INVALID_FLOOR_NUMBER",
        error: "Choose a positive whole floor number",
        status: 400,
      };
    case "FLOOR_MAP_VERSION_CONFLICT":
      return {
        code: "FLOOR_MAP_VERSION_CONFLICT",
        error: "This floor map has changed. Reload it before saving",
        status: 409,
      };
    case "RACK_ALREADY_MAPPED_ON_ANOTHER_FLOOR":
      return {
        code: "RACK_ALREADY_MAPPED_ON_ANOTHER_FLOOR",
        error: "A rack is already mapped on another floor. Remove its old mapping first",
        status: 409,
      };
    case "RACK_MAPPING_TOO_SMALL":
      return {
        code: "RACK_MAPPING_TOO_SMALL",
        error: "Draw over the complete rack before saving",
        status: 400,
      };
    case "MAP_IMAGE_REQUIRED":
      return {
        code: "FLOOR_MAP_IMAGE_REQUIRED",
        error: "Upload a floor-plan image first",
        status: 400,
      };
    case "INVALID_MAP_NAME":
    case "INVALID_IMAGE_DIMENSIONS":
    case "INVALID_RACK_MAPPINGS":
    case "DUPLICATE_RACK_MAPPING":
      return {
        code: "INVALID_FLOOR_MAP",
        error: "Check the map details and active rack mappings before saving",
        status: 400,
      };
    default:
      return {
        code: "FLOOR_MAP_SAVE_FAILED",
        error: "Failed to save warehouse floor map",
        status: 500,
      };
  }
};
