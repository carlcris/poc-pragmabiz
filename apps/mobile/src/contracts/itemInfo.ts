export type ScannedItemDimensions = {
  length?: number;
  width?: number;
  height?: number;
  unit?: string;
  label: string;
};

export type ScannedItemInventory = {
  onHand: number;
  reserved: number;
  available: number;
};

export type ScannedItemInfo = {
  id: string;
  code: string;
  name: string;
  type: string;
  category: string;
  description: string;
  imageUrl: string | null;
  dimensions: ScannedItemDimensions | null;
  inventory: ScannedItemInventory;
};

export type ScannedItemInfoResponse = {
  data: ScannedItemInfo | null;
  message?: string;
};
