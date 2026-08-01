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
  name: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  version: number;
  racks: WarehouseFloorMapRack[];
};

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
