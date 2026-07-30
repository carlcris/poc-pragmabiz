export type StockInTransitRow = {
  id: string;
  loadListId: string;
  loadListNumber: string;
  supplierCode: string;
  supplierName: string;
  sourceBusinessUnitCode: string;
  sourceBusinessUnitName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  unitName: string;
  loadListQuantity: number;
  quantityPerUnit: number;
  baseQuantity: number;
  estimatedArrivalDate: string | null;
  linerName: string | null;
  containerNumber: string | null;
};

export type StockInTransitFilters = {
  search?: string;
  page?: number;
  limit?: number;
};

export type StockInTransitResponse = {
  data: StockInTransitRow[];
  summary: {
    totalBaseQuantity: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
