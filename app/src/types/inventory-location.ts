export type ItemLocation = {
  id: string;
  itemId: string;
  warehouseId: string;
  locationId: string;
  warehouseCode: string;
  warehouseName: string;
  locationCode: string;
  locationName: string;
  locationType: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  isDefault?: boolean;
  defaultLocationId?: string | null;
};

export type WarehouseLocation = {
  id: string;
  companyId: string;
  warehouseId: string;
  code: string;
  name?: string | null;
  parentId?: string | null;
  locationType: string;
  isPickable: boolean;
  isStorable: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
