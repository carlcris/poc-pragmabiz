import type {
  WarehouseFloorMapRackInput,
  WarehouseFloorMapResponse,
} from "@/types/warehouse-floor-map";

type SaveWarehouseFloorMapInput = {
  warehouseId: string;
  name: string;
  imageWidth: number;
  imageHeight: number;
  racks: WarehouseFloorMapRackInput[];
  file?: File | null;
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || "Warehouse floor map request failed", { cause: payload });
  }

  return payload as T;
};

export const getWarehouseFloorMap = async (
  warehouseId: string
): Promise<WarehouseFloorMapResponse> => {
  const response = await fetch(`/api/warehouses/${warehouseId}/floor-map`, {
    credentials: "include",
  });
  return parseResponse<WarehouseFloorMapResponse>(response);
};

export const saveWarehouseFloorMap = async (
  input: SaveWarehouseFloorMapInput
): Promise<WarehouseFloorMapResponse> => {
  const formData = new FormData();
  formData.set("name", input.name);
  formData.set("imageWidth", String(input.imageWidth));
  formData.set("imageHeight", String(input.imageHeight));
  formData.set("racks", JSON.stringify(input.racks));
  if (input.file) {
    formData.set("file", input.file);
  }

  const response = await fetch(`/api/warehouses/${input.warehouseId}/floor-map`, {
    method: "PUT",
    credentials: "include",
    body: formData,
  });
  return parseResponse<WarehouseFloorMapResponse>(response);
};
