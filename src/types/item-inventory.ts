export type InventoryPreviewUnit = {
  displayLabel: string;
  qtyPerUnit: number;
};

export type ItemInventoryRow = {
  id: string;
  code: string;
  supplierCode: string | null;
  name: string;
  chineseName?: string;
  category: string;
  onHand: number;
  allocated: number;
  available: number;
  inventoryPreviewUnit: InventoryPreviewUnit | null;
  putawayQty: number;
  reorderPoint: number;
  status: "normal" | "low_stock" | "out_of_stock" | "overstock" | "discontinued";
  imageUrl?: string;
};

export type ItemInventoryResponse = {
  data: ItemInventoryRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
