export type StockInTransitArrivalWindow =
  | "late"
  | "next_7_days"
  | "days_8_to_14"
  | "later"
  | "no_eta";

export type StockInTransitPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type StockInTransitItemFilters = {
  search?: string;
  page?: number;
  limit?: number;
};

export type StockInTransitItemArrivalFilters = {
  itemId: string;
  page?: number;
  limit?: number;
};

export type StockInTransitOrderedUnitTotal = {
  unitName: string;
  quantity: number;
  quantityPerUnit: number;
};

export type StockInTransitItemRow = {
  itemId: string;
  itemCode: string;
  itemName: string;
  baseUnitName: string | null;
  totalBaseQuantity: number;
  orderedUnitTotals: StockInTransitOrderedUnitTotal[];
  shipmentCount: number;
  nextEstimatedArrivalDate: string | null;
  nextDaysUntilArrival: number | null;
  nextArrivalWindow: StockInTransitArrivalWindow;
};

export type StockInTransitItemsResponse = {
  data: StockInTransitItemRow[];
  summary: {
    loadListCount: number;
    lateLoadListCount: number;
  };
  pagination: StockInTransitPagination;
};

export type StockInTransitDestinationTotal = {
  destinationBusinessUnitId: string;
  destinationBusinessUnitName: string | null;
  baseQuantity: number;
  orderedUnitTotals: StockInTransitOrderedUnitTotal[];
};

export type StockInTransitArrivalRow = {
  loadListId: string;
  loadListNumber: string;
  supplierName: string;
  sourceBusinessUnitId: string;
  destinationBusinessUnitId: string;
  destinationBusinessUnitName: string | null;
  estimatedArrivalDate: string | null;
  daysUntilArrival: number | null;
  arrivalWindow: StockInTransitArrivalWindow;
  linerName: string | null;
  containerNumber: string | null;
  baseQuantity: number;
  orderedUnitTotals: StockInTransitOrderedUnitTotal[];
  arrivalBaseQuantity: number;
  arrivalOrderedUnitTotals: StockInTransitOrderedUnitTotal[];
  arrivalShipmentCount: number;
  arrivalContainerCount: number;
  arrivalDestinationTotals: StockInTransitDestinationTotal[];
};

export type StockInTransitArrivalWindowTotals = Record<StockInTransitArrivalWindow, number>;
export type StockInTransitArrivalWindowOrderedUnitTotals = Record<
  StockInTransitArrivalWindow,
  StockInTransitOrderedUnitTotal[]
>;

export type StockInTransitItemArrivalsResponse = {
  data: StockInTransitArrivalRow[];
  summary: {
    arrivalWindowTotals: StockInTransitArrivalWindowTotals;
    arrivalWindowOrderedUnitTotals: StockInTransitArrivalWindowOrderedUnitTotals;
  };
  pagination: StockInTransitPagination;
};
